
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
} from './types';

const DEFAULT_SETTINGS: AppSettings = {
  systemInstruction: 'You are a friendly and helpful AI assistant. Your name is Alex.',
  voice: 'Zephyr',
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
      return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
    } catch (e) {
      console.error("Failed to parse settings from localStorage", e);
      return DEFAULT_SETTINGS;
    }
  });
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isCaptionsOn, setIsCaptionsOn] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micAmplitude, setMicAmplitude] = useState(0);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ mode: 'idle', content: null, message: '' });

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


  const stopSession = useCallback(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    sessionPromiseRef.current = null;

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
  }, [addSystemMessage]);

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
            setWorkspaceState({ mode: 'result', content: { type: 'grounding_search', data: { text: finalOutput, sources } }, message: '' });
          }
        }
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';
        groundingMetadataRef.current = [];
      }

      if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
          addSystemMessage(`Calling tool: ${fc.name}`);
          const result = await executeTool(fc, settings);
          setWorkspaceState({ mode: 'result', content: result, message: '' });
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
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputAudioContext = inputAudioContextRef.current;
      if (!inputAudioContext) return;

      inputStreamSourceRef.current = inputAudioContext.createMediaStreamSource(mediaStreamRef.current);
      inputProcessorRef.current = inputAudioContext.createScriptProcessor(4096, 1, 1);
      analyserNodeRef.current = inputAudioContext.createAnalyser();
      analyserNodeRef.current.fftSize = 512;

      inputStreamSourceRef.current.connect(analyserNodeRef.current);
      analyserNodeRef.current.connect(inputProcessorRef.current);
      inputProcessorRef.current.connect(inputAudioContext.destination);

      const dataArray = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
      const updateAmplitude = () => {
        if (!isRecordingRef.current) return;
        analyserNodeRef.current?.getByteTimeDomainData(dataArray);
        let sumSquares = 0.0;
        for (const amplitude of dataArray) {
          sumSquares += Math.pow((amplitude / 128.0) - 1.0, 2);
        }
        setMicAmplitude(Math.sqrt(sumSquares / dataArray.length));
        requestAnimationFrame(updateAmplitude);
      };
      const isRecordingRef = { current: true };
      requestAnimationFrame(updateAmplitude);

      inputProcessorRef.current.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmBlob: GenAI_Blob = {
          data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
          mimeType: 'audio/pcm;rate=16000',
        };
        sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
      };
      
      return () => { isRecordingRef.current = false; };
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
      sessionPromiseRef.current = geminiService.startLiveSession(settings, { onopen: onOpen, onmessage: onMessage, onerror: onError, onclose: onClose });
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
      startSession();
    }
  }, [isRecording, startSession, stopSession]);

  const handleHangUp = () => {
    stopSession();
    setConversation([]);
    setWorkspaceState({ mode: 'idle', content: null, message: '' });
  };

  const handleShowActions = () => {
    if (workspaceState.mode === 'idle') {
      setWorkspaceState({ mode: 'action_select', content: null, message: '' });
    } else {
      handleClearWorkspace();
    }
  };

  const handleClearWorkspace = () => {
    setWorkspaceState({ mode: 'idle', content: null, message: '' });
  };

  const handleActionSelect = (action: MediaAction) => {
    if (action === 'recordMedia') {
      setWorkspaceState(prev => ({ ...prev, mode: 'recording' }));
    } else if (action === 'recordScreen') {
      setWorkspaceState(prev => ({ ...prev, mode: 'screen_sharing_setup' }));
    } else {
      setWorkspaceState({ mode: 'upload', content: null, message: '', uploadAction: action });
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
          setWorkspaceState({ mode: 'result', content: newContent, message: '', uploadAction: action });
          return;
      }
      
      const newContent: WorkspaceContent = {
        type: file.type.startsWith('image/') ? 'image' : 'video',
        data: `data:${file.type};base64,${base64}`,
      };
      setWorkspaceState({ mode: 'result', content: newContent, message: '', uploadAction: action });

    } catch (error) {
      console.error("File processing error:", error);
      addSystemMessage("Error processing file.");
      handleClearWorkspace();
    }
  };

  const handleRecordingComplete = (file: File) => {
    const url = URL.createObjectURL(file);
    const newContent: WorkspaceContent = { type: 'video', data: url };
    setWorkspaceState(prev => ({ ...prev, mode: 'result', content: newContent, uploadAction: 'analyzeImage' }));
  };

  const handlePromptSubmit = async (prompt: string) => {
    if (!workspaceState.uploadAction || !workspaceState.content) return;

    setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'AI is working...' }));

    try {
      let result: WorkspaceContent | null = null;
      const currentContent = workspaceState.content;

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
        setWorkspaceState({ mode: 'result', content: result, message: '', uploadAction: workspaceState.uploadAction });
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
      if (workspaceState.uploadAction && workspaceState.content?.prompt) {
        handlePromptSubmit(workspaceState.content.prompt);
      } else {
        handleClearWorkspace();
      }
    } else {
        addSystemMessage("API key selection is not available in this environment.");
        handleClearWorkspace();
    }
  };

  return (
    <div className="w-full h-full min-h-screen bg-black text-white relative overflow-hidden">
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
      <ControlBar isRecording={isRecording} onToggleRecording={handleToggleRecording} onHangUp={handleHangUp} onShowActions={handleShowActions} />
      {isSettingsOpen && (
        <Settings settings={settings} onSettingsChange={(newSettings) => setSettings(prev => ({...prev, ...newSettings}))} onClose={() => setIsSettingsOpen(false)} onShowServerSettings={() => {}} />
      )}
      <Workspace
        workspaceState={workspaceState}
        onActionSelect={handleActionSelect}
        onFileSelect={handleFileSelect}
        onRecordingComplete={handleRecordingComplete}
        onPromptSubmit={handlePromptSubmit}
        onClearWorkspace={handleClearWorkspace}
        onSelectApiKey={handleSelectApiKey}
      />
    </div>
  );
}

export default App;
