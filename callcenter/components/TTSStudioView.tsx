import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Voice, TtsGeneration } from '../types';
import * as dataService from '../services/dataService';
import { uploadTtsAudio } from '../services/supabaseService';
import { LoadingIndicator } from './LoadingIndicator';
import { SoundWaveIcon, PlayIcon, PauseIcon, DownloadIcon, SpeakerIcon, ClipboardEditIcon, HistoryIcon } from './icons';
import SsmlEditor, { SsmlEditorRef } from './SsmlEditor';
import SsmlSuggestions from './SsmlSuggestions';

const TTSStudioView: React.FC = () => {
    // General State
    const [activeTab, setActiveTab] = useState<'generator' | 'history'>('generator');
    const [error, setError] = useState<string | null>(null);
    
    // Generator State
    const [text, setText] = useState('<speak>\n  <p>Hello, welcome to the Eburon AI Text-to-Speech studio.</p>\n</speak>');
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
    const editorRef = useRef<SsmlEditorRef>(null);

    // History State
    const [generations, setGenerations] = useState<TtsGeneration[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // Audio Playback State
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());

    const loadInitialData = useCallback(async () => {
        setIsLoadingHistory(true);
        setError(null);
        try {
            const [fetchedVoices, fetchedGenerations] = await Promise.all([
                dataService.getVoices(),
                dataService.getTtsGenerations()
            ]);
            
            setVoices(fetchedVoices);

            if (fetchedVoices.length > 0) {
                const aylaVoice = fetchedVoices.find(v => v.name === 'Eburon Ayla');
                setSelectedVoiceId(aylaVoice?.id || fetchedVoices[0].id);
            }
            setGenerations(fetchedGenerations);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);
    
    useEffect(() => {
        const audio = audioRef.current;
        const handleEnded = () => setPlayingId(null);
        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, []);

    const handlePlayPause = (id: string, url: string) => {
        const audio = audioRef.current;
        if (playingId === id) {
            audio.pause();
            setPlayingId(null);
        } else {
            audio.src = url;
            audio.play().catch(e => {
                setError("Audio playback failed. The audio URL might be expired if it's from an old session.");
                console.error(e);
            });
            setPlayingId(id);
        }
    };

    const handleGenerate = async () => {
        if (!text.trim() || !selectedVoiceId) {
            setError("Please enter some text and select a voice.");
            return;
        }
        setIsGenerating(true);
        setError(null);
        setGeneratedAudioUrl(null);
        if (playingId) {
            audioRef.current.pause();
            setPlayingId(null);
        }

        try {
            const audioBlob = await dataService.generateTts(text, selectedVoiceId);
            
            const permanentUrl = await uploadTtsAudio(audioBlob);
            setGeneratedAudioUrl(permanentUrl);
            
            const newGeneration = await dataService.saveTtsGeneration({
                input_text: text,
                audio_url: permanentUrl,
            });
            setGenerations(prev => [newGeneration, ...prev]);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleInsertSnippet = (snippet: string) => {
        editorRef.current?.insertSnippet(snippet);
    };

    const handleHistoryTextChange = (id: string, newText: string) => {
        setGenerations(prev => 
            prev.map(gen => gen.id === id ? { ...gen, input_text: newText } : gen)
        );
    };

    const handleUseAndEdit = (textToUse: string) => {
        setText(textToUse);
        setActiveTab('generator');
    };

    const TabButton: React.FC<{
        label: string;
        isActive: boolean;
        onClick: () => void;
        icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    }> = ({ label, isActive, onClick, icon: Icon }) => (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                isActive
                ? 'border-eburon-accent text-eburon-accent'
                : 'border-transparent text-eburon-fg/70 hover:text-eburon-fg hover:border-eburon-border'
            }`}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col p-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-eburon-fg">TTS Studio</h1>
                <p className="text-eburon-fg/70">Generate speech from text using SSML for advanced control.</p>
            </div>
            
            {error && <div className="p-4 text-center text-red-400 bg-red-900/50 border border-red-500 rounded-lg">{error}</div>}
            
            <div className="flex border-b border-eburon-border">
                <TabButton label="Generator" icon={SoundWaveIcon} isActive={activeTab === 'generator'} onClick={() => setActiveTab('generator')} />
                <TabButton label="History" icon={HistoryIcon} isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            </div>

            <div className="flex-grow overflow-hidden">
                {activeTab === 'generator' && (
                    <div className="bg-eburon-panel border border-eburon-border rounded-xl flex flex-col p-6 gap-4">
                        <div className="flex-grow flex flex-col min-h-0">
                            <SsmlEditor 
                                ref={editorRef}
                                value={text}
                                onChange={setText}
                                disabled={isGenerating}
                                placeholder="Enter text or SSML here..."
                                className="min-h-[200px]"
                            />
                            <div className="mt-2">
                                <SsmlSuggestions onInsert={handleInsertSnippet} disabled={isGenerating} />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label htmlFor="voice-select" className="block text-sm font-medium text-eburon-fg/80 mb-1">Voice</label>
                                <select
                                    id="voice-select"
                                    value={selectedVoiceId}
                                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                                    disabled={isGenerating || voices.length === 0}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                                >
                                    {voices.map(voice => (
                                        <option key={voice.id} value={voice.id}>{voice.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !text.trim() || !selectedVoiceId}
                                className="w-full bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-6 rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <SoundWaveIcon className="w-5 h-5" />
                                        <span>Generate Audio</span>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {generatedAudioUrl && (
                            <div className="mt-2 bg-eburon-bg p-3 rounded-lg flex items-center gap-3 border border-eburon-border">
                                <button onClick={() => handlePlayPause('latest_generation', generatedAudioUrl)} className="p-3 text-eburon-accent hover:bg-eburon-panel rounded-full">
                                    {playingId === 'latest_generation' ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
                                </button>
                                <div className="flex-grow text-sm text-eburon-fg/80">
                                    Latest Generation
                                </div>
                                <a href={generatedAudioUrl} download={`eburon-tts-${Date.now()}.wav`} className="p-3 text-eburon-fg/70 hover:text-eburon-fg hover:bg-eburon-panel rounded-full">
                                    <DownloadIcon className="w-6 h-6"/>
                                </a>
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'history' && (
                    <div className="flex flex-col">
                        <div className="flex-grow pr-2">
                            {isLoadingHistory ? (
                                <LoadingIndicator text="Loading history..." />
                            ) : generations.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-eburon-fg/60">
                                    <SpeakerIcon className="w-12 h-12 mb-2" />
                                    <p>No generations yet.</p>
                                    <p className="text-sm">Your generated audio will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {generations.map(gen => (
                                        <div key={gen.id} className="bg-eburon-panel border border-eburon-border rounded-xl p-4 flex flex-col gap-3">
                                            <textarea
                                                value={gen.input_text}
                                                onChange={(e) => handleHistoryTextChange(gen.id, e.target.value)}
                                                className="w-full bg-eburon-bg border border-eburon-border rounded-md p-2 font-mono text-sm h-24 resize-y focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                                spellCheck="false"
                                            />
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handlePlayPause(gen.id, gen.audio_url)} className="p-2 text-eburon-accent hover:bg-eburon-bg rounded-full" title="Play/Pause">
                                                        {playingId === gen.id ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                                                    </button>
                                                    <a href={gen.audio_url} download={`eburon-tts-${gen.id}.wav`} className="p-2 text-eburon-fg/70 hover:text-eburon-fg hover:bg-eburon-bg rounded-full" title="Download">
                                                        <DownloadIcon className="w-5 h-5"/>
                                                    </a>
                                                </div>
                                                <p className="text-xs text-eburon-fg/60">{new Date(gen.created_at).toLocaleString()}</p>
                                                <button onClick={() => handleUseAndEdit(gen.input_text)} className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-md bg-eburon-accent/20 hover:bg-eburon-accent/40 transition-colors text-eburon-accent font-semibold">
                                                    <ClipboardEditIcon className="w-4 h-4" />
                                                    Use & Edit
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TTSStudioView;
