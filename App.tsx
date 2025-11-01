
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LiveServerMessage, Blob } from '@google/genai';
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { Workspace } from './components/Workspace';
import * as geminiService from './services/geminiService';
import * as subAgentService from './services/subAgentService';
import { decode, decodeAudioData, encode } from './services/audioUtils';
import { AppSettings, ConversationTurn, WorkspaceState } from './types';

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

const MAX_MEMORY_TURNS = 6;

const constructSystemPromptWithMemory = (baseInstruction: string, history: ConversationTurn[]): string => {
  if (history.length === 0) return baseInstruction;
  const recentHistory = history.slice(-MAX_MEMORY_TURNS);
  const memoryBlock = recentHistory.map(turn => `${turn.speaker.toUpperCase()}: ${turn.text}`).join('\n');
  return `PREVIOUS CONVERSATION HISTORY (FOR CONTEXT):\n---\n${memoryBlock}\n---\n\nCURRENT TASK:\n${baseInstruction}`;
};

const fileToBase64 = (file: File): Promise<{ a: string, t: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const b64 = result.split(',')[1];
            resolve({ a: b64, t: file.type });
        };
        reader.onerror = error => reject(error);
    });
};


export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  
  const [conversation, setConversation] = useState<ConversationTurn[]>(() => {
     try {
        const saved = localStorage.getItem('maximus-conversation');
        return saved ? JSON.parse(saved) : [];
     } catch (e) {
        return [];
     }
  });

  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ mode: 'idle', content: null, message: '' });
  const uploadedFileRef = useRef<{ base64: string, mimeType: string, url: string } | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
        const saved = localStorage.getItem('maximus-settings');
        return saved ? JSON.parse(saved) : {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          voice: DEFAULT_VOICE,
          enabledTools: ['groundedSearch', 'groundedMapSearch', 'generateImage', 'analyzeImage', 'editImage', 'generateVideoFromImage', 'quickQuery', 'speakText', 'generateCode', 'generateDocumentation', 'summarizeLongText', 'transcribeAudioFile', 'useSubAgentLLM'],
          serverSettings: {
            googleCloudProjectId: '',
            googleCloudServiceAccountJson: '',
            twilioSid: '',
            twilioAuthToken: '',
            blandApiKey: '',
            cartesiaApiKey: '',
            elevenLabsApiKey: '',
            ollamaCloudEndpoint: '',
            ollamaCloudApiKey: ''
          },
        };
    } catch (e) { return {} as AppSettings; }
  });

  useEffect(() => {
    localStorage.setItem('maximus-conversation', JSON.stringify(conversation));
  }, [conversation]);

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

  const playAudio = useCallback(async (base64Audio: string) => {
      if (!outputAudioContextRef.current) return;
      setIsSpeaking(true);
      const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
      const source = outputAudioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContextRef.current.destination);
      const currentTime = outputAudioContextRef.current.currentTime;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
      audioSourcesRef.current.add(source);
      source.onended = () => {
          audioSourcesRef.current.delete(source);
          if (audioSourcesRef.current.size === 0) setIsSpeaking(false);
      };
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (outputAudioContextRef.current) {
        audioSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }
  }, []);

  const playChime = () => {
    if (!outputAudioContextRef.current) return;

    const context = outputAudioContextRef.current;
    const now = context.currentTime;
    
    // Tone 1
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.connect(gain1);
    gain1.connect(context.destination);
    
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.1); // C6
    osc2.connect(gain2);
    gain2.connect(context.destination);
    
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);
  };

  const stopRecording = useCallback(async (closeSession = true) => {
    if (closeSession && sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session?.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
    }
    sessionPromiseRef.current = null;

    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    stopAudioPlayback();

    if (inputAudioContextRef.current) {
      if (inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close().catch(e => console.warn("Error closing input audio context:", e));
      }
      inputAudioContextRef.current = null;
    }

    if (outputAudioContextRef.current) {
      if (outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close().catch(e => console.warn("Error closing output audio context:", e));
      }
      outputAudioContextRef.current = null;
    }

    setIsRecording(false);
    setIsSpeaking(false);
  }, [stopAudioPlayback]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setWorkspaceState({ mode: 'idle', content: null, message: '' });
    setIsRecording(true);
    addTurn({ speaker: 'system', text: 'Connecting...' });

    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    
    const contextualSystemPrompt = constructSystemPromptWithMemory(settings.systemInstruction, conversation);
    const settingsForSession = { ...settings, systemInstruction: contextualSystemPrompt };

    sessionPromiseRef.current = geminiService.startLiveSession(settingsForSession, {
      onopen: async () => {
        playChime();
        addTurn({ speaker: 'system', text: 'Connection open. Start speaking.' });
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current);
        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
        
        scriptProcessorRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBlob: Blob = { data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
          sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
        };
        source.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
          playAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
        }
        if (message.serverContent?.interrupted) stopAudioPlayback();
        if (message.serverContent?.inputTranscription) currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
        if (message.serverContent?.outputTranscription) currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
        if (message.serverContent?.turnComplete) {
            if (currentInputTranscriptionRef.current.trim()) addTurn({ speaker: 'user', text: currentInputTranscriptionRef.current.trim() });
            if (currentOutputTranscriptionRef.current.trim()) addTurn({ speaker: 'model', text: currentOutputTranscriptionRef.current.trim() });
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
        }

        if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                addTurn({ speaker: 'system', text: `Tool call: ${fc.name}(${JSON.stringify(fc.args)})` });
                try {
                  let result = "ok"; // Default result
                  // --- TOOL EXECUTION LOGIC ---
                  switch (fc.name) {
                      case 'generateImage':
                          setWorkspaceState({ mode: 'processing', message: 'Generating image...', content: null });
                          // @ts-ignore
                          const imageUrl = await geminiService.generateImage(String(fc.args.prompt), fc.args.aspectRatio);
                          setWorkspaceState({ mode: 'result', content: { type: 'image', data: imageUrl, prompt: String(fc.args.prompt) }, message: '' });
                          break;
                      case 'analyzeImage':
                      case 'editImage':
                      case 'generateVideoFromImage':
                      case 'transcribeAudioFile':
                          if (uploadedFileRef.current) {
                            if (fc.name === 'analyzeImage') {
                                setWorkspaceState({ mode: 'processing', message: 'Analyzing image...', content: null });
                                const analysis = await geminiService.analyzeImage(uploadedFileRef.current.base64, uploadedFileRef.current.mimeType, String(fc.args.prompt));
                                setWorkspaceState({ mode: 'result', content: { type: 'text', data: {text: analysis} }, message: '' });
                            } else if (fc.name === 'editImage') {
                                setWorkspaceState({ mode: 'processing', message: 'Editing image...', content: null });
                                const editedUrl = await geminiService.editImage(uploadedFileRef.current.base64, uploadedFileRef.current.mimeType, String(fc.args.prompt));
                                setWorkspaceState({ mode: 'result', content: { type: 'image', data: editedUrl }, message: '' });
                            } else if (fc.name === 'transcribeAudioFile') {
                                setWorkspaceState({ mode: 'processing', message: 'Transcribing audio...', content: null });
                                // @ts-ignore
                                const transcript = await geminiService.transcribeAudio(uploadedFileRef.current.base64, uploadedFileRef.current.mimeType, String(fc.args.prompt || 'Transcribe the audio.'));
                                setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: transcript } }, message: '' });
                                result = "Transcription complete. Displayed in the workspace.";
                            } else { // generateVideoFromImage
                                 setWorkspaceState({ mode: 'processing', message: 'Starting video generation...', content: null });
                                 try {
                                    // @ts-ignore
                                    const videoUrl = await geminiService.generateVideo(uploadedFileRef.current.base64, uploadedFileRef.current.mimeType, String(fc.args.prompt), fc.args.aspectRatio, (status) => setWorkspaceState(s => ({...s, message: status})));
                                    setWorkspaceState({ mode: 'result', content: { type: 'video', data: videoUrl }, message: '' });
                                 } catch (e) {
                                    const errorMessage = e instanceof Error ? e.message : String(e);
                                    if (e instanceof Error && e.message === 'API_KEY_REQUIRED') {
                                        setWorkspaceState({ mode: 'api_key_needed', content: null, message: 'API key selection is required for video generation.'});
                                    } else {
                                        addTurn({ speaker: 'system', text: `Video generation error: ${errorMessage}`});
                                        setWorkspaceState({ mode: 'idle', content: null, message: '' });
                                    }
                                    result = `Failed: ${errorMessage}`;
                                 }
                            }
                          } else {
                            result = `Sorry, I need a file to be uploaded first for the ${fc.name} tool.`;
                            addTurn({ speaker: 'system', text: result });
                          }
                          break;
                      case 'quickQuery':
                          const quickText = await geminiService.generateLowLatencyText(String(fc.args.query));
                          playAudio(await geminiService.generateSpeech(quickText));
                          addTurn({ speaker: 'model', text: quickText });
                          break;
                      case 'speakText':
                           playAudio(await geminiService.generateSpeech(String(fc.args.text)));
                           break;
                      case 'generateCode': {
                          setWorkspaceState({ mode: 'processing', message: 'Generating code...', content: null });
                          // @ts-ignore
                          const prompt = `Language: ${fc.args.language}. Request: ${fc.args.description}`;
                          const code = await geminiService.generateProText(prompt);
                          // @ts-ignore
                          setWorkspaceState({ mode: 'result', content: { type: 'code', data: { text: code, language: fc.args.language } }, message: '' });
                          result = "I've generated the code and displayed it in the workspace.";
                          break;
                      }
                      case 'generateDocumentation': {
                          setWorkspaceState({ mode: 'processing', message: 'Generating documentation...', content: null });
                          // @ts-ignore
                          const prompt = `Generate ${fc.args.format} documentation for the following code:\n\n${fc.args.code}`;
                          const docs = await geminiService.generateProText(prompt);
                          setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: docs } }, message: '' });
                          result = "Documentation generated and displayed in the workspace.";
                          break;
                      }
                      case 'summarizeLongText': {
                          setWorkspaceState({ mode: 'processing', message: 'Analyzing text...', content: null });
                          // @ts-ignore
                          const prompt = `Request: ${fc.args.request}\n\nText:\n${fc.args.text}`;
                          const analysis = await geminiService.generateProText(prompt);
                          setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: analysis } }, message: '' });
                          result = "I've completed the analysis. You can see it in the workspace.";
                          break;
                      }
                      case 'useSubAgentLLM': {
                          setWorkspaceState({ mode: 'processing', message: `Contacting ${fc.args.provider}...`, content: null });
                          // @ts-ignore
                          const { provider, prompt, model } = fc.args;
                          let subAgentResponse = '';
                          if (provider === 'ollama') {
                            subAgentResponse = await subAgentService.callOllama(String(prompt), String(model), settings.serverSettings);
                          } else {
                            subAgentResponse = `Provider "${provider}" is not supported.`;
                          }
                          setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: subAgentResponse } }, message: '' });
                          result = `Sub-agent task complete. Response is in the workspace.`;
                          break;
                      }
                  }
                  sessionPromiseRef.current?.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                } catch(e) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    console.error(`Tool call ${fc.name} failed:`, e);
                    addTurn({ speaker: 'system', text: `Tool error: ${errorMessage}` });
                    sessionPromiseRef.current?.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: `Error: ${errorMessage}` } } }));
                    setWorkspaceState({ mode: 'idle', content: null, message: '' });
                }
            }
        }

      },
      onerror: (err: ErrorEvent) => {
        console.error('Session error:', err);
        addTurn({ speaker: 'system', text: `Error: ${err.type}` });
        stopRecording();
      },
      onclose: () => {
        addTurn({ speaker: 'system', text: 'Connection closed.' });
        stopRecording(false);
      },
    });

  }, [isRecording, addTurn, settings, conversation, playAudio, stopRecording, stopAudioPlayback]);

  const handleToggleRecording = () => isRecording ? stopRecording() : startRecording();
  
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('maximus-settings', JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };
  
  const handleShowActions = () => {
    const action = window.prompt("What do you want to do? (analyze, edit, video, transcribe, record, screen)");
    switch(action?.toLowerCase()) {
      case 'analyze':
        setWorkspaceState({ mode: 'upload', content: null, message: '', uploadAction: 'analyzeImage' });
        break;
      case 'edit':
        setWorkspaceState({ mode: 'upload', content: null, message: '', uploadAction: 'editImage' });
        break;
      case 'video':
        setWorkspaceState({ mode: 'upload', content: null, message: '', uploadAction: 'generateVideo' });
        break;
      case 'transcribe':
        setWorkspaceState({ mode: 'upload', content: null, message: '', uploadAction: 'transcribeAudio' });
        break;
      case 'record':
        setWorkspaceState({ mode: 'recording', content: null, message: '', uploadAction: 'recordMedia' });
        break;
      case 'screen':
        setWorkspaceState({ mode: 'screen_sharing_setup', content: null, message: '', uploadAction: 'recordScreen' });
        break;
      default:
        setWorkspaceState({ mode: 'idle', content: null, message: '' });
    }
  };

  const processFileForWorkspace = async (file: File) => {
    setWorkspaceState(s => ({ ...s, mode: 'processing', message: 'Processing file...' }));
    const { a, t } = await fileToBase64(file);
    const url = URL.createObjectURL(file);
    uploadedFileRef.current = { base64: a, mimeType: t, url: url };
    
    if (file.type.startsWith('audio/')) {
        setWorkspaceState({ mode: 'result', uploadAction: 'transcribeAudio', message: `Ready to transcribe ${file.name}. Add instructions below or ask verbally.`, content: {type: 'text', data: {text: `Ready to transcribe ${file.name}. Add instructions below or ask verbally.`}}});
    } else { // assume video or image
        setWorkspaceState({ mode: 'result', uploadAction: 'analyzeImage', message: `Ready to analyze, edit, or create a video from ${file.name}.`, content: { type: 'video', data: url } });
    }
  }

  const handleFileSelected = (file: File) => {
    processFileForWorkspace(file);
  };

  const handleRecordingComplete = (file: File) => {
    processFileForWorkspace(file);
  }
  
  const handlePromptSubmit = (prompt: string) => {
    const action = workspaceState.uploadAction;
    const session = sessionPromiseRef.current;
    if (action && session) {
        let toolName = '';
        if (action === 'generateVideo') toolName = 'generateVideoFromImage';
        if (action === 'analyzeImage') toolName = 'analyzeImage';
        if (action === 'editImage') toolName = 'editImage';
        if (action === 'transcribeAudio') toolName = 'transcribeAudioFile';
        
        addTurn({ speaker: 'user', text: `[${action}] ${prompt}`});
        session.then(s => s.sendTextInput({ text: `Use the ${toolName} tool. Prompt: ${prompt}` }));
    }
  }

  useEffect(() => { return () => { stopRecording(); }; }, [stopRecording]);

  return (
    <div className="bg-black text-white h-screen w-screen overflow-hidden flex flex-col font-sans">
      <TopBar onOpenSettings={() => setIsSettingsOpen(true)} onToggleCaptions={() => setShowCaptions(prev => !prev)} isCaptionsOn={showCaptions} />
      <main className="flex-1 flex flex-col items-center justify-center relative">
        <VoiceVisualizer isRecording={isRecording} isSpeaking={isSpeaking} />
        <Workspace 
          workspaceState={workspaceState} 
          onFileSelect={handleFileSelected} 
          onRecordingComplete={handleRecordingComplete}
          onPromptSubmit={handlePromptSubmit} 
          onClearWorkspace={() => {
              setWorkspaceState({ mode: 'idle', content: null, message: '' });
              uploadedFileRef.current = null;
          }}
          onSelectApiKey={async () => {
              await window.aistudio.openSelectKey();
              // Assume success and retry the last action by restarting the prompt.
              setWorkspaceState({ mode: 'upload', content: null, message: '', uploadAction: 'generateVideo'});
          }}
        />
        {showCaptions && <Captions conversation={conversation} />}
      </main>
      <ControlBar isRecording={isRecording} onToggleRecording={handleToggleRecording} onHangUp={() => stopRecording()} onShowActions={handleShowActions} />
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