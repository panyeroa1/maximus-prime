import { useState, useRef, useCallback, useContext } from 'react';
// FIX: Removed ErrorEvent and CloseEvent from the @google/genai import as they are browser-native types.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob, MediaResolution, Type, LiveCallbacks, FunctionDeclaration } from '@google/genai';
// FIX: Add Booking to imports for type casting function call arguments.
import { Agent, Booking } from '../types';
import { useCrm } from '../contexts/CrmContext';
import { sendEmailViaGmail } from '../services/emailService';
import { CRM_FUNCTION_DECLARATIONS } from '../constants';

// --- Audio Helper Functions (from Gemini Docs) ---
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createBlob(data: Float32Array): GenaiBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// FIX: Updated `decodeAudioData` to match the Gemini API guidelines for robustness.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Audio Helper Functions ---

export interface Transcript {
    id: number;
    role: 'user' | 'model';
    text: string;
    isFinal: boolean;
}

export const useGeminiLiveAgent = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [inputAnalyserNode, setInputAnalyserNode] = useState<AnalyserNode | null>(null);
    const [outputAnalyserNode, setOutputAnalyserNode] = useState<AnalyserNode | null>(null);
    const [actionLog, setActionLog] = useState<string | null>(null);

    const crm = useCrm();

    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<any | null>(null);
    const sessionIdRef = useRef<number>(0);
    
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputGainNodeRef = useRef<GainNode | null>(null);
    
    const playbackQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const isMicrophonePaused = useRef(false);

    const pauseMicrophoneStream = useCallback(() => {
        isMicrophonePaused.current = true;
    }, []);

    const resumeMicrophoneStream = useCallback(() => {
        isMicrophonePaused.current = false;
    }, []);

    const cleanup = useCallback(() => {
        // Invalidate the session ID to prevent race conditions from stale callbacks.
        sessionIdRef.current = 0;

        setIsSessionActive(false);
        setIsConnecting(false);

        sessionPromiseRef.current?.then((session: any) => session.close());
        sessionPromiseRef.current = null;

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }
        if (outputGainNodeRef.current) {
            outputGainNodeRef.current.disconnect();
            outputGainNodeRef.current = null;
        }

        setInputAnalyserNode(null);
        setOutputAnalyserNode(null);

        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        playbackQueueRef.current.forEach(source => source.stop());
        playbackQueueRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);
    
    const endSession = useCallback(() => {
        cleanup();
    }, [cleanup]);

    const startSession = useCallback(async (agent: Agent) => {
        if (isSessionActive || isConnecting) return;

        const currentSessionId = Date.now();
        sessionIdRef.current = currentSessionId;

        setIsConnecting(true);
        setError(null);
        setTranscripts([]);
        isMicrophonePaused.current = false;

        try {
            if (!aiRef.current) {
                if (!process.env.API_KEY) {
                    throw new Error("API_KEY environment variable not set");
                }
                aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const outputGain = outputAudioContextRef.current.createGain();
            const outputAnalyser = outputAudioContextRef.current.createAnalyser();
            outputGain.connect(outputAnalyser);
            outputAnalyser.connect(outputAudioContextRef.current.destination);
            outputGainNodeRef.current = outputGain;
            setOutputAnalyserNode(outputAnalyser);
            
            const enabledTools: FunctionDeclaration[] = CRM_FUNCTION_DECLARATIONS.filter(
                (toolDef) => (agent.tools ?? []).includes(toolDef.name)
            );
            
            const callbacks: LiveCallbacks = {
                    onopen: () => {
                        if (sessionIdRef.current !== currentSessionId) return;
                        setIsConnecting(false);
                        setIsSessionActive(true);
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        sourceNodeRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        const inputAnalyser = inputAudioContextRef.current!.createAnalyser();
                        setInputAnalyserNode(inputAnalyser);
                        source.connect(inputAnalyser);
                        inputAnalyser.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            if (isMicrophonePaused.current) return;
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session: any) => {
                                if (sessionIdRef.current === currentSessionId) {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                }
                            });
                        };
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (sessionIdRef.current !== currentSessionId) return;

                        const handleTranscription = (role: 'user' | 'model', text: string, isFinal: boolean) => {
                            setTranscripts(prev => {
                                // FIX: Replace findLast with a reverse and find for broader compatibility.
                                const last = [...prev].reverse().find(t => t.role === role && !t.isFinal);
                                if (last) {
                                  return prev.map(t => t.id === last.id ? { ...last, text: last.text + text, isFinal } : t);
                                }
                                return [...prev, { id: Date.now() + Math.random(), role, text, isFinal }];
                            });
                        };
                        
                        if (message.serverContent?.inputTranscription) {
                            const transcription = message.serverContent.inputTranscription;
                            handleTranscription('user', transcription.text, (transcription as any).isFinal ?? false);
                        }
                        if (message.serverContent?.outputTranscription) {
                            const transcription = message.serverContent.outputTranscription;
                            handleTranscription('model', transcription.text, (transcription as any).isFinal ?? false);
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current && outputGainNodeRef.current) {
                            try {
                                const ctx = outputAudioContextRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                                const source = ctx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputGainNodeRef.current);
                                source.addEventListener('ended', () => playbackQueueRef.current.delete(source));
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                playbackQueueRef.current.add(source);
                            } catch (e) { console.error("Audio playback error:", e); }
                        }

                        if (message.serverContent?.interrupted) {
                            playbackQueueRef.current.forEach(source => source.stop());
                            playbackQueueRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }

                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result: any;
                                let logMessage: string | null = null;
                                try {
                                    switch(fc.name) {
                                        case 'getCurrentTimeAndDate':
                                            result = { dateTime: new Date().toLocaleString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
                                            logMessage = `Checked current time: ${result.dateTime}`;
                                            break;
                                        case 'getBookingDetailsByPnr':
                                            // FIX: Cast function call arguments to expected types.
                                            const pnrForGet = fc.args.pnr as string;
                                            result = crm.getBookingByPnr(pnrForGet) || { error: 'Booking not found.' };
                                            logMessage = result.error ? `CRM Search Failed for PNR ${pnrForGet}` : `CRM Searched for PNR ${pnrForGet}`;
                                            break;
                                        case 'createBooking':
                                            // FIX: Cast function call arguments to expected types.
                                            result = crm.addBooking(fc.args as Omit<Booking, 'id'>);
                                            logMessage = `CRM: Created new booking for PNR ${result.pnr}`;
                                            break;
                                        case 'updateBookingDetails':
                                            // FIX: Cast function call arguments to expected types.
                                            const pnrForUpdate = fc.args.pnr as string;
                                            const updates = fc.args.updates as Partial<Omit<Booking, 'id' | 'pnr'>>;
                                            result = crm.updateBooking(pnrForUpdate, updates) || { error: 'Update failed. Booking not found.' };
                                            logMessage = result.error ? `CRM Update Failed for PNR ${pnrForUpdate}` : `CRM: Updated booking for PNR ${pnrForUpdate}`;
                                            break;
                                        case 'deleteBookingByPnr':
                                            // FIX: Cast function call arguments to expected types.
                                            const pnrForDelete = fc.args.pnr as string;
                                            const success = crm.deleteBooking(pnrForDelete);
                                            result = { success };
                                            logMessage = success ? `CRM: Deleted booking for PNR ${pnrForDelete}` : `CRM Delete Failed for PNR ${pnrForDelete}`;
                                            break;
                                        case 'addNoteToBooking':
                                            // FIX: Cast function call arguments to expected types.
                                            const pnrForNote = fc.args.pnr as string;
                                            const note = fc.args.note as string;
                                            result = crm.addNoteToBooking(pnrForNote, note) || { error: 'Add note failed. Booking not found.' };
                                            logMessage = result.error ? `CRM Note Failed for PNR ${pnrForNote}` : `CRM: Added note to PNR ${pnrForNote}`;
                                            break;
                                        case 'sendEmail': {
                                            const to = fc.args.to as string;
                                            const subject = fc.args.subject as string;
                                            const body = fc.args.body as string;
                                            try {
                                                const emailResponse = await sendEmailViaGmail({ to, subject, body });
                                                result = { success: true, emailResponse };
                                                logMessage = `Email sent to ${to}`;
                                            } catch (emailError: any) {
                                                const message = emailError?.message ?? 'Unknown email error.';
                                                result = { error: message };
                                                logMessage = `Email failed for ${to}: ${message}`;
                                            }
                                            break;
                                        }
                                        default:
                                            result = { error: `Function ${fc.name} is not implemented.`};
                                    }
                                    if (logMessage) setActionLog(logMessage);
                                } catch (e: any) {
                                    result = { error: `Function execution failed: ${e.message}` };
                                    setActionLog(`Agent action failed: ${e.message}`);
                                }
                                
                                sessionPromiseRef.current?.then((session: any) => {
                                    if (sessionIdRef.current === currentSessionId) {
                                        session.sendToolResponse({
                                            functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                                        });
                                    }
                                });
                            }
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        if (sessionIdRef.current !== currentSessionId) return;
                        console.error("Live session error:", e);
                        setError(e.message || 'An unknown error occurred during the live session.');
                        cleanup();
                    },
                    onclose: (e: CloseEvent) => {
                        if (sessionIdRef.current !== currentSessionId) return;
                        if (!e.wasClean) {
                            setError(`Session closed unexpectedly (Code: ${e.code}).`);
                        }
                        cleanup();
                    }
                };

            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    contextWindowCompression: {
                        triggerTokens: '25600',
                        slidingWindow: { targetTokens: '12800' },
                    },
                    tools: [{ functionDeclarations: enabledTools }, { googleSearch: {} }],
                    systemInstruction: agent.systemPrompt,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks,
            });
        } catch (err: any) {
            console.error("Error starting live session:", err);
            setError(err.message || "Failed to start session.");
            cleanup();
        }
    }, [isSessionActive, isConnecting, cleanup, crm]);

    return {
        isSessionActive,
        isConnecting,
        error,
        transcripts,
        actionLog,
        startSession,
        endSession,
        pauseMicrophoneStream,
        resumeMicrophoneStream,
        inputAnalyserNode,
        outputAnalyserNode,
    };
};
