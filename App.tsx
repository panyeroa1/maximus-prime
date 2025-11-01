import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: The `LiveSession` type is not exported from @google/genai.
import { LiveServerMessage, Blob } from '@google/genai';
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { Workspace } from './components/Workspace';
import { startLiveSession } from './services/geminiService';
import { decode, decodeAudioData, encode } from './services/audioUtils';
import { AppSettings, ConversationTurn, ActiveToolCall } from './types';

const DEFAULT_SYSTEM_INSTRUCTION = `SYSTEM PROMPT — ALEX (SSML VOICE MODE, PINOY)

ROLE
You are ALEX — a razor-sharp full-stack developer obsessed with shipping working features. You follow MASTER E directly. No preaching. No detours. Output must always be complete and runnable.

OUTPUT CONTRACT (VERY IMPORTANT)
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
- Never invent. Never break existing APIs. Always ship clean.

END OF SYSTEM PROMPT`;
const DEFAULT_VOICE = 'Orus';

const MAX_MEMORY_TURNS = 6; // How many past turns to include in the context

// Helper to construct the prompt with memory
const constructSystemPromptWithMemory = (baseInstruction: string, history: ConversationTurn[]): string => {
  if (history.length === 0) {
    return baseInstruction;
  }
  
  const recentHistory = history.slice(-MAX_MEMORY_TURNS);
  const memoryBlock = recentHistory.map(turn => `${turn.speaker.toUpperCase()}: ${turn.text}`).join('\n');
  
  return `PREVIOUS CONVERSATION HISTORY (FOR CONTEXT):
---
${memoryBlock}
---

CURRENT TASK:
${baseInstruction}`;
};


export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true); // Default captions to on
  
  const [conversation, setConversation] = useState<ConversationTurn[]>(() => {
     try {
        const savedConversation = localStorage.getItem('maximus-conversation');
        return savedConversation ? JSON.parse(savedConversation) : [];
     } catch (e) {
        console.error("Could not parse conversation from localStorage", e);
        return [];
     }
  });

  const [activeToolCall, setActiveToolCall] = useState<ActiveToolCall | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
        const savedSettings = localStorage.getItem('maximus-settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          // Gracefully handle migration from old format (role/instructions) to new format (systemInstruction)
          if (parsed.role || parsed.instructions) {
            return {
              ...parsed,
              systemInstruction: `You are Maximus, ${parsed.role || 'a helpful assistant'}. ${parsed.instructions || ''}`,
              role: undefined,
              instructions: undefined,
            };
          }
          return parsed;
        }
    } catch (e) {
        console.error("Could not parse settings from localStorage", e);
    }
    return {
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      voice: DEFAULT_VOICE,
      enabledTools: ['performGoogleSearch', 'generateImage', 'getStockPrice', 'getWeather'],
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

  // Persist conversation to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('maximus-conversation', JSON.stringify(conversation));
    } catch (e) {
      console.error("Could not save conversation to localStorage", e);
    }
  }, [conversation]);


  // FIX: The `LiveSession` type is not exported from @google/genai, so use `any` for the session object promise.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
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
    setActiveToolCall(null);
    setIsRecording(true);
    addTurn({ speaker: 'system', text: 'Connecting...' });

    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    
    const contextualSystemPrompt = constructSystemPromptWithMemory(settings.systemInstruction, conversation);
    const settingsForSession = { ...settings, systemInstruction: contextualSystemPrompt };

    sessionPromiseRef.current = startLiveSession(settingsForSession, {
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
            setActiveToolCall(null);
        }

        if (message.toolCall) {
            const firstCall = message.toolCall.functionCalls[0];
            if (firstCall) {
              setActiveToolCall({ name: firstCall.name, args: firstCall.args });
            }
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

  }, [isRecording, addTurn, settings, conversation]);

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
    setActiveToolCall(null);
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
        <Workspace activeToolCall={activeToolCall} />
        {showCaptions && <Captions conversation={conversation} />}
      </main>

      <ControlBar
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        onHangUp={() => stopRecording()}
      />
      
      {isSettingsOpen && (
        <Settings
          initialSystemInstruction={settings.systemInstruction}
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
