import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LiveServerMessage, Blob as GenaiBlob } from '@google/genai';

import { AppSettings, ConversationTurn, WorkspaceState } from './types';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { Workspace } from './components/Workspace';

import { startLiveSession, analyzeImage, editImage, generateVideo, transcribeAudio } from './services/geminiService';
import { executeTool } from './services/subAgentService';
import { decode, encode, decodeAudioData } from './services/audioUtils';

const DEFAULT_SETTINGS: AppSettings = {
  systemInstruction: 'You are a helpful and friendly AI assistant. Be conversational and concise.',
  voice: 'Zephyr',
  enabledTools: ['groundedSearch'],
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
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });


function App() {
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micAmplitude, setMicAmplitude] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ mode: 'idle', content: null, message: '' });

  // Live session and audio processing refs
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  
  // Audio playback queue
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Transcription refs
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const initOutputAudioContext = useCallback(() => {
    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        console.error("AudioContext is not supported.");
        return;
      }
      outputAudioContextRef.current = new Ctx({ sampleRate: 24000 });
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);
    }
  }, []);

  const playChime = useCallback(() => {
    initOutputAudioContext();
    if (!outputAudioContextRef.current || !outputNodeRef.current) return;

    const context = outputAudioContextRef.current;
    const gainNode = outputNodeRef.current;
    const now = context.currentTime;

    gainNode.gain.setValueAtTime(0.1, now); // Set a gentle volume

    // First tone
    const osc1 = context.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.connect(gainNode);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Second tone
    const osc2 = context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.12); // C6
    osc2.connect(gainNode);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.22);
  }, [initOutputAudioContext]);

  const appendToConversation = useCallback((turn: Omit<ConversationTurn, 'timestamp'>) => {
    setConversation(prev => [...prev, { ...turn, timestamp: Date.now() }]);
  }, []);

  const resetConversation = () => {
    setConversation([]);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
  };

  const processAudioOutput = useCallback(async (base64Audio: string) => {
    initOutputAudioContext();
    if (!outputAudioContextRef.current || !outputNodeRef.current) return;
    setIsSpeaking(true);

    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      outputAudioContextRef.current,
      24000,
      1
    );

    const source = outputAudioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputNodeRef.current);
    
    source.onended = () => {
      sourcesRef.current.delete(source);
      if (sourcesRef.current.size === 0) {
        setIsSpeaking(false);
      }
    };
    
    const currentTime = outputAudioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
    sourcesRef.current.add(source);
  }, [initOutputAudioContext]);

  const stopAudioPlayback = () => {
    sourcesRef.current.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            console.warn("Could not stop audio source", e);
        }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  };

  const stopMicAndCleanup = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    
    analyserNodeRef.current?.disconnect();
    analyserNodeRef.current = null;

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(e => console.warn("Error closing input audio context", e));
    }
    inputAudioContextRef.current = null;
  }, []);
  
  const onLiveMessage = useCallback(async (message: LiveServerMessage) => {
    if (message.serverContent) {
      const { inputTranscription, outputTranscription, modelTurn, turnComplete, interrupted } = message.serverContent;

      if (inputTranscription) currentInputTranscriptionRef.current += inputTranscription.text;
      if (outputTranscription) currentOutputTranscriptionRef.current += outputTranscription.text;
      if (modelTurn?.parts[0]?.inlineData?.data) {
        await processAudioOutput(modelTurn.parts[0].inlineData.data);
      }
      
      if (turnComplete) {
        if (currentInputTranscriptionRef.current.trim()) {
          appendToConversation({ speaker: 'user', text: currentInputTranscriptionRef.current.trim() });
        }
        if (currentOutputTranscriptionRef.current.trim()) {
          appendToConversation({ speaker: 'model', text: currentOutputTranscriptionRef.current.trim() });
        }
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';
      }

      if (interrupted) {
        stopAudioPlayback();
      }
    }

    if (message.toolCall?.functionCalls) {
      for (const fc of message.toolCall.functionCalls) {
        // Fix: Ensure function call has a name before executing, and pass a valid ActiveToolCall object.
        if (fc.name) {
          appendToConversation({ speaker: 'system', text: `Calling tool: ${fc.name}(${JSON.stringify(fc.args)})` });
          setWorkspaceState({ mode: 'processing', message: `Executing tool: ${fc.name}...`, content: null });
          
          const result = await executeTool({ name: fc.name, args: fc.args });
          setWorkspaceState({ mode: 'result', content: result, message: 'Tool execution complete.' });
          
          sessionPromiseRef.current?.then(session => {
            session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: JSON.stringify(result.data) } } });
          });
          
          appendToConversation({ speaker: 'system', text: `Tool ${fc.name} finished.` });
        }
      }
    }
  }, [appendToConversation, processAudioOutput]);

  const startSession = useCallback(async () => {
    if (isRecording || sessionPromiseRef.current) return;
    resetConversation();

    try {
      sessionPromiseRef.current = startLiveSession(appSettings, {
        onopen: () => console.log('Session opened'),
        onmessage: onLiveMessage,
        onerror: (e: ErrorEvent) => console.error('Session error:', e),
        onclose: (e: CloseEvent) => {
          console.log('Session closed');
          sessionPromiseRef.current = null;
          if (isRecording) {
            setIsRecording(false);
            stopAudioPlayback();
          }
        },
      });
      await sessionPromiseRef.current;
      playChime();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start session:', error);
      sessionPromiseRef.current = null;
    }
  }, [isRecording, appSettings, onLiveMessage, playChime]);

  const stopSession = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
          session.close();
        }).catch(e => console.error("Error closing session:", e));
        sessionPromiseRef.current = null;
    }
    if (isRecording) {
      setIsRecording(false);
      stopAudioPlayback();
    }
  }, [isRecording]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopSession();
    } else {
      startSession();
    }
  }, [isRecording, startSession, stopSession]);

  const handleHangUp = () => {
    stopSession();
    resetConversation();
    setWorkspaceState({ mode: 'idle', content: null, message: '' });
  };
  
  useEffect(() => {
    const setupMic = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            const context = new Ctx({ sampleRate: 16000 });
            inputAudioContextRef.current = context;
            
            const source = context.createMediaStreamSource(stream);
            const processor = context.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;
            
            const analyser = context.createAnalyser();
            analyser.fftSize = 512;
            analyserNodeRef.current = analyser;
            
            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(context.destination);
            
            processor.onaudioprocess = (e) => {
              if (!isRecording) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob: GenaiBlob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
        } catch (error) {
            console.error("Error setting up microphone:", error);
            setIsRecording(false);
        }
    };
    
    if (isRecording) {
        setupMic();
    }

    return () => {
        stopMicAndCleanup();
    };
  }, [isRecording, stopMicAndCleanup]);

  useEffect(() => {
    return () => {
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.warn);
        }
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const visualize = () => {
      if (isRecording && analyserNodeRef.current) {
        const bufferLength = analyserNodeRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNodeRef.current.getByteTimeDomainData(dataArray);
        const amplitude = dataArray.reduce((acc, val) => Math.max(acc, Math.abs(val - 128)), 0) / 128.0;
        setMicAmplitude(amplitude);
      } else {
        setMicAmplitude(0);
      }
      animationFrameId = requestAnimationFrame(visualize);
    };
    visualize();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRecording]);

  const onClearWorkspace = () => {
    setWorkspaceState({ mode: 'idle', content: null, message: '' });
  }

  const handleFileSelect = async (file: File) => {
    const action = workspaceState.uploadAction;
    setWorkspaceState({ mode: 'result', content: { type: file.type.startsWith('image') ? 'image' : 'video', data: URL.createObjectURL(file), prompt: '' }, uploadAction: action, message: '' });
  };
  
  const handleWorkspacePrompt = async (prompt: string) => {
      if (!workspaceState.content || !workspaceState.uploadAction) return;

      const { data } = workspaceState.content;
      const action = workspaceState.uploadAction;

      const response = await fetch(data);
      const blob = await response.blob();
      const file = new File([blob], "inputfile", {type: blob.type});
      const base64 = await fileToBase64(file);
      const mimeType = file.type;

      setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'Working on it...', content: { ...prev.content!, prompt } }));

      try {
        let result: any;
        if (action === 'analyzeImage') {
            result = await analyzeImage(base64, mimeType, prompt);
            setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: result }}, message: 'Analysis complete.' });
        } else if (action === 'editImage') {
            result = await editImage(base64, mimeType, prompt);
            setWorkspaceState({ mode: 'result', content: { type: 'image', data: result}, message: 'Edit complete.' });
        } else if (action === 'transcribeAudio') {
            result = await transcribeAudio(base64, mimeType, prompt);
            setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: result }}, message: 'Transcription complete.' });
        } else if (action === 'generateVideo') {
            try {
              result = await generateVideo(base64, mimeType, prompt, '16:9', (status) => {
                setWorkspaceState(prev => ({...prev, message: status}));
              });
              setWorkspaceState({ mode: 'result', content: { type: 'video', data: result }, message: 'Video generated.' });
            } catch (e: any) {
               if (e.message === 'API_KEY_REQUIRED') {
                 setWorkspaceState(prev => ({...prev, mode: 'api_key_needed' }));
               } else {
                 throw e;
               }
            }
        }
      } catch (e) {
         setWorkspaceState({ mode: 'result', content: { type: 'text', data: { text: `An error occurred: ${e}`}}, message: 'Error.' });
      }
  };


  return (
    <main className="bg-black text-white w-screen h-screen overflow-hidden flex items-center justify-center font-sans">
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      <VoiceVisualizer isRecording={isRecording} isSpeaking={isSpeaking} micAmplitude={micAmplitude} />
      <TopBar
        onOpenSettings={() => setShowSettings(true)}
        onToggleCaptions={() => setShowCaptions(prev => !prev)}
        isCaptionsOn={showCaptions}
      />
      {showCaptions && conversation.length > 0 && <Captions conversation={conversation} />}
      <ControlBar
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        onHangUp={handleHangUp}
        onShowActions={() => setWorkspaceState({ mode: 'upload', uploadAction: 'analyzeImage', content: null, message: '' })}
      />
      {showSettings && (
        <Settings
          settings={appSettings}
          onSettingsChange={(newSettings) => setAppSettings(prev => ({ ...prev, ...newSettings }))}
          onClose={() => setShowSettings(false)}
          onShowServerSettings={() => setShowServerSettings(true)}
        />
      )}
      {workspaceState.mode !== 'idle' && (
        <Workspace
            workspaceState={workspaceState}
            onFileSelect={handleFileSelect}
            onPromptSubmit={handleWorkspacePrompt}
            onClearWorkspace={onClearWorkspace}
            onRecordingComplete={handleFileSelect}
            onSelectApiKey={async () => {
                await (window as any).aistudio.openSelectKey();
                // Assume success and retry
                handleWorkspacePrompt(workspaceState.content?.prompt || '');
            }}
        />
      )}

      {/* A simple placeholder for server settings */}
      {showServerSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowServerSettings(false)}>
            <div className="bg-neutral-800 p-6 rounded-lg" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold">Server Settings</h3>
                <p className="text-neutral-400 mt-2">Server settings are not configurable from this interface.</p>
                <button onClick={() => setShowServerSettings(false)} className="mt-4 bg-blue-600 px-4 py-2 rounded">Close</button>
            </div>
        </div>
      )}

      <style>
        {`
          .bg-grid-pattern {
            background-image: linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
            background-size: 2rem 2rem;
          }
        `}
      </style>
    </main>
  );
}

export default App;