import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LiveServerMessage, LiveSession, Blob } from '@google/genai';
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { Workspace } from './components/Workspace';
import { startLiveSession } from './services/geminiService';
import { decode, decodeAudioData, encode } from './services/audioUtils';
import { AppSettings, ConversationTurn } from './types';

const DEFAULT_ROLE = "a friendly and helpful assistant.";
const DEFAULT_INSTRUCTIONS = "Keep your responses concise and to the point. Be polite and professional.";
const DEFAULT_VOICE = 'Zephyr';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
        const savedSettings = localStorage.getItem('maximus-settings');
        if (savedSettings) {
        return JSON.parse(savedSettings);
        }
    } catch (e) {
        console.error("Could not parse settings from localStorage", e);
    }
    return {
      role: DEFAULT_ROLE,
      instructions: DEFAULT_INSTRUCTIONS,
      voice: DEFAULT_VOICE,
      enabledTools: ['getWeather', 'getStockPrice'],
      serverSettings: {
        twilioSid: '',
        twilioAuthToken: '',
        blandApiKey: '',
        cartesiaApiKey: '',
        elevenLabsApiKey: '',
        ollamaCloudEndpoint: '',
        ollamaCloudApiKey: '',
      },
    };
  });

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const addTurn = useCallback((turn: Omit<ConversationTurn, 'timestamp'>) => {
    setConversation(prev => [...prev, { ...turn, timestamp: Date.now() }]);
  }, []);

  const stopAudioPlayback = () => {
    if (outputAudioContextRef.current) {
        audioSourcesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Ignore errors from stopping already stopped sources
            }
        });
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }
  };

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setIsRecording(true);
    addTurn({ speaker: 'system', text: 'Connecting...' });

    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    
    sessionPromiseRef.current = startLiveSession(settings, {
      onopen: async () => {
        addTurn({ speaker: 'system', text: 'Connection open. Start speaking.' });
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current);
        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
        
        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const l = inputData.length;
          const int16 = new Int16Array(l);
          for (let i = 0; i < l; i++) {
            int16[i] = inputData[i] * 32768;
          }

          const pcmBlob: Blob = {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
          };
          if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          }
        };
        
        source.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
          setIsSpeaking(true);
          const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
          const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            outputAudioContextRef.current!,
            24000,
            1,
          );
          const source = outputAudioContextRef.current!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputAudioContextRef.current!.destination);

          const currentTime = outputAudioContextRef.current!.currentTime;
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
          
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          audioSourcesRef.current.add(source);
          source.onended = () => {
            audioSourcesRef.current.delete(source);
            if (audioSourcesRef.current.size === 0) {
              setIsSpeaking(false);
            }
          };
        }

        if (message.serverContent?.interrupted) {
          stopAudioPlayback();
        }

        if (message.serverContent?.inputTranscription) {
            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
        }

        if (message.serverContent?.outputTranscription) {
            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
        }

        if (message.serverContent?.turnComplete) {
            if (currentInputTranscriptionRef.current.trim()) {
                addTurn({ speaker: 'user', text: currentInputTranscriptionRef.current.trim() });
            }
            if (currentOutputTranscriptionRef.current.trim()) {
                addTurn({ speaker: 'model', text: currentOutputTranscriptionRef.current.trim() });
            }
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
        }

        if (message.toolCall) {
            message.toolCall.functionCalls.forEach(fc => {
                addTurn({ speaker: 'system', text: `Tool call: ${fc.name}(${JSON.stringify(fc.args)})` });
                // In a real app, you would execute the function here and send back the result.
                // For this demo, we'll just send a generic success response.
                const result = "ok";
                sessionPromiseRef.current?.then(session => {
                    session.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: result } }
                    });
                });
            });
        }

      },
      onerror: (err) => {
        console.error('Session error:', err);
        addTurn({ speaker: 'system', text: `Error: ${err.type}` });
        stopRecording();
      },
      onclose: () => {
        addTurn({ speaker: 'system', text: 'Connection closed.' });
        stopRecording(false); // Don't try to close session again
      },
    });

  }, [isRecording, addTurn, settings]);

  const stopRecording = useCallback(async (closeSession = true) => {
    if (!isRecording && !sessionPromiseRef.current) return;
    
    if (closeSession && sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Failed to close session gracefully:", e);
      }
    }
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    if (inputAudioContextRef.current?.state !== 'closed') {
      inputAudioContextRef.current?.close().catch(console.error);
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close().catch(console.error);
    }

    stopAudioPlayback();
    
    sessionPromiseRef.current = null;
    setIsRecording(false);
    setIsSpeaking(false);
  }, [isRecording]);

  const handleToggleRecording = () => {
    if (isRecording) {
      // In this new UI, the mic button is a toggle, not a stop button.
      // To stop the whole session, the user should press the 'X' button.
      // We can implement mute functionality here later. For now, it does nothing if already recording.
    } else {
      startRecording();
    }
  };
  
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('maximus-settings', JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return (
    <div className="bg-black text-white h-screen w-screen overflow-hidden flex flex-col font-sans">
      <TopBar 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleCaptions={() => setShowCaptions(prev => !prev)}
        isCaptionsOn={showCaptions}
      />

      <main className="flex-1 flex flex-col items-center justify-center relative">
        <VoiceVisualizer isRecording={isRecording} isSpeaking={isSpeaking} />
        <Workspace />
        {showCaptions && <Captions conversation={conversation} />}
      </main>

      <ControlBar
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        onHangUp={() => stopRecording()}
      />
      
      {isSettingsOpen && (
        <Settings
          initialRole={settings.role}
          initialInstructions={settings.instructions}
          initialVoice={settings.voice}
          initialEnabledTools={settings.enabledTools}
          initialServerSettings={settings.serverSettings}
          onSave={handleSaveSettings}
          onCancel={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}