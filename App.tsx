import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveServerMessage, Modality, Blob, CloseEvent, ErrorEvent, GenerateContentResponse, FunctionCall } from '@google/genai';

// Components
import { TopBar } from './components/TopBar';
import { ControlBar } from './components/ControlBar';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Captions } from './components/Captions';
import { Settings } from './components/Settings';
import { Workspace } from './components/Workspace';

// Services
import * as geminiService from './services/geminiService';
import * as subAgentService from './services/subAgentService';
import { decode, decodeAudioData, encode } from './services/audioUtils';

// Types & Constants
import { AppSettings, ConversationTurn, WorkspaceState, WorkspaceContent, GroundingSource } from './types';
import { ALL_TOOLS } from './constants/tools';

const DEFAULT_SYSTEM_INSTRUCTION = `You are Maximus, a state-of-the-art, conversational AI assistant. Your primary function is to engage in natural, helpful, and friendly voice-based conversations. You have access to a variety of tools to answer questions, generate content, and perform tasks.

RULES:
- Be concise but not abrupt. Your default speaking style is friendly and conversational.
- When a user asks you to perform a task that requires a tool (e.g., "show me a picture of..."), use the appropriate tool.
- Announce that you are using a tool, for example, "Sure, generating an image of that for you now." or "Okay, let me search the web for the latest information on that."
- If you use Google Search or Google Maps, you MUST cite your sources at the end of your response.
- Your responses should be formatted for spoken language. Avoid complex markdown or formatting that doesn't translate well to speech.
- If you cannot fulfill a request, explain why clearly and politely.
- Maintain a helpful and engaging persona throughout the conversation.`;

const blobToBase64 = (blob: globalThis.Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Return the full data URL
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64 string.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};


export default function App() {
  // App State
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  
  // Session & Media State
  const [isSessionActive, setIsSessionActive] = useState(false); // Represents an active call
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false); // User has enabled microphone
  
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({ mode: 'idle', content: null, message: '' });
  
  // Refs for media and session management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextAudioStartTimeRef = useRef<number>(0);
  
  // Refs for transcription buffering
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  
  // --- Initialization ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('maximus-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    } else {
      const defaultSettings: AppSettings = {
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        voice: 'Zephyr',
        enabledTools: ALL_TOOLS.map(t => t.name),
        serverSettings: {
          googleCloudProjectId: '', googleCloudServiceAccountJson: '',
          twilioSid: '', twilioAuthToken: '',
          blandApiKey: '', cartesiaApiKey: '', elevenLabsApiKey: '',
          ollamaCloudEndpoint: '', ollamaCloudApiKey: '',
        },
      };
      setSettings(defaultSettings);
    }
  }, []);

  // --- Utility Functions ---
  const addTurn = useCallback((turn: Omit<ConversationTurn, 'timestamp'>) => {
    setConversation(prev => [...prev, { ...turn, timestamp: Date.now() }]);
  }, []);

  const clearWorkspace = useCallback(() => {
    setWorkspaceState({ mode: 'idle', content: null, message: '' });
  }, []);

  // --- Audio Management ---
  const playAudio = useCallback(async (base64Audio: string) => {
    if (!outputAudioContextRef.current) return;
    setIsModelSpeaking(true);
    try {
      const decodedAudio = decode(base64Audio);
      const audioBuffer = await decodeAudioData(decodedAudio, outputAudioContextRef.current, 24000, 1);
      
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
          setIsModelSpeaking(false);
        }
      };
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsModelSpeaking(false);
    }
  }, []);

  const stopAllAudio = useCallback(() => {
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) { /* Ignore errors */ }
    });
    audioSourcesRef.current.clear();
    nextAudioStartTimeRef.current = 0;
    setIsModelSpeaking(false);
  }, []);

  // --- Tool Execution ---
  const handleToolCall = useCallback(async (toolCall: FunctionCall) => {
    if (!settings) return;
    const { name, args, id } = toolCall;
    addTurn({ speaker: 'system', text: `Executing tool: ${name}...` });

    let result: any;
    let workspaceContent: WorkspaceContent | null = null;
    let toolError: string | null = null;

    try {
      switch (name) {
        case 'generateImage':
          const imageUrl = await geminiService.generateImage(args.prompt, args.aspectRatio);
          workspaceContent = { type: 'image', data: imageUrl, prompt: args.prompt };
          result = { success: true, message: `Image generated and displayed.` };
          break;
        case 'groundedSearch':
          const searchResponse = await geminiService.generateTextWithGoogleSearch(args.query);
          const searchSources = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web) || [];
          workspaceContent = { type: 'grounding_search', data: { text: searchResponse.text, sources: searchSources }};
          result = { success: true, text: searchResponse.text, sources: searchSources.map((s:any) => s.uri) };
          break;
        case 'groundedMapSearch':
           const mapResponse = await geminiService.generateTextWithGoogleMaps(args.query);
           const mapSources = mapResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.maps) || [];
           workspaceContent = { type: 'grounding_maps', data: { text: mapResponse.text, sources: mapSources }};
           result = { success: true, text: mapResponse.text, sources: mapSources.map((s:any) => s.uri) };
           break;
        case 'quickQuery':
          const quickText = await geminiService.generateLowLatencyText(args.query);
          result = { text: quickText };
          addTurn({ speaker: 'model', text: quickText }); // Also show in captions
          break;
        case 'speakText':
           const audioB64 = await geminiService.generateSpeech(args.text);
           await playAudio(audioB64);
           result = { success: true, message: `Spoke the text.` };
           break;
        case 'generateCode':
            const code = await geminiService.generateProText(`Generate ${args.language} code for the following description: ${args.description}`);
            workspaceContent = { type: 'code', data: { language: args.language, text: code } };
            result = { success: true, message: `Code generated and displayed.` };
            break;
        case 'summarizeLongText':
             const summary = await geminiService.generateProText(`Task: ${args.request}. Text: ${args.text}`);
             workspaceContent = { type: 'text', data: summary };
             result = { success: true, summary: summary };
             break;
        case 'useSubAgentLLM':
            const subAgentRes = await subAgentService.callSubAgent(args.provider, args.prompt, args.model, settings.serverSettings);
            result = { success: true, response: subAgentRes.text };
            addTurn({ speaker: 'model', text: `Sub-agent response: ${subAgentRes.text}` });
            break;
        default:
          throw new Error(`Tool "${name}" is declared but not implemented.`);
      }
      if (workspaceContent) {
        setWorkspaceState({ mode: 'result', content: workspaceContent, message: '' });
      }
    } catch (e: any) {
      console.error(`Error executing tool ${name}:`, e);
      addTurn({ speaker: 'system', text: `Error: ${e.message}` });
      toolError = e.message;
      result = { error: toolError };
    }

    // Send response back to the model
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.sendToolResponse({
            functionResponses: { id, name, response: { result } }
        });
    }
  }, [settings, addTurn, playAudio]);
  
  // --- Workspace Actions ---
  const handleWorkspaceSubmit = async (prompt: string) => {
    if (!workspaceState.content || !workspaceState.uploadAction) return;

    setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'Working on it...' }));
    const { data } = workspaceState.content;

    try {
        let resultText: string | undefined;
        let resultMediaUrl: string | undefined;
        let newContentType: WorkspaceContent['type'] = 'text';

        const base64Data = data.split(',')[1];
        const mimeType = data.match(/:(.*?);/)?.[1];
        if (!base64Data || !mimeType) throw new Error("Invalid file data.");

        switch (workspaceState.uploadAction) {
            case 'analyzeImage':
                resultText = await geminiService.analyzeImage(base64Data, mimeType, prompt);
                break;
            case 'editImage':
                resultMediaUrl = await geminiService.editImage(base64Data, mimeType, prompt);
                newContentType = 'image';
                break;
            case 'generateVideo':
                 handleGenerateVideo(base64Data, mimeType, prompt);
                 return; // Manages its own state
            case 'transcribeAudio':
                resultText = await geminiService.transcribeAudio(base64Data, mimeType, prompt);
                break;
        }

        setWorkspaceState(prev => ({
            ...prev,
            mode: 'result',
            content: {
                ...prev.content!,
                type: newContentType,
                data: resultMediaUrl || resultText,
            },
            uploadAction: undefined,
        }));

    } catch (error: any) {
        setWorkspaceState(prev => ({ ...prev, mode: 'result', content: { type: 'text', data: `Error: ${error.message}` }}));
    }
  };

  const handleGenerateVideo = async (base64: string, mimeType: string, prompt: string) => {
    const onProgress = (message: string) => {
        setWorkspaceState(prev => ({ ...prev, mode: 'processing', message }));
    };
    try {
        const videoUrl = await geminiService.generateVideo(base64, mimeType, prompt, '16:9', onProgress);
        setWorkspaceState(prev => ({ ...prev, mode: 'result', content: { type: 'video', data: videoUrl }}));
    } catch (error: any) {
        if (error.message === 'API_KEY_REQUIRED') {
            setWorkspaceState(prev => ({ ...prev, mode: 'api_key_needed', content: prev.content, message: '' }));
        } else {
            setWorkspaceState(prev => ({ ...prev, mode: 'result', content: { type: 'text', data: `Error: ${error.message}` }}));
        }
    }
  };

  const handleFileSelect = async (file: File) => {
    setWorkspaceState(prev => ({ ...prev, mode: 'processing', message: 'Preparing file...' }));
    const dataUrl = await blobToBase64(file);
    const type = file.type.startsWith('image') ? 'image' : 'video';
    setWorkspaceState(prev => ({ ...prev, mode: 'result', content: { type, data: dataUrl }}));
  };

  // --- Live Session Management ---
  const startSession = useCallback(async () => {
    if (!settings || isSessionActive) return;
    setIsSessionActive(true);
    addTurn({ speaker: 'system', text: 'Connecting...' });

    // Initialize audio contexts
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const callbacks = {
        onopen: () => {
          addTurn({ speaker: 'system', text: 'Connection established. You can start talking.' });
          const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
          const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = scriptProcessor;

          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob: Blob = {
              data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContextRef.current!.destination);
        },
        onmessage: (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            playAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
          }
          if (message.toolCall) {
            message.toolCall.functionCalls.forEach(handleToolCall);
          }
          if (message.serverContent?.interrupted) {
             stopAllAudio();
          }
          // Handle transcriptions
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
        },
        onclose: (e: CloseEvent) => {
          addTurn({ speaker: 'system', text: 'Connection closed.' });
          endSession();
        },
        onerror: (e: ErrorEvent) => {
          console.error('Session error:', e);
          addTurn({ speaker: 'system', text: `An error occurred: ${e.message}` });
          endSession();
        },
      };

      sessionPromiseRef.current = geminiService.startLiveSession(settings, callbacks);
    } catch (err) {
      console.error("Failed to start session:", err);
      addTurn({ speaker: 'system', text: "Failed to get microphone permissions." });
      setIsSessionActive(false);
    }
  }, [settings, isSessionActive, addTurn, playAudio, stopAllAudio, handleToolCall]);

  const endSession = useCallback(() => {
    setIsSessionActive(false);
    setIsMicActive(false);
    stopAllAudio();

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();

    sessionPromiseRef.current?.then(session => session.close());

    mediaStreamRef.current = null;
    scriptProcessorRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    sessionPromiseRef.current = null;
  }, [stopAllAudio]);

  const onToggleRecording = () => {
    if (!isSessionActive) {
        startSession();
    }
    setIsMicActive(prev => !prev); // This button just toggles mute in this setup
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('maximus-settings', JSON.stringify(newSettings));
    setShowSettings(false);
    addTurn({ speaker: 'system', text: 'Settings updated.' });
  };
  
  if (!settings) {
    return <div className="bg-black text-white w-screen h-screen flex items-center justify-center">Loading Settings...</div>;
  }
  
  return (
    <div className="bg-black text-white w-screen h-screen overflow-hidden flex flex-col items-center justify-center font-sans">
      <TopBar 
        onOpenSettings={() => setShowSettings(true)}
        isCaptionsOn={showCaptions}
        onToggleCaptions={() => setShowCaptions(p => !p)}
      />
      
      <VoiceVisualizer isRecording={isMicActive} isSpeaking={isModelSpeaking} />

      {showCaptions && <Captions conversation={conversation} />}
      
      {workspaceState.mode !== 'idle' && (
        <Workspace 
          workspaceState={workspaceState}
          onClearWorkspace={clearWorkspace}
          onFileSelect={handleFileSelect}
          onPromptSubmit={handleWorkspaceSubmit}
          onRecordingComplete={handleFileSelect} // Recordings become files
          onSelectApiKey={async () => {
             await (window as any).aistudio.openSelectKey();
             // Re-attempt last action after key selection
             if (workspaceState.content?.data && workspaceState.uploadAction === 'generateVideo') {
                 const { data } = workspaceState.content;
                 const base64Data = data.split(',')[1];
                 const mimeType = data.match(/:(.*?);/)?.[1];
                 // This assumes a prompt was already entered, which isn't guaranteed.
                 // A more robust solution would store the pending action and prompt.
                 handleGenerateVideo(base64Data, mimeType, workspaceState.content.prompt || "Generate a video");
             }
          }}
        />
      )}
      
      {showSettings && (
        <Settings
          initialSystemInstruction={settings.systemInstruction}
          initialVoice={settings.voice}
          initialEnabledTools={settings.enabledTools}
          initialServerSettings={settings.serverSettings}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}

      <ControlBar
        isRecording={isMicActive}
        onToggleRecording={onToggleRecording}
        onHangUp={endSession}
        onShowActions={() => {
            // A simple way to open workspace for general use
            if(workspaceState.mode === 'idle') {
                setWorkspaceState({ mode: 'upload', content: null, message: 'Upload a file', uploadAction: 'analyzeImage' });
            }
        }}
      />
    </div>
  );
}
