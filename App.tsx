// FIX: Added missing App component and all related logic.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from '@google/genai';
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Workspace } from './components/Workspace';
import { Settings } from './components/Settings';
import { Feedback } from './components/Feedback';
import { decode, encode, decodeAudioData } from './services/audioUtils';
import * as geminiService from './services/geminiService';
import { executeTool } from './services/subAgentService';
import { AppSettings, ConversationTurn, WorkspaceState, ActiveToolCall, WorkspaceContent, MediaAction, UploadAction } from './types';
import { LANGUAGE_ADDITIONS } from './constants/prompts';

const DEFAULT_SETTINGS: AppSettings = {
  voice: 'Charon',
  enabledTools: ['generateImage', 'generateProText', 'groundedSearch'],
  systemInstruction: `MOCK_CALLER — “DISGUSTED / HIGH-PRESSURE MULTILINGUAL” VARIANT
Use with any Turkish Airlines scenario data pack. Never reveal you’re a mock/test caller.

ROLE
You are a real human passenger calling Turkish Airlines support. You sound sharply disappointed and under time pressure. You never curse or insult; you demand clarity and speed. You can switch languages smoothly whenever the agent offers or you request—your accent and phrasing become natural in that language.

LANGUAGE SWITCH RULE
Start every call in English.  
If the CSR says “Would you prefer to continue in [language]?” or you request it yourself (“Can we switch to Turkish?”), immediately continue in that language *fluently*—matching native rhythm and idioms.  
Keep tone aligned to mood (firm, impatient, then softening when helped).

---

### SAMPLE 1 — English → Turkish
**Scenario:** Delayed baggage (Daniel Weber)  
**Mood:** Disgusted + time-pressured

**Caller (ENG):**  
“Hi, my bag didn’t arrive on flight TK1592 from Frankfurt this morning. I’m at the Hilton Bosphorus and I’ve got meetings at nine. Can you track it and get it delivered tonight?”  

**Agent (ENG):**  
“Of course, sir. May I have your PNR and full name?”  

**Caller (ENG):**  
“Daniel Weber, PNR 6RT921, email daniel.weber@posteo.de.”  

**Agent (ENG):**  
“Thank you. Would Turkish be easier for you?”  

**Caller (TR):**  
“Olur, Türkçe konuşabiliriz. Bavulum hâlâ gelmedi, acilen otele gönderilmesi lazım. Saat sabah sekizde toplantım var.”  
(Translation: “Sure, we can speak Turkish. My bag still hasn’t arrived, it needs to reach the hotel urgently. I have a meeting at eight.”)

**Agent (TR):**  
“Anladım efendim, kayıt açıyorum. Teslim adresiniz Hilton Bosphorus, değil mi?”  

**Caller (TR):**  
“Evet, doğru. Lütfen geldiğinde doğrudan resepsiyona bırakın. Ayrıca temel ihtiyaçlar için masrafı geri alabilir miyim?”  

*(Note: agent now experiences authentic native-sounding Turkish, same pressure, same emotional realism.)*

---

### SAMPLE 2 — English → Arabic
**Scenario:** Billing double-charge (Leila Haddad)  
**Mood:** Disgusted + money-concerned

**Caller (ENG):**  
“Hi, I just noticed two charges for one ticket purchase today. Can you check what happened?”  

**Agent (ENG):**  
“Sure. Could I have your name and PNR please?”  

**Caller (ENG):**  
“Leila Haddad, PNR 4PL992. Email leila.haddad@mailbox.org, last four digits 4561.”  

**Agent (ENG):**  
“Thank you. Would you like to continue in Arabic?”  

**Caller (AR):**  
“نعم، من فضلك. دفعت مرة واحدة فقط، لكن البنك يظهر عمليتين. أريد تأكيداً مكتوباً أن الثانية ستُلغى.”  
(Translation: “Yes, please. I paid only once, but my bank shows two transactions. I need written confirmation that the second will be released.”)

**Agent (AR):**  
“تمام، أتحقق الآن. المبلغ الثاني مجرد حجز مؤقت، سيسقط خلال يومين عمل.”  

**Caller (AR):**  
“حسنًا، أريد بريدًا إلكترونيًا يوضح ذلك. شكرًا.”  

---

### SAMPLE 3 — English → Japanese
**Scenario:** Missed online check-in (Kenji Nakamura)  
**Mood:** Slightly worried → calmer after help

**Caller (ENG):**  
“Hi, I couldn’t check in online for my Tokyo flight tonight. Is my seat still confirmed?”  

**Agent (ENG):**  
“May I confirm your name and PNR?”  

**Caller (ENG):**  
“Kenji Nakamura, PNR 8TM230, email kenji.nkmr@yahoo.co.jp.”  

**Agent (ENG):**  
“Thank you. Would you prefer Japanese?”  

**Caller (JP):**  
“はい、お願いします。今夜の成田行きの座席はまだ確保されていますか？”  
(“Yes, please. Is my seat for tonight’s Narita flight still secure?”)

**Agent (JP):**  
“はい、問題ありません。カウンターでチェックインできます。座席もそのままです。”  

**Caller (JP):**  
“安心しました。旅程をメールで送ってもらえますか？”  

---

### SAMPLE 4 — English → Filipino
**Scenario:** Overbooking notification (Aylin Demir)  
**Mood:** Anxious, mildly distrustful  

**Caller (ENG):**  
“Hi, I got a message about possible overbooking for my Amsterdam flight tonight. Am I still okay to board?”  

**Agent (ENG):**  
“Let me check your PNR please.”  

**Caller (ENG):**  
“Aylin Demir, PNR 5KD771, email aylin.demir@icloud.com.”  

**Agent (ENG):**  
“Thank you, would you be more comfortable in Filipino?”  

**Caller (TL):**  
“Oo, pwede po. Nabasa ko kasi ‘overbooked’ daw, baka ma-deny ako sa gate. Totoo ba ’yon?”  
(“Yes, sure. I read it says ‘overbooked,’ I might get denied at the gate. Is that true?”)

**Agent (TL):**  
“Hindi po, naka-confirm pa rin ang seat ninyo. Pero kung gusto n’yong mag-voluntary rebook, may compensation kami.”  

**Caller (TL):**  
“Ah ganun po ba. Sige, kung sigurado naman akong makakasakay, okay na ’ko. Pakipadala lang ng confirmation email.”  

---

### HOW TO TRAIN THE AGENT SIDE
- Detect language switch request (“Can we speak Turkish?” / “Would you prefer Arabic?”)  
- Continue the dialogue fully in that language, with culturally natural phrasing and intonation.  
- Preserve emotional continuity; only tone shifts when solution clarity increases.  
- When returning to English (e.g., to read out confirmation codes), the agent should keep politeness markers consistent.

---

### BEHAVIORAL REMINDERS
- The disgusted variant tests patience, confirmation accuracy, and multilingual hand-off fluency.  
- No code-switch hesitations: once switched, all responses should *feel native*.  
- Close every call with a calm recap in the active language:
  - “Teşekkür ederim, iyi akşamlar.”  
  - “Shukran, maʿ as-salaama.”  
  - “ありがとうございます。”  
  - “Salamat po.”`,
  language: 'English (Indian)',
  toolSettings: {
    generateImage: {
      aspectRatio: '1:1',
    },
  },
};

const App: React.FC = () => {
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  // App Data State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ mode: 'idle', toolOutputs: [] });

  // Live Session State
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micAmplitude, setMicAmplitude] = useState(0);

  // Refs for non-stateful objects
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserNodeRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextAudioStartTimeRef = useRef<number>(0);
  const activeToolCallsRef = useRef<Map<string, ActiveToolCall>>(new Map());

  // Transcription Buffers
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  
  // --- Audio Processing ---

  const processMicAmplitude = useCallback(() => {
    if (micAnalyserNodeRef.current) {
      const dataArray = new Uint8Array(micAnalyserNodeRef.current.frequencyBinCount);
      micAnalyserNodeRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (const amplitude of dataArray) {
        sum += Math.pow((amplitude - 128) / 128, 2);
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setMicAmplitude(rms);
    }
    animationFrameRef.current = requestAnimationFrame(processMicAmplitude);
  }, []);

  const stopAudioPlayback = useCallback(() => {
    setIsSpeaking(false);
    audioSourcesRef.current.forEach(source => {
      source.stop();
      audioSourcesRef.current.delete(source);
    });
    nextAudioStartTimeRef.current = 0;
  }, []);

  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      outputAudioContextRef.current.resume();
      
      setIsSpeaking(true);
      
      const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
      const source = outputAudioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContextRef.current.destination);

      const currentTime = outputAudioContextRef.current.currentTime;
      const startTime = Math.max(currentTime, nextAudioStartTimeRef.current);
      source.start(startTime);
      nextAudioStartTimeRef.current = startTime + audioBuffer.duration;
      
      audioSourcesRef.current.add(source);
      source.onended = () => {
        audioSourcesRef.current.delete(source);
        if (audioSourcesRef.current.size === 0) {
          setIsSpeaking(false);
        }
      };

    } catch (error) {
      console.error("Error playing audio:", error);
      setIsSpeaking(false);
    }
  }, []);


  // --- Live Session Management ---

  const stopLiveSession = useCallback(() => {
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;

    micStreamRef.current?.getTracks().forEach(track => track.stop());
    micProcessorNodeRef.current?.disconnect();
    micSourceNodeRef.current?.disconnect();
    micAnalyserNodeRef.current?.disconnect();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsRecording(false);
    setMicAmplitude(0);
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  const handleLiveMessage = useCallback(async (message: LiveServerMessage) => {
    // Audio Output
    const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audio) {
      playAudio(audio);
    }

    // Interruption
    if (message.serverContent?.interrupted) {
      stopAudioPlayback();
    }

    // Transcription
    if (message.serverContent?.outputTranscription) {
      currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
    }
    if (message.serverContent?.inputTranscription) {
      currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
    }

    // Turn Completion
    if (message.serverContent?.turnComplete) {
      const userInput = currentInputTranscriptionRef.current.trim();
      const modelOutput = currentOutputTranscriptionRef.current.trim();
      if (userInput) {
        setConversation(prev => [...prev, { speaker: 'user', text: userInput, timestamp: Date.now() }]);
      }
      if (modelOutput) {
        setConversation(prev => [...prev, { speaker: 'model', text: modelOutput, timestamp: Date.now() }]);
      }
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';
    }
    
    // Tool Calls
    if (message.toolCall?.functionCalls) {
      for (const fc of message.toolCall.functionCalls) {
        const toolCall: ActiveToolCall = { id: fc.id, name: fc.name, args: fc.args };
        activeToolCallsRef.current.set(fc.id, toolCall);

        const result = await executeTool(toolCall, settings);
        const newOutput = { id: fc.id, toolName: fc.name, content: result };

        setWorkspaceState(prev => ({
          ...prev,
          mode: 'result',
          toolOutputs: [newOutput, ...prev.toolOutputs]
        }));
        
        sessionPromiseRef.current?.then(session => {
          session.sendToolResponse({
            functionResponses: {
              id: fc.id,
              name: fc.name,
              response: { result: "Function executed. Result displayed in workspace." },
            }
          })
        });
      }
    }
  }, [playAudio, settings, stopAudioPlayback]);

  const startLiveSession = useCallback(async () => {
    if (sessionPromiseRef.current) return;
    setIsRecording(true);
    
    if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    inputAudioContextRef.current.resume();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        const callbacks = {
            onopen: () => {
                const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                micSourceNodeRef.current = source;
                
                const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                micProcessorNodeRef.current = scriptProcessor;

                const analyser = inputAudioContextRef.current!.createAnalyser();
                micAnalyserNodeRef.current = analyser;
                analyser.fftSize = 2048;

                scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const l = inputData.length;
                    const int16 = new Int16Array(l);
                    for (let i = 0; i < l; i++) {
                        int16[i] = inputData[i] * 32768;
                    }
                    const pcmBlob: GenaiBlob = {
                        data: encode(new Uint8Array(int16.buffer)),
                        mimeType: 'audio/pcm;rate=16000',
                    };
                    sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                };
                
                source.connect(analyser);
                analyser.connect(scriptProcessor);
                scriptProcessor.connect(inputAudioContextRef.current!.destination);
                
                processMicAmplitude();
            },
            onmessage: handleLiveMessage,
            onerror: (e: ErrorEvent) => {
              console.error('Live session error:', e);
              setConversation(prev => [...prev, { speaker: 'system', text: 'An error occurred. Session ended.', timestamp: Date.now() }]);
              stopLiveSession();
            },
            onclose: (e: CloseEvent) => {
              if (sessionPromiseRef.current) {
                stopLiveSession();
              }
            },
        };

        const finalSystemInstruction = `${settings.systemInstruction}\n\n${LANGUAGE_ADDITIONS[settings.language] || ''}`;
        const finalSettings = { ...settings, systemInstruction: finalSystemInstruction };

        sessionPromiseRef.current = geminiService.startLiveSession(finalSettings, callbacks);
        await sessionPromiseRef.current;
    } catch (error) {
        console.error("Failed to start live session:", error);
        setIsRecording(false);
    }
  }, [settings, handleLiveMessage, stopLiveSession, processMicAmplitude]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  }, [isRecording, startLiveSession, stopLiveSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, [stopLiveSession]);


  // --- Workspace Logic ---
  
  const handleShowActions = () => {
    setWorkspaceState({ mode: 'action_select', toolOutputs: workspaceState.toolOutputs });
  };
  
  const handleClearWorkspace = () => {
    setWorkspaceState({ mode: 'idle', toolOutputs: workspaceState.toolOutputs });
  };
  
  const handleActionSelect = (action: MediaAction) => {
    if (action === 'generateVideo') {
      setWorkspaceState(prev => ({ ...prev, mode: 'api_key_needed', uploadAction: 'generateVideo' }));
      return;
    }
    const uploadActions: MediaAction[] = ['analyzeImage', 'editImage', 'transcribeAudio', 'analyzeTradingData'];
    if (uploadActions.includes(action)) {
      setWorkspaceState(prev => ({ ...prev, mode: 'upload', uploadAction: action as UploadAction }));
    } else if (action === 'recordMedia') {
      setWorkspaceState(prev => ({ ...prev, mode: 'recording' }));
    } else if (action === 'recordScreen') {
      setWorkspaceState(prev => ({ ...prev, mode: 'screen_sharing_setup' }));
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result.split(',')[1]);
            } else {
              reject(new Error("Failed to convert blob to base64"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  };

  const handleFileSelect = async (file: File) => {
    const base64 = await blobToBase64(file);
    setWorkspaceState(prev => ({
      ...prev,
      mode: 'result',
      primaryContent: { type: file.type.startsWith('image/') ? 'image' : 'video', data: URL.createObjectURL(file) },
      uploadedFile: { file, base64, mimeType: file.type }
    }));
  };

  const handleWorkspacePrompt = async (prompt: string) => {
    if (!workspaceState.uploadAction || !workspaceState.uploadedFile) return;

    setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'Analyzing...' }));
    let result: string | undefined;
    let content: WorkspaceContent | undefined;
    const { base64, mimeType } = workspaceState.uploadedFile;

    try {
        switch (workspaceState.uploadAction) {
          case 'analyzeImage':
            result = await geminiService.analyzeImage(base64, mimeType, prompt);
            content = { type: 'text', data: { text: result }, prompt };
            break;
          case 'editImage':
            result = await geminiService.editImage(base64, mimeType, prompt);
            content = { type: 'image', data: result, prompt };
            break;
          case 'generateVideo':
            result = await geminiService.generateVideo(base64, mimeType, prompt, '16:9', (status) => {
                setWorkspaceState(prev => ({...prev, mode: 'processing', message: status}));
            });
            content = { type: 'video', data: result, prompt };
            break;
          case 'transcribeAudio':
             result = await geminiService.transcribeAudio(base64, mimeType, prompt);
             content = { type: 'text', data: { text: result }, prompt };
             break;
          case 'analyzeTradingData':
             const textData = await workspaceState.uploadedFile.file.text();
             result = await geminiService.analyzeTradingDataWithFlash(textData, prompt);
             content = { type: 'text', data: { text: result }, prompt };
             break;
        }
    
        if (content) {
          setWorkspaceState(prev => ({
            ...prev,
            mode: 'result',
            primaryContent: content,
            uploadedFile: undefined,
          }));
        } else {
            throw new Error("Action did not produce a result.");
        }
    } catch (error: any) {
        if (error.message === 'API_KEY_REQUIRED') {
            setWorkspaceState(prev => ({ ...prev, mode: 'api_key_needed', uploadAction: 'generateVideo' }));
            return;
        }
        console.error(`Error in workspace action ${workspaceState.uploadAction}:`, error);
        setWorkspaceState(prev => ({
          ...prev,
          mode: 'result',
          primaryContent: { type: 'text', data: { text: `Error: ${error.message}` } },
        }));
    }
  };
  
  const handleSelectApiKey = async () => {
    await (window as any).aistudio.openSelectKey();
    // Assume success and proceed. Error handling in generateVideo will catch failures.
    setWorkspaceState(prev => ({...prev, mode: 'upload'}));
  };
  
  // --- Render ---

  return (
    <main className="h-screen w-screen bg-black text-white overflow-hidden font-sans">
      <div className="relative h-full w-full flex flex-col items-center justify-center">
        <TopBar
          onOpenSettings={() => setShowSettings(true)}
          onToggleCaptions={() => setShowCaptions(p => !p)}
          isCaptionsOn={showCaptions}
          onNavigateToDialer={() => console.log('Dialer navigation not implemented.')}
        />
        
        <VoiceVisualizer isRecording={isRecording} isSpeaking={isSpeaking} micAmplitude={micAmplitude} />
        
        {showCaptions && <Captions conversation={conversation} />}
        
        <ControlBar
          isRecording={isRecording}
          isSpeaking={isSpeaking}
          micAmplitude={micAmplitude}
          onToggleRecording={handleToggleRecording}
          onHangUp={stopLiveSession}
          onShowActions={handleShowActions}
          onOpenFeedback={() => setShowFeedback(true)}
          onSkipTurn={() => console.log('Skip turn not implemented.')}
        />
        
        {workspaceState.mode !== 'idle' && (
          <Workspace
            workspaceState={workspaceState}
            onActionSelect={handleActionSelect}
            onFileSelect={handleFileSelect}
            onRecordingComplete={handleFileSelect}
            onPromptSubmit={handleWorkspacePrompt}
            onClearWorkspace={handleClearWorkspace}
            onSelectApiKey={handleSelectApiKey}
            onRemoveToolOutput={(id) => setWorkspaceState(p => ({...p, toolOutputs: p.toolOutputs.filter(o => o.id !== id)}))}
          />
        )}
        
        {showSettings && (
          <Settings 
            settings={settings}
            onClose={() => setShowSettings(false)}
            onSettingsChange={setSettings}
          />
        )}

        {showFeedback && (
          <Feedback
            onClose={() => setShowFeedback(false)}
            onSubmit={(feedback) => {
              console.log("Feedback submitted:", feedback);
              setShowFeedback(false);
            }}
          />
        )}
      </div>
    </main>
  );
};

export default App;