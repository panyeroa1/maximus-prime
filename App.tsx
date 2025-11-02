
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveServerMessage,
  FunctionCall,
  Blob as GenAI_Blob,
} from '@google/genai';

import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { Workspace } from './components/Workspace';
import { Feedback } from './components/Feedback';
import * as geminiService from './services/geminiService';
import { executeTool } from './services/subAgentService';
import { decode, decodeAudioData, encode } from './services/audioUtils';

import {
  ConversationTurn,
  AppSettings,
  WorkspaceState,
  WorkspaceContent,
  MediaAction,
  GroundingSource,
  ToolOutput,
} from './types';

const DEFAULT_SETTINGS: AppSettings = {
  systemInstruction: `You are Maximus, a friendly and helpful voice assistant. Keep your responses concise and conversational. All your speech output must be wrapped in <speak><prosody rate="95%" pitch="+2st">...</prosody></speak> tags.`,
  voice: 'Orus',
  rate: 95,
  pitch: 2,
  emotion: 'neutral',
  enabledTools: ['generateImage', 'groundedSearch'],
  serverSettings: {
    googleCloudProjectId: '',
    googleCloudServiceAccountJson: '',
    twilioSid: '',
    twilioAuthToken: '',
    blandApiKey: '',
    cartesiaApiKey: '',
    elevenLabsApiKey: '',
    ollamaCloudEndpoint: '',
    ollamaCloudApiKey: '',
  },
  toolSettings: {
    generateImage: {
      aspectRatio: '1:1',
    },
  },
};

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      // Merge saved settings with defaults to ensure new fields are present
      const parsed = savedSettings ? JSON.parse(savedSettings) : {};
      return { ...DEFAULT_SETTINGS, ...parsed, serverSettings: {...DEFAULT_SETTINGS.serverSettings, ...parsed.serverSettings}, toolSettings: {...DEFAULT_SETTINGS.toolSettings, ...parsed.toolSettings} };
    } catch (e) {
      console.error("Failed to parse settings from localStorage", e);
      return DEFAULT_SETTINGS;
    }
  });
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isCaptionsOn, setIsCaptionsOn] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micAmplitude, setMicAmplitude] = useState(0);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ mode: 'idle', primaryContent: null, toolOutputs: [], message: '' });

  const liveSessionRef = useRef<any>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextAudioStartTimeRef = useRef(0);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const groundingMetadataRef = useRef<any[]>([]);
  const animationFrameId = useRef<number | null>(null);


  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Initialize AudioContexts. They can only be created after a user interaction.
    // We'll create them when recording starts for the first time.
    return () => {
      // Cleanup on unmount
      outputAudioContextRef.current?.close();
      inputAudioContextRef.current?.close();
    };
  }, []);

  const addConversationTurn = useCallback((speaker: ConversationTurn['speaker'], text: string) => {
    if (!text.trim()) return;
    const newTurn: ConversationTurn = { speaker, text, timestamp: Date.now() };
    setConversation(prev => [...prev, newTurn]);
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    addConversationTurn('system', text);
  }, [addConversationTurn]);

  const playChime = useCallback((type: 'start' | 'end') => {
    if (!outputAudioContextRef.current) return;
    const audioCtx = outputAudioContextRef.current;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
  
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
  
    oscillator.type = 'sine';
    
    if (type === 'start') {
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      oscillator.frequency.linearRampToValueAtTime(783.99, audioCtx.currentTime + 0.1); // G5
    } else { // 'end'
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
      oscillator.frequency.linearRampToValueAtTime(523.25, audioCtx.currentTime + 0.15); // C5
    }
    
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
  
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  }, []);

  const stopSession = useCallback(() => {
    playChime('end');
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    sessionPromiseRef.current = null;

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    inputProcessorRef.current?.disconnect();
    inputStreamSourceRef.current?.disconnect();
    analyserNodeRef.current?.disconnect();
    inputProcessorRef.current = null;
    inputStreamSourceRef.current = null;
    analyserNodeRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextAudioStartTimeRef.current = 0;
    
    setIsRecording(false);
    setIsSpeaking(false);
    setMicAmplitude(0);
    
    addSystemMessage('Session ended.');
  }, [addSystemMessage, playChime]);

  const startSession = useCallback(async () => {
    if (liveSessionRef.current) return;

    addSystemMessage('Starting session...');
    setIsRecording(true);
    groundingMetadataRef.current = [];

    const onMessage = async (message: LiveServerMessage) => {
      const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
      if (audioData && outputAudioContextRef.current) {
        setIsSpeaking(true);
        const outputAudioContext = outputAudioContextRef.current;
        nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, outputAudioContext.currentTime);
        const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.addEventListener('ended', () => {
          audioSourcesRef.current.delete(source);
          if (audioSourcesRef.current.size === 0) setIsSpeaking(false);
        });
        source.start(nextAudioStartTimeRef.current);
        nextAudioStartTimeRef.current += audioBuffer.duration;
        audioSourcesRef.current.add(source);
      }

      if (message.serverContent?.inputTranscription?.text) {
        currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
      }
      if (message.serverContent?.outputTranscription?.text) {
        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
      }
      if (message.serverContent?.modelTurn?.groundingMetadata) {
        groundingMetadataRef.current.push(...message.serverContent.modelTurn.groundingMetadata.groundingChunks);
      }
      if (message.serverContent?.turnComplete) {
        const finalInput = currentInputTranscriptionRef.current;
        const finalOutput = currentOutputTranscriptionRef.current;
        if (finalInput) addConversationTurn('user', finalInput);
        if (finalOutput) {
          addConversationTurn('model', finalOutput);
          const searchChunks = groundingMetadataRef.current.filter(c => c.web);
          if (searchChunks.length > 0) {
            const sources: GroundingSource[] = searchChunks.map(c => ({ uri: c.web.uri, title: c.web.title }));
            setWorkspaceState(prev => ({ ...prev, mode: 'result', primaryContent: { type: 'grounding_search', data: { text: finalOutput, sources } } }));
          }
        }
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';
        groundingMetadataRef.current = [];
      }

      if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
          addSystemMessage(`Calling tool: ${fc.name}`);
          const result = await executeTool(fc as any, settings);
          const newToolOutput: ToolOutput = {
            id: `${fc.name}-${Date.now()}`,
            toolName: fc.name,
            content: result
          };
          setWorkspaceState(prev => ({
            ...prev,
            mode: 'result',
            toolOutputs: [...prev.toolOutputs, newToolOutput]
          }));
          sessionPromiseRef.current?.then(session => {
            session.sendToolResponse({
              functionResponses: { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } }
            });
          });
        }
      }
      
      if (message.serverContent?.interrupted) {
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextAudioStartTimeRef.current = 0;
        setIsSpeaking(false);
      }
    };
    
    const onOpen = async () => {
      addSystemMessage('Connection opened. Mic is active.');
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            autoGainControl: true,
            echoCancellation: true,
          },
        });
      } catch (err) {
        console.error("Error accessing microphone with advanced constraints:", err);
        addSystemMessage("Could not access microphone with advanced features, falling back to default.");
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const inputAudioContext = inputAudioContextRef.current;
      if (!inputAudioContext || !mediaStreamRef.current) return;

      inputStreamSourceRef.current = inputAudioContext.createMediaStreamSource(mediaStreamRef.current);
      inputProcessorRef.current = inputAudioContext.createScriptProcessor(2048, 1, 1);
      analyserNodeRef.current = inputAudioContext.createAnalyser();
      analyserNodeRef.current.fftSize = 512;

      inputStreamSourceRef.current.connect(analyserNodeRef.current);
      analyserNodeRef.current.connect(inputProcessorRef.current);
      inputProcessorRef.current.connect(inputAudioContext.destination);

      const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
      const updateAmplitude = () => {
        if (!analyserNodeRef.current) return;
        analyserNodeRef.current.getByteTimeDomainData(dataArray);
        let sumSquares = 0.0;
        for (const amplitude of dataArray) {
          sumSquares += Math.pow((amplitude / 128.0) - 1.0, 2);
        }
        setMicAmplitude(Math.sqrt(sumSquares / dataArray.length));
        animationFrameId.current = requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();

      inputProcessorRef.current.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmBlob: GenAI_Blob = {
          data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
          mimeType: 'audio/pcm;rate=16000',
        };
        sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
      };
    };

    const onError = (e: ErrorEvent) => {
      console.error('Session error:', e);
      addSystemMessage(`Error: ${e.message}`);
      stopSession();
    };

    const onClose = () => {
      addSystemMessage('Session closed.');
      setIsRecording(false);
      setIsSpeaking(false);
    };

    try {
      // Refine voice parameters based on emotion for more nuanced expression.
      let effectiveRate = settings.rate;
      let effectivePitch = settings.pitch;

      switch (settings.emotion) {
        case 'happy':
          // A happier voice is typically faster and higher-pitched.
          effectiveRate = Math.min(150, settings.rate + 10);
          effectivePitch = Math.min(8, settings.pitch + 2);
          break;
        case 'sad':
          // A sad voice is slower and lower-pitched.
          effectiveRate = Math.max(75, settings.rate - 20);
          effectivePitch = Math.max(-8, settings.pitch - 2);
          break;
        case 'angry':
          // An angry voice can be slightly faster and lower-pitched for a more forceful tone.
          effectiveRate = Math.min(150, settings.rate + 5);
          effectivePitch = Math.max(-8, settings.pitch - 1);
          break;
        case 'neutral':
        default:
          // Use the user-defined settings for neutral.
          break;
      }

      // Apply the calculated rate and pitch to the SSML in the system instruction.
      const modifiedInstruction = settings.systemInstruction
        .replace(/rate="[^"]*"/, `rate="${effectiveRate}%"`)
        .replace(/pitch="[^"]*"/, `pitch="${effectivePitch > 0 ? '+' : ''}${effectivePitch}st"`);
  
      const modifiedSettings = { ...settings, systemInstruction: modifiedInstruction };

      sessionPromiseRef.current = geminiService.startLiveSession(modifiedSettings, { onopen: onOpen, onmessage: onMessage, onerror: onError, onclose: onClose });
      liveSessionRef.current = await sessionPromiseRef.current;
    } catch (error) {
      console.error('Failed to start session:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addSystemMessage(`Failed to start session: ${errorMessage}`);
      setIsRecording(false);
    }
  }, [settings, stopSession, addSystemMessage, addConversationTurn]);
  
  const handleToggleRecording = useCallback(() => {
    if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (isRecording) {
      stopSession();
    } else {
      playChime('start');
      startSession();
    }
  }, [isRecording, startSession, stopSession, playChime]);

  const handleHangUp = () => {
    stopSession();
    setConversation([]);
    setWorkspaceState({ mode: 'idle', primaryContent: null, toolOutputs: [], message: '' });
  };

  const handleShowActions = () => {
    if (workspaceState.mode === 'idle') {
      setWorkspaceState({ ...workspaceState, mode: 'action_select' });
    } else {
      handleClearWorkspace();
    }
  };

  const handleClearWorkspace = () => {
    setWorkspaceState({ mode: 'idle', primaryContent: null, toolOutputs: [], message: '' });
  };
  
  const handleRemoveToolOutput = (id: string) => {
    setWorkspaceState(prev => {
      const newToolOutputs = prev.toolOutputs.filter(o => o.id !== id);
      // If we removed the last item (primary or tool), clear the workspace
      if (!prev.primaryContent && newToolOutputs.length === 0) {
        return { mode: 'idle', primaryContent: null, toolOutputs: [], message: '' };
      }
      return { ...prev, toolOutputs: newToolOutputs };
    });
  };

  const handleActionSelect = (action: MediaAction) => {
    if (action === 'recordMedia') {
      setWorkspaceState(prev => ({ ...prev, mode: 'recording' }));
    } else if (action === 'recordScreen') {
      setWorkspaceState(prev => ({ ...prev, mode: 'screen_sharing_setup' }));
    } else {
      setWorkspaceState(prev => ({ ...prev, primaryContent: null, mode: 'upload', uploadAction: action }));
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });

  const handleFileSelect = async (file: File) => {
    setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'Preparing file...' }));
    try {
      const base64 = await fileToBase64(file);
      const action = workspaceState.uploadAction;

      if (action === 'analyzeTradingData') {
          const textContent = atob(base64);
          const newContent: WorkspaceContent = { type: 'text', data: { text: `File loaded: ${file.name}. Ready for analysis.` }, prompt: textContent };
          setWorkspaceState(prev => ({ ...prev, mode: 'result', primaryContent: newContent, uploadAction: action }));
          return;
      }
      
      const newContent: WorkspaceContent = {
        type: file.type.startsWith('image/') ? 'image' : 'video',
        data: `data:${file.type};base64,${base64}`,
      };
      setWorkspaceState(prev => ({...prev, mode: 'result', primaryContent: newContent, uploadAction: action }));

    } catch (error) {
      console.error("File processing error:", error);
      addSystemMessage("Error processing file.");
      handleClearWorkspace();
    }
  };

  const handleRecordingComplete = (file: File) => {
    const url = URL.createObjectURL(file);
    const newContent: WorkspaceContent = { type: 'video', data: url };
    setWorkspaceState(prev => ({ ...prev, mode: 'result', primaryContent: newContent, uploadAction: 'analyzeImage' }));
  };

  const handlePromptSubmit = async (prompt: string) => {
    if (!workspaceState.uploadAction || !workspaceState.primaryContent) return;

    setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'AI is working...' }));

    try {
      let result: WorkspaceContent | null = null;
      const currentContent = workspaceState.primaryContent;

      if (workspaceState.uploadAction === 'analyzeTradingData') {
          const tradingData = currentContent.prompt!;
          const text = await geminiService.analyzeTradingDataWithFlash(tradingData, prompt);
          result = { type: 'text', data: { text }, prompt: prompt };
      } else {
          const [header, base64] = currentContent.data.split(',');
          const mimeType = header.split(':')[1].split(';')[0];
          
          switch (workspaceState.uploadAction) {
            case 'analyzeImage':
              result = { type: 'text', data: { text: await geminiService.analyzeImage(base64, mimeType, prompt) } };
              break;
            case 'editImage':
              result = { type: 'image', data: await geminiService.editImage(base64, mimeType, prompt) };
              break;
            case 'generateVideo':
              const onProgress = (message: string) => setWorkspaceState(prev => ({...prev, message}));
              result = { type: 'video', data: await geminiService.generateVideo(base64, mimeType, prompt, '16:9', onProgress) };
              break;
            case 'transcribeAudio':
              result = { type: 'text', data: { text: await geminiService.transcribeAudio(base64, mimeType, prompt) } };
              break;
          }
      }
      if (result) {
        setWorkspaceState(prev => ({ ...prev, mode: 'result', primaryContent: result, uploadAction: workspaceState.uploadAction }));
      }
    } catch (error: any) {
      if (error.message === 'API_KEY_REQUIRED') {
        setWorkspaceState(prev => ({...prev, mode: 'api_key_needed' }));
      } else {
        console.error('Action failed:', error);
        addSystemMessage(`Error: ${error.message}`);
        handleClearWorkspace();
      }
    }
  };

  const handleSelectApiKey = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      if (workspaceState.uploadAction && workspaceState.primaryContent?.prompt) {
        handlePromptSubmit(workspaceState.primaryContent.prompt);
      } else {
        handleClearWorkspace();
      }
    } else {
        addSystemMessage("API key selection is not available in this environment.");
        handleClearWorkspace();
    }
  };

  const handleOpenFeedback = () => setIsFeedbackOpen(true);
  const handleCloseFeedback = () => setIsFeedbackOpen(false);
  const handleFeedbackSubmit = (feedback: string) => {
    console.log("Feedback submitted:", feedback);
    addSystemMessage("Thank you for your feedback!");
    setIsFeedbackOpen(false);
  };

  return (
    <div className="w-full h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
      <style>{`
        body, #root {
          background-color: #000;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
          overscroll-behavior: none;
        }
      `}</style>
      <VoiceVisualizer isRecording={isRecording} isSpeaking={isSpeaking} micAmplitude={micAmplitude} />
      <TopBar onOpenSettings={() => setIsSettingsOpen(true)} onToggleCaptions={() => setIsCaptionsOn(prev => !prev)} isCaptionsOn={isCaptionsOn} />
      {isCaptionsOn && <Captions conversation={conversation} />}
      <ControlBar isRecording={isRecording} onToggleRecording={handleToggleRecording} onHangUp={handleHangUp} onShowActions={handleShowActions} onOpenFeedback={handleOpenFeedback} />
      {isSettingsOpen && (
        <Settings settings={settings} onSettingsChange={(newSettings) => setSettings(prev => ({...prev, ...newSettings}))} onClose={() => setIsSettingsOpen(false)} onShowServerSettings={() => {}} />
      )}
      {isFeedbackOpen && (
        <Feedback onClose={handleCloseFeedback} onSubmit={handleFeedbackSubmit} />
      )}
      <Workspace
        workspaceState={workspaceState}
        onActionSelect={handleActionSelect}
        onFileSelect={handleFileSelect}
        onRecordingComplete={handleRecordingComplete}
        onPromptSubmit={handlePromptSubmit}
        onClearWorkspace={handleClearWorkspace}
        onSelectApiKey={handleSelectApiKey}
        onRemoveToolOutput={handleRemoveToolOutput}
      />
    </div>
  );
}

export default App;
