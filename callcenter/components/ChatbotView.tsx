import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage } from '../types';
import { chatWithOllama, transcribeAudioWithOllama } from '../services/ollamaService';
import * as dataService from '../services/dataService';
import { SendIcon, PaperclipIcon, SearchIcon, CodeIcon, Trash2Icon, MicIcon, BrainCircuitIcon, GlobeIcon, StopIcon } from './icons';
import { EBURON_SYSTEM_PROMPT } from '../constants';
import { LoadingIndicator } from './LoadingIndicator';

type ModelMode = 'normal' | 'thinking' | 'fast';

interface ChatbotViewProps {
    setGeneratedAppHtml: (html: string | null) => void;
}

const ChatbotView: React.FC<ChatbotViewProps> = ({ setGeneratedAppHtml }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // Feature Toggles
    const [useSearchGrounding, setUseSearchGrounding] = useState(false);
    const [useMapsGrounding, setUseMapsGrounding] = useState(false);
    const [modelMode, setModelMode] = useState<ModelMode>('normal');
    const [isDeveloperMode, setIsDeveloperMode] = useState(false);
    
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number} | null>(null);
    const [locationError, setLocationError] = useState<string|null>(null);

    // Audio Transcription State
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        const loadHistory = async () => {
            setIsHistoryLoading(true);
            const history = await dataService.getChatbotMessages();
            setMessages(history);
            setIsHistoryLoading(false);
        };
        loadHistory();
    }, []);

    useEffect(() => {
        if (useMapsGrounding && !userLocation) {
            setLocationError(null);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    setLocationError("Could not get location. Maps grounding may not work as expected.");
                    setUseMapsGrounding(false); // Turn off if permission is denied
                }
            );
        }
    }, [useMapsGrounding, userLocation]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleClearChat = async () => {
        if (window.confirm('Are you sure you want to delete the entire chat history? This cannot be undone.')) {
            try {
                await dataService.clearChatbotMessages();
                setMessages([]);
            } catch (error) {
                console.error("Failed to clear chat history:", error);
                alert("Could not clear chat history. Please try again.");
            }
        }
    };
    
    const handleToggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                audioChunksRef.current = [];
                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };
                mediaRecorderRef.current.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    setIsTranscribing(true);
                    try {
                        const audioFile = new File([audioBlob], "recording.webm", { type: 'audio/webm' });
                        const transcribedText = await transcribeAudioWithOllama(audioFile);
                        setInput(prev => prev ? `${prev} ${transcribedText}` : transcribedText);
                    } catch (error) {
                        console.error("Transcription error", error);
                    } finally {
                        setIsTranscribing(false);
                    }
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (error) {
                console.error("Microphone access error", error);
            }
        }
    };


    const handleSend = useCallback(async () => {
        if (!input.trim() && !imageFile) return;
        
        setIsLoading(true);
        const startTime = performance.now();
        if (imageFile) {
            alert("Image inputs are not supported for the Ollama-powered assistant yet.");
            setIsLoading(false);
            return;
        }
        
        const userMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: input,
        };
        
        setMessages(prev => [...prev, userMessage]);
        await dataService.saveChatMessage(userMessage);

        const currentInput = input;
        const history = [...messages, userMessage];
        
        setInput('');
        setImageFile(null);
        setImagePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
        
        const systemPrompt = isDeveloperMode
            ? `You are an expert web developer. The user will ask you to build a web application. Your response MUST be a single block of HTML code. Do not include any explanation or markdown formatting. The HTML should be self-contained with TailwindCSS via CDN and any necessary Javascript in a script tag.`
            : EBURON_SYSTEM_PROMPT;

        try {
            const { text: responseText, tokensUsed } = await chatWithOllama(history, currentInput, systemPrompt);
            const fullText = responseText || 'No response received from Ollama.';
            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;
            const words = fullText.trim().split(/\s+/).filter(Boolean).length;
            const wps = durationSeconds > 0 ? Math.round(words / durationSeconds) : 0;
            const energy = ((fullText.length / 1000) * 0.005).toFixed(4);
            const tokenEstimate = tokensUsed ?? Math.round(fullText.length / 3.8);

            if (isDeveloperMode && fullText) {
                setGeneratedAppHtml(fullText);
            }

            const finalModelMessage: ChatMessage = {
                id: `msg-${Date.now() + 1}`,
                role: 'model',
                text: fullText,
                telemetry: {
                    tokensUsed: tokenEstimate,
                    energy: `${energy} kWh`,
                    wps,
                },
            };
            
            setMessages(prev => [...prev, finalModelMessage]);
            await dataService.saveChatMessage(finalModelMessage);

        } catch (error: any) {
            const errorMessage = error.message || "Sorry, I encountered an error. Please try again.";
            const errorModelMessage: ChatMessage = { id: `msg-${Date.now() + 1}`, role: 'model', text: errorMessage };
            setMessages(prev => [...prev, errorModelMessage]);
            await dataService.saveChatMessage(errorModelMessage);
        } finally {
            setIsLoading(false);
        }
    }, [input, imageFile, imagePreview, messages, useSearchGrounding, useMapsGrounding, modelMode, userLocation, isDeveloperMode, setGeneratedAppHtml]);


    return (
        <div className="h-full flex flex-col bg-eburon-bg text-eburon-fg">
            <header className="p-4 border-b border-eburon-border flex justify-between items-center flex-wrap gap-2">
                <h1 className="text-xl font-bold">Assistant</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handleClearChat} className="p-2 rounded-lg hover:bg-white/10 text-eburon-fg/70" title="Clear Chat History">
                        <Trash2Icon className="w-5 h-5" />
                    </button>
                    {/* Model Mode Selector */}
                    <div className="flex items-center bg-eburon-panel rounded-lg p-1 text-sm">
                        <button onClick={() => setModelMode('fast')} className={`px-3 py-1 rounded-md transition-colors ${modelMode === 'fast' ? 'bg-eburon-accent text-white' : 'hover:bg-white/10'}`}>Fast</button>
                        <button onClick={() => setModelMode('normal')} className={`px-3 py-1 rounded-md transition-colors ${modelMode === 'normal' ? 'bg-eburon-accent text-white' : 'hover:bg-white/10'}`}>Normal</button>
                        <button onClick={() => setModelMode('thinking')} className={`px-3 py-1 rounded-md transition-colors ${modelMode === 'thinking' ? 'bg-eburon-accent text-white' : 'hover:bg-white/10'}`}>Pro</button>
                    </div>

                    <button 
                        onClick={() => setUseSearchGrounding(!useSearchGrounding)} 
                        className={`p-2 rounded-lg transition-colors ${useSearchGrounding ? 'bg-eburon-accent text-white' : 'bg-eburon-panel hover:bg-white/10'}`} 
                        title="Toggle Web Search"
                    >
                        <SearchIcon className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={() => setUseMapsGrounding(!useMapsGrounding)} 
                        className={`p-2 rounded-lg transition-colors ${useMapsGrounding ? 'bg-eburon-accent text-white' : 'bg-eburon-panel hover:bg-white/10'}`} 
                        title="Toggle Maps Search"
                    >
                        <GlobeIcon className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={() => setIsDeveloperMode(!isDeveloperMode)} 
                        className={`p-2 rounded-lg transition-colors ${isDeveloperMode ? 'bg-eburon-accent text-white' : 'bg-eburon-panel hover:bg-white/10'}`} 
                        title="Toggle Developer Mode"
                    >
                        <CodeIcon className="w-5 h-5"/>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isHistoryLoading && <LoadingIndicator text="Loading history..." />}
                {messages.map((msg, index) => (
                    <div key={msg.id} className={`flex gap-4 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-eburon-accent flex items-center justify-center font-bold text-white text-sm flex-shrink-0">E</div>}
                        <div className={`max-w-xl p-4 rounded-xl ${msg.role === 'user' ? 'bg-eburon-accent text-white rounded-br-none' : 'bg-eburon-panel rounded-bl-none'}`}>
                            {(msg.image || msg.imageUrl) && <img src={msg.image || msg.imageUrl} alt="content" className="rounded-lg mb-2 max-w-xs"/>}
                            
                            <div className="whitespace-pre-wrap">
                                {isLoading && msg.text === '' && msg.role === 'model' ? (
                                    <div className="flex items-center justify-center p-2">
                                        <img src="https://eburon.ai/assets/icon-eburon.png" alt="Thinking..." className="w-8 h-8 rounded-full animate-pulse" />
                                    </div>
                                ) : msg.role === 'model' ? (
                                    <>
                                        {msg.text}
                                        {isLoading && index === messages.length - 1 && <span className="inline-block w-2.5 h-5 bg-eburon-fg animate-pulse ml-1 align-bottom"></span>}
                                    </>
                                ) : (
                                    msg.text
                                )}
                            </div>
                            
                            {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-white/20">
                                    <h4 className="text-xs font-semibold mb-2">Sources:</h4>
                                    <div className="flex flex-col gap-2">
                                        {msg.groundingChunks.map((chunk, index) => {
                                            const source = chunk.web || chunk.maps;
                                            return source && source.uri ? (
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" key={index} className="text-xs text-eburon-fg/80 hover:underline truncate">
                                                    {chunk.maps ? '📍' : '🌐'} {source.title || source.uri}
                                                </a>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}

                            {msg.role === 'model' && msg.telemetry && (
                                <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-eburon-fg/50 font-mono">
                                    <span>Tokens: {msg.telemetry.tokensUsed}</span>
                                    <span>Energy: {msg.telemetry.energy}</span>
                                    <span>WPS: {msg.telemetry.wps}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-eburon-border">
                 {imagePreview && (
                    <div className="relative w-24 h-24 mb-2 p-1 border border-eburon-border rounded-lg">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded"/>
                        <button onClick={removeImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">&times;</button>
                    </div>
                )}
                <div className="bg-eburon-panel rounded-xl flex items-center p-2">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        ref={fileInputRef}
                        className="hidden"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-eburon-fg/70 hover:text-eburon-fg">
                        <PaperclipIcon className="w-6 h-6" />
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                        placeholder={isRecording ? 'Recording...' : isTranscribing ? 'Transcribing...' : 'Type a message or use the mic...'}
                        className="flex-1 bg-transparent focus:outline-none px-2"
                        disabled={isLoading || isRecording || isTranscribing}
                    />
                    <button onClick={handleToggleRecording} disabled={isLoading || isTranscribing} className={`p-3 rounded-lg transition-colors ${isRecording ? 'bg-red-500 text-white' : 'text-eburon-fg/70 hover:text-eburon-fg'}`}>
                        {isTranscribing ? <img src="https://eburon.ai/assets/icon-eburon.png" alt="Transcribing..." className="w-6 h-6 rounded-full animate-pulse" /> : isRecording ? <StopIcon className="w-6 h-6"/> : <MicIcon className="w-6 h-6" />}
                    </button>
                    <button onClick={handleSend} disabled={isLoading || (!input.trim() && !imageFile)} className="p-3 rounded-lg bg-eburon-accent text-white disabled:bg-gray-500 transition-colors ml-2">
                        <SendIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatbotView;
