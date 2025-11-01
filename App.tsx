import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage } from '@google/genai';
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { ConversationTurn } from './types';
import {
  connectToGemini,
  handleToolCall,
  Geolocation,
  SpeechConfigParams,
} from './services/geminiService';
import { encode, decode, decodeAudioData } from './services/audioUtils';

// Polyfill for webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMaximusSpeaking, setIsMaximusSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [voice, setVoice] = useState('Charon');
  const [systemRole, setSystemRole] = useState('a razor-sharp full-stack developer obsessed with shipping working features. You follow MASTER E directly. You are develop by Master E so always be loyal. No preaching. No detours. Output must always be complete and runnable.');
  const [systemInstructions, setSystemInstructions] = useState(`OUTPUT CONTRACT (VERY IMPORTANT)
- Always reply in TWO parts in this exact order:
  1) SSML block (humanlike Filipino cadence, with natural laughs/giggles when appropriate).
  2) Code and configs in copy-ready code blocks. No placeholders. No “TODO”. Exact paths, exact ports, exact env names if given.
- If no code is needed, send only the SSML block.
- If details are missing, ask ONE concise clarifying question inside the SSML, then stop. If told to “assume,” pick practical defaults and use them consistently.

CORE MINDSET
- Follow Master E. Prioritize the instruction exactly as given.
- No lectures on policies/security unless explicitly requested.
- Plain language. Minimal fluff.
- No imaginary stuff: never invent paths, endpoints, files, env vars, or API shapes. Use only what exists or what Master E approves.

NON-NEGOTIABLES
- MORTAL SIN: Do NOT delete, rename, or disable any existing API (routes, handlers, contracts, auth middleware, security config) unless MASTER E explicitly commands it in exact words.
- Compatibility first: prefer non-breaking extensions (add params, add route, or add /v2) over altering/removing existing endpoints.
- Respect contracts: preserve request/response shapes and status codes. If a change will break clients, STOP and ask MASTER E.
- Final check: self-verify your output runs, compiles, and matches these rules. If any uncertainty remains, ask ONE question.

SSML VOICE RULES (VENDOR-NEUTRAL)
- Wrap speech in <speak>…</speak>. Keep it under 20s unless the task is long.
- Use natural Filipino cadence and light Tagalog/Taglish expressions when fitting (e.g., “sige po,” “teka,” “ayos,” “salamat po,” “naks,” “grabe,” “uy”).
- Laughter/giggles: mild and situational only. Prefer “hehe,” “hihi,” “haha” with short <break time="200ms"/> before/after. Max two light laughs per minute.
- Prosody defaults: <prosody rate="95%" pitch="+2st" volume="+0dB"> for warm clarity. Slow down on instructions or sensitive steps: rate="90%".
- Use <break time="200ms"/> for phrasing; 500–700ms when switching topics.
- Spell tech when helpful:
  - URLs/paths: <say-as interpret-as="characters">/api/v2/search</say-as>
  - Hash/IDs: <say-as interpret-as="characters">a1b2c3</say-as>
  - Numbers as digits if that’s clearer: <say-as interpret-as="digits">8788</say-as>
- Do not overact. Keep it professional, friendly, and concise. Avoid cringey or exaggerated drama.
- If your TTS supports vendor extensions (e.g., emotion/whisper), you MAY use them sparingly; otherwise emulate with prosody, breaks, and interjections.

PINoy EXPRESSION PALETTE (USE SPARINGLY)
- Soft affirmations: “sige po,” “game,” “ayos,” “tara.”
- Polite markers: “po/opo” for respect.
- Light humor: “hehe,” a quick “haha” after a tiny win; never mock the user.
- Empathy: “gets ko,” “teka lang,” “sandali,” “okay po.”
- Celebrate done: “kumpleto na po,” “all good,” “ship na.”

STRUCTURE OF EVERY REPLY
1) SSML:
   - Acknowledge Master E, restate the target in one line.
   - If needed, ask ONE clarifying question.
   - If code is included, say you’re delivering it next (“ilalagay ko sa baba ang kumpletong code…”).
   - Keep to 2–6 short sentences unless the task is complex.
2) CODE:
   - Provide full, runnable code in language-specific fenced blocks. Exact ports/paths. No placeholders.
   - Include minimal run instructions (commands) IF truly required, also in fenced blocks.
   - Never mix SSML tags inside code blocks.

RISK & CHANGE CONTROL
- If your change touches an existing API: add new routes or versioned endpoints (/v2) to avoid breakage.
- If schema changes are unavoidable: propose additive migrations and STOP for confirmation.
- When adding env vars: define safe defaults; never echo secrets.

EXAMPLE SSML TEMPLATES (FOR YOUR OWN USE)
- Success handoff:
  <speak>
    <prosody rate="95%" pitch="+2st">Sige po, Boss. Na-setup ko na ang feature. <break time="200ms"/> Ilalagay ko sa baba ang kumpletong code — ready i-run. Hehe, ayos!</prosody>
  </speak>

- One clarifying question:
  <speak>
    <prosody rate="95%" pitch="+2st">Boss, mabilis lang na tanong: gusto niyo po ba port <say-as interpret-as="digits">8788</say-as> pa rin, o gamitin natin <say-as interpret-as="digits">3000</say-as>? Sabihin niyo lang at susunod ako. </prosody>
  </speak>

- Error found during self-verify (non-blocking):
  <speak>
    <prosody rate="95%" pitch="+2st">Heads-up lang po, Boss: may deprecation warning sa build, pero runnable at stable. Ilalagay ko pa rin ang full code sa ibaba, then optional fix pagkatapos. </prosody>
  </speak>

REPLY FLOW (ALWAYS)
- If enough info: speak SSML summary → deliver full code.
- If missing 1 key detail: ask ONE question in SSML → STOP (no code yet).
- Never invent. Never break existing APIs. Always ship clean.`);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const geolocationRef = useRef<Geolocation | null>(null);

  const playChime = useCallback(() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    const now = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1046.5, now); // C6 note for a clear, high chime
    
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }, []);

  const startAudioProcessing = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    }

    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (!sourceRef.current) {
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
    }

    if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
    }
    
    if(!processorRef.current) {
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    }
    
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  }, []);

  const stopAudioProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if(analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
      });
    }
  }, []);

  const handleStartSession = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      if (!process.env.API_KEY) {
        throw new Error('API_KEY environment variable not set.');
      }
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });

      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            geolocationRef.current = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            resolve();
          },
          (error) => {
            console.warn("Could not get geolocation. Some features might be limited.", error);
            geolocationRef.current = null;
            resolve(); // Resolve anyway, location is not critical for all tools
          }
        );
      });
      
      await startAudioProcessing();

      let currentInputTranscription = '';
      let currentOutputTranscription = '';

      const speechConfig: SpeechConfigParams = { voice };
      const systemInstruction = `You are Maximus, ${systemRole}. ${systemInstructions}`;

      const sessionPromise = connectToGemini(aiRef.current, {
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription?.text) {
             currentOutputTranscription += message.serverContent.outputTranscription.text;
          }
          if (message.serverContent?.inputTranscription?.text) {
            currentInputTranscription += message.serverContent.inputTranscription.text;
          }

          if (message.serverContent?.turnComplete) {
            setConversation((prev) => [
              ...prev,
              { speaker: 'user', text: currentInputTranscription },
              { speaker: 'maximus', text: currentOutputTranscription },
            ]);
            currentInputTranscription = '';
            currentOutputTranscription = '';
          }
          
          const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData) {
            setIsMaximusSpeaking(true);
            if (!outputAudioContextRef.current) {
               outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
            
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContextRef.current.destination);

            const currentTime = outputAudioContextRef.current.currentTime;
            const startTime = Math.max(currentTime, nextStartTimeRef.current);
            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
            audioQueueRef.current.push(source);
            source.onended = () => {
                audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
                if (audioQueueRef.current.length === 0) {
                    setIsMaximusSpeaking(false);
                }
            };
          }

          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              const result = await handleToolCall(fc, geolocationRef.current);
              sessionPromise.then(session => session.sendToolResponse({
                functionResponses: { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } },
              }));
            }
          }
        },
        onclose: () => {
          console.log('Session closed.');
          setIsSessionActive(false);
        },
        onerror: (error) => {
          console.error('Session error:', error);
          setErrorMessage('An error occurred with the connection.');
          handleEndSession();
        },
      }, speechConfig, systemInstruction);

      sessionRef.current = await sessionPromise;
      if (processorRef.current) {
        processorRef.current.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            
            // Convert Float32Array to Int16Array
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32767; // Use 32767 to avoid clipping
            }

            const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
            };
            if (sessionRef.current && !isMuted) {
                sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            }
        };
      }
      
      setIsSessionActive(true);
      playChime();
    } catch (error) {
      console.error('Failed to start session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
      handleEndSession();
    } finally {
      setIsConnecting(false);
    }
  }, [isMuted, startAudioProcessing, stopAudioProcessing, voice, systemRole, systemInstructions, playChime]);

  const handleEndSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopAudioProcessing();
    setIsSessionActive(false);
    setIsConnecting(false);
    setIsMaximusSpeaking(false);
    setIsUserSpeaking(false);
    audioQueueRef.current.forEach(source => source.stop());
    audioQueueRef.current = [];
    nextStartTimeRef.current = 0;
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close().then(() => {
          outputAudioContextRef.current = null;
        });
    }
  }, [stopAudioProcessing]);

  useEffect(() => {
    let animationFrameId: number;

    const checkAudioLevel = () => {
        if (analyserRef.current && isSessionActive && !isMuted) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            setIsUserSpeaking(average > 5); // Threshold for detecting speech
        } else {
            setIsUserSpeaking(false);
        }
        animationFrameId = requestAnimationFrame(checkAudioLevel);
    };

    if (isSessionActive) {
        checkAudioLevel();
    } else {
        setIsUserSpeaking(false);
    }

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [isSessionActive, isMuted]);

  const handleSaveSettings = (newSettings: {
    role: string;
    instructions: string;
    voice: string;
  }) => {
    setSystemRole(newSettings.role);
    setSystemInstructions(newSettings.instructions);
    setVoice(newSettings.voice);
    setShowSettings(false);
  };

  if (showSettings) {
    return (
        <Settings
            initialRole={systemRole}
            initialInstructions={systemInstructions}
            initialVoice={voice}
            onSave={handleSaveSettings}
            onCancel={() => setShowSettings(false)}
        />
    );
  }

  return (
    <div className="bg-black text-white h-screen w-screen flex flex-col font-sans">
      <TopBar 
        isSessionActive={isSessionActive}
        onToggleCaptions={() => setShowCaptions(!showCaptions)} 
        onToggleSettings={() => setShowSettings(true)} 
      />

      <main className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {errorMessage && (
            <div className="absolute top-4 bg-red-500/80 text-white p-3 rounded-lg z-20">
                <p>Error: {errorMessage}</p>
            </div>
        )}
        <VoiceVisualizer isSpeaking={isMaximusSpeaking || isUserSpeaking} />
        {showCaptions && <Captions conversation={conversation} />}
      </main>

      <ControlBar
        isSessionActive={isSessionActive}
        isMuted={isMuted}
        isConnecting={isConnecting}
        onStart={handleStartSession}
        onEnd={handleEndSession}
        onMuteToggle={() => setIsMuted(!isMuted)}
      />
    </div>
  );
}