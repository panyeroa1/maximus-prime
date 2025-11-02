import React, { useState, useEffect, useCallback, Suspense, useRef, useMemo } from 'react';
import { Voice } from '../types';
import * as dataService from '../services/dataService';
import { LoadingIndicator } from './LoadingIndicator';
import { SpeakerIcon, CloneIcon, PlayIcon, PauseIcon, EditIcon, SearchIcon } from './icons';
import { VOICE_PREVIEW_CONFIG } from '../constants';
import { EditVoiceModal } from './EditVoiceModal';

const CloneVoiceView = React.lazy(() => import('./CloneVoiceView'));

type ViewMode = 'list' | 'clone';

const VoiceCard: React.FC<{
    voice: Voice;
    onPlay: () => void;
    onEdit: () => void;
    isPlaying: boolean;
    isLoading: boolean;
}> = ({ voice, onPlay, onEdit, isPlaying, isLoading }) => {
    return (
        <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 text-left flex flex-col h-full hover:border-eburon-accent/70 hover:shadow-lg hover:shadow-eburon-accent/10 transition-all duration-300 transform hover:-translate-y-1 group">
            <div className="flex justify-between items-start">
                <div className="p-3 bg-eburon-bg border border-eburon-border rounded-lg inline-block mb-4 group-hover:border-eburon-accent/50 transition-colors">
                    <SpeakerIcon className={`w-8 h-8 transition-colors ${voice.type === 'Cloned' ? 'text-eburon-ok' : 'text-eburon-accent'}`} />
                </div>
                <button
                    onClick={onEdit}
                    className="p-2 rounded-lg text-eburon-fg/50 hover:bg-eburon-bg hover:text-eburon-accent transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit tags"
                >
                    <EditIcon className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-grow">
                <h3 className="text-lg font-bold text-eburon-fg mb-2 truncate" title={voice.name}>{voice.name}</h3>
                <div className="flex flex-wrap gap-2 min-h-[24px]">
                    {voice.tags?.map(tag => (
                        <span key={tag} className="bg-eburon-bg border border-eburon-border text-eburon-accent px-2.5 py-0.5 rounded-full text-xs font-semibold">{tag}</span>
                    ))}
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-eburon-border flex items-center justify-between text-xs text-eburon-fg/60">
                <span className={`font-semibold ${voice.type === 'Cloned' ? 'text-eburon-ok/80' : 'text-eburon-fg/60'}`}>{voice.type} Voice</span>
                <button
                    onClick={onPlay}
                    disabled={isLoading}
                    className="relative w-12 h-12 flex items-center justify-center rounded-full bg-eburon-bg border border-eburon-border text-eburon-accent hover:border-eburon-accent transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Play preview for ${voice.name}`}
                >
                    {isLoading ? (
                        <div className="w-6 h-6 border-2 border-eburon-fg/50 border-t-eburon-fg rounded-full animate-spin"></div>
                    ) : isPlaying ? (
                        <>
                            <div className="absolute h-full w-full rounded-full bg-eburon-accent opacity-75 animate-ping"></div>
                            <div className="relative w-full h-full bg-eburon-accent rounded-full flex items-center justify-center">
                                <PauseIcon className="w-6 h-6 text-white" />
                            </div>
                        </>
                    ) : (
                        <PlayIcon className="w-6 h-6" />
                    )}
                </button>
            </div>
        </div>
    );
};


const VoicesView: React.FC = () => {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
    const [audioCache, setAudioCache] = useState<Record<string, string>>({});
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [filterTerm, setFilterTerm] = useState('');
    const [editingVoice, setEditingVoice] = useState<Voice | null>(null);

    const loadVoices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedVoices = await dataService.getVoices();
            setVoices(fetchedVoices);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (viewMode === 'list') {
            loadVoices();
        }
    }, [viewMode, loadVoices]);

    useEffect(() => {
        const audio = audioRef.current;
        const onEnded = () => setPlayingVoiceId(null);
        audio?.addEventListener('ended', onEnded);
        return () => audio?.removeEventListener('ended', onEnded);
    }, []);

    const getLanguageFromTags = (tags: string[] = []): string => {
        const supportedLangs = Object.keys(VOICE_PREVIEW_CONFIG);
        for (const tag of tags) {
            const lang = tag.toLowerCase();
            if (supportedLangs.includes(lang)) {
                return lang;
            }
        }
        return 'default';
    };

    const handlePlayPreview = async (voice: Voice) => {
        if (loadingVoiceId === voice.id) return;

        if (playingVoiceId === voice.id) {
            audioRef.current?.pause();
            setPlayingVoiceId(null);
            return;
        }

        setPlayingVoiceId(null);
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        if (audioCache[voice.id]) {
            if (audioRef.current) {
                audioRef.current.src = audioCache[voice.id];
                audioRef.current.play();
                setPlayingVoiceId(voice.id);
            }
            return;
        }

        setLoadingVoiceId(voice.id);
        setError(null);
        try {
            const langKey = getLanguageFromTags(voice.tags);
            const config = VOICE_PREVIEW_CONFIG[langKey] || VOICE_PREVIEW_CONFIG.default;

            const audioBlob = await dataService.generateVoiceSample(voice, config.text, config.langCode);
            const url = URL.createObjectURL(audioBlob);
            setAudioCache(prev => ({ ...prev, [voice.id]: url }));

            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
                setPlayingVoiceId(voice.id);
            }
        } catch (err: any) {
            setError(err.message);
            console.error(err);
        } finally {
            setLoadingVoiceId(null);
        }
    };
    
    const handleSaveTags = async (updatedTags: string[]) => {
        if (!editingVoice) return;
        await dataService.updateVoiceTags(editingVoice.id, updatedTags);
        // Refresh the list to show updated tags
        await loadVoices();
    };
    
    const filteredVoices = useMemo(() => {
        if (!filterTerm) return voices;
        const lowercasedFilter = filterTerm.toLowerCase();
        return voices.filter(voice => 
            voice.name.toLowerCase().includes(lowercasedFilter) ||
            voice.tags?.some(tag => tag.toLowerCase().includes(lowercasedFilter))
        );
    }, [voices, filterTerm]);


    if (viewMode === 'clone') {
        return (
             <Suspense fallback={<LoadingIndicator text="Loading Voice Cloner..." />}>
                <CloneVoiceView />
            </Suspense>
        );
    }
    
    const prebuiltVoices = filteredVoices.filter(v => v.type === 'Prebuilt');
    const clonedVoices = filteredVoices.filter(v => v.type === 'Cloned');

    return (
        <div className="p-8">
            {editingVoice && (
                <EditVoiceModal 
                    voice={editingVoice}
                    onClose={() => setEditingVoice(null)}
                    onSave={handleSaveTags}
                />
            )}
            <audio ref={audioRef} className="hidden" />
            <div className="flex justify-between items-start gap-4 mb-6 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-eburon-fg">Voice Library</h1>
                    <p className="text-eburon-fg/70">Manage your pre-built and custom cloned voices.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="relative">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-eburon-fg/50" />
                        <input 
                            type="text" 
                            placeholder="Filter voices..." 
                            value={filterTerm}
                            onChange={e => setFilterTerm(e.target.value)}
                            className="bg-eburon-panel border border-eburon-border rounded-lg pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                        />
                    </div>
                    <button
                        onClick={() => setViewMode('clone')}
                        className="bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-6 rounded-lg transition-colors duration-150 flex items-center gap-2"
                    >
                        <CloneIcon className="w-6 h-6" />
                        <span>Clone Voice</span>
                    </button>
                 </div>
            </div>
            
            {isLoading && <LoadingIndicator text="Loading Voices..." />}
            {error && <div className="p-4 text-center text-red-400 bg-red-900/50 border border-red-500 rounded-lg">{error}</div>}

            {!isLoading && !error && (
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold text-eburon-fg mb-4">Pre-built Voices</h2>
                        {prebuiltVoices.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {prebuiltVoices.map(voice => (
                                    <VoiceCard
                                        key={voice.id}
                                        voice={voice}
                                        onPlay={() => handlePlayPreview(voice)}
                                        onEdit={() => setEditingVoice(voice)}
                                        isPlaying={playingVoiceId === voice.id}
                                        isLoading={loadingVoiceId === voice.id}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-eburon-fg/60">No pre-built voices match your filter.</p>
                        )}
                    </section>
                     <section>
                        <h2 className="text-xl font-semibold text-eburon-fg mb-4">Your Cloned Voices</h2>
                        {clonedVoices.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {clonedVoices.map(voice => (
                                    <VoiceCard
                                        key={voice.id}
                                        voice={voice}
                                        onPlay={() => handlePlayPreview(voice)}
                                        onEdit={() => setEditingVoice(voice)}
                                        isPlaying={playingVoiceId === voice.id}
                                        isLoading={loadingVoiceId === voice.id}
                                    />
                                ))}
                            </div>
                         ) : filterTerm ? (
                             <p className="text-eburon-fg/60">No cloned voices match your filter.</p>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                <button
                                    onClick={() => setViewMode('clone')}
                                    className="bg-eburon-panel border-2 border-dashed border-eburon-border hover:border-eburon-accent hover:text-eburon-accent transition-colors duration-300 rounded-xl flex flex-col items-center justify-center p-6 text-eburon-fg/70 aspect-square"
                                >
                                    <CloneIcon className="w-12 h-12 mb-2" />
                                    <span className="font-semibold">Clone Your First Voice</span>
                                </button>
                             </div>
                         )}
                    </section>
                </div>
            )}
        </div>
    );
};

export default VoicesView;
