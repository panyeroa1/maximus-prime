import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, Voice } from '../types';
import * as dataService from '../services/dataService';
import { AgentIcon, PlusIcon, SaveIcon, PlayIcon, PauseIcon, CheckCircleIcon, Trash2Icon, ChevronLeftIcon, VoiceIcon, EditIcon } from './icons';
import { LoadingIndicator } from './LoadingIndicator';
import { VOICE_PREVIEW_CONFIG, AGENT_TOOLS_OPTIONS } from '../constants';

const AgentsView: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [error, setError] = useState<string | null>(null);

    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
    const [audioCache, setAudioCache] = useState<Record<string, string>>({});
    const audioRef = useRef<HTMLAudioElement>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [fetchedAgents, fetchedVoices] = await Promise.all([
                dataService.getAgents(),
                dataService.getVoices()
            ]);
            setAgents(fetchedAgents);
            setVoices(fetchedVoices);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

    const handlePlayPreview = async (voiceId: string) => {
        const voice = voices.find(v => v.id === voiceId);
        if (!voice) return;
        
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
            setAudioCache(prev => ({...prev, [voice.id]: url}));
            
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


    const handleSelectAgent = (agent: Agent) => {
        setSelectedCardId(null); // Deselect card when entering edit mode
        setSelectedAgent({ ...agent, tools: agent.tools || [] }); // Ensure tools is an array
        setSaveStatus('idle'); // Reset save status when selecting a new agent
    };

    const handleCreateNewAgent = () => {
        const newAgent: Agent = {
            id: `new-agent-${Date.now()}`,
            name: 'New Agent',
            description: 'A new agent configuration.',
            voice: voices.length > 0 ? voices[0].id : '',
            systemPrompt: 'You are a helpful assistant.',
            firstSentence: 'Hello, how can I help you today?',
            thinkingMode: false,
            avatarUrl: null,
            tools: [],
        };
        setSelectedAgent(newAgent);
        setSaveStatus('idle');
    };
    
    const handleBackToList = () => {
        setSelectedAgent(null);
        setError(null);
    };

    const handleUpdateSelectedAgent = (field: keyof Agent, value: any) => {
        if (selectedAgent) {
            setSelectedAgent(prev => prev ? { ...prev, [field]: value } : null);
        }
    };

    const handleSaveChanges = async () => {
        if (!selectedAgent) return;

        setSaveStatus('saving');
        setError(null);
        try {
            await dataService.upsertAgents([selectedAgent]);
            setSaveStatus('success');

            setTimeout(async () => {
                await loadData();
                handleBackToList();
            }, 1500);

        } catch (err: any) {
            setError(err.message);
            setSaveStatus('idle');
        }
    };

    const handleDeleteAgent = async () => {
        if (!selectedAgent || selectedAgent.id.startsWith('new-agent')) return;
        if (!window.confirm(`Are you sure you want to delete the agent "${selectedAgent.name}"? This action cannot be undone.`)) {
            return;
        }
        
        setError(null);
        try {
            await dataService.deleteAgent(selectedAgent.id);
            await loadData();
            handleBackToList();
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    if (isLoading) {
        return <LoadingIndicator text="Loading Agents..." />;
    }

    if (selectedAgent) {
        return (
            <div className="p-8">
                <audio ref={audioRef} className="hidden" />
                {error && <div className="p-4 mb-4 text-center text-red-400 bg-red-900/50 border border-red-500 rounded-lg">{error}</div>}
                
                <div className="flex justify-between items-start gap-4 mb-6">
                    <button onClick={handleBackToList} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-eburon-panel transition-colors -ml-3">
                        <ChevronLeftIcon className="w-5 h-5" />
                        <span className="font-semibold">Back to Agents</span>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!selectedAgent.id.startsWith('new-agent-') && (
                            <button
                                onClick={handleDeleteAgent}
                                className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-red-800/50 hover:bg-red-800/80 text-red-200"
                            >
                                <Trash2Icon className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={handleSaveChanges} 
                            disabled={saveStatus !== 'idle'} 
                            className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200
                                ${saveStatus === 'idle' ? 'bg-eburon-accent hover:bg-eburon-accent-dark text-white' : ''}
                                ${saveStatus === 'saving' ? 'bg-gray-500 text-white cursor-not-allowed' : ''}
                                ${saveStatus === 'success' ? 'bg-eburon-ok text-white cursor-not-allowed' : ''}
                            `}
                        >
                            {saveStatus === 'saving' && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                            {saveStatus === 'success' && <CheckCircleIcon className="w-5 h-5" />}
                            {saveStatus === 'idle' && <SaveIcon className="w-5 h-5" />}
                            <span>
                                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save'}
                            </span>
                        </button>
                     </div>
                </div>

                <div className="space-y-6 max-w-4xl mx-auto">
                    <div>
                        <h2 className="text-3xl font-bold text-eburon-fg">{selectedAgent.name}</h2>
                        <p className="text-eburon-fg/70">Configure your AI agent's personality and tools.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="agentName" className="block text-sm font-medium text-eburon-fg/80 mb-1">Agent Name</label>
                            <input type="text" id="agentName" value={selectedAgent.name} onChange={e => handleUpdateSelectedAgent('name', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
                        </div>
                         <div>
                            <label htmlFor="agentVoice" className="block text-sm font-medium text-eburon-fg/80 mb-1">Voice</label>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                <select id="agentVoice" value={selectedAgent.voice} onChange={e => handleUpdateSelectedAgent('voice', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent">
                                    {voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                                </select>
                                <button
                                    onClick={() => handlePlayPreview(selectedAgent.voice)}
                                    disabled={!selectedAgent.voice || loadingVoiceId === selectedAgent.voice}
                                    className="p-2.5 rounded-lg hover:bg-white/10 text-eburon-fg disabled:opacity-50 bg-eburon-panel border border-eburon-border"
                                    aria-label={`Play preview for selected voice`}
                                >
                                    {loadingVoiceId === selectedAgent.voice ? (
                                        <div className="w-6 h-6 border-2 border-eburon-fg/50 border-t-eburon-fg rounded-full animate-spin"></div>
                                    ) : playingVoiceId === selectedAgent.voice ? (
                                        <PauseIcon className="w-6 h-6" />
                                    ) : (
                                        <PlayIcon className="w-6 h-6" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="agentDescription" className="block text-sm font-medium text-eburon-fg/80 mb-1">Description</label>
                        <textarea id="agentDescription" rows={2} value={selectedAgent.description} onChange={e => handleUpdateSelectedAgent('description', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" placeholder="A brief summary of the agent's purpose."></textarea>
                    </div>
                    <div>
                        <label htmlFor="firstSentence" className="block text-sm font-medium text-eburon-fg/80 mb-1">First Sentence</label>
                        <textarea id="firstSentence" rows={2} value={selectedAgent.firstSentence} onChange={e => handleUpdateSelectedAgent('firstSentence', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" placeholder="The first thing the agent says when the call connects."></textarea>
                    </div>
                    <div>
                        <label htmlFor="systemPrompt" className="block text-sm font-medium text-eburon-fg/80 mb-1">System Prompt</label>
                        <textarea id="systemPrompt" rows={8} value={selectedAgent.systemPrompt} onChange={e => handleUpdateSelectedAgent('systemPrompt', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-eburon-accent" placeholder="Define the agent's personality, instructions, and goals."></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-eburon-fg/80 mb-1">Tools</label>
                        <div className="bg-eburon-panel border border-eburon-border rounded-lg p-4 space-y-2">
                            <p className="text-xs text-eburon-fg/60">Select the functions this agent can use.</p>
                            <div className="space-y-1 max-h-48 pr-2">
                                {AGENT_TOOLS_OPTIONS.map(tool => (
                                    <label key={tool.name} htmlFor={`tool-${tool.name}`} className="flex items-start gap-3 p-2 rounded-md hover:bg-eburon-bg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            id={`tool-${tool.name}`}
                                            checked={(selectedAgent.tools || []).includes(tool.name)}
                                            onChange={(e) => {
                                                const currentTools = selectedAgent.tools || [];
                                                const newTools = e.target.checked
                                                    ? [...currentTools, tool.name]
                                                    : currentTools.filter(t => t !== tool.name);
                                                handleUpdateSelectedAgent('tools', newTools);
                                            }}
                                            className="mt-1 w-4 h-4 rounded text-eburon-accent bg-eburon-bg border-eburon-border focus:ring-eburon-accent focus:ring-offset-eburon-panel"
                                        />
                                        <div>
                                            <span className="font-semibold text-eburon-fg text-sm">{tool.name}</span>
                                            <p className="text-xs text-eburon-fg/70">{tool.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col">
            <audio ref={audioRef} className="hidden" />
            <div className="p-8 pb-6">
                <h1 className="text-3xl font-bold text-eburon-fg">Your Agents</h1>
                <p className="text-eburon-fg/70">Manage, create, and configure your voice AI agents.</p>
            </div>
            <div className="flex-grow p-8 pt-0">
                {error && <div className="p-4 text-center text-red-400">{error}</div>}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <button
                        onClick={handleCreateNewAgent}
                        className="bg-eburon-panel border-2 border-dashed border-eburon-border hover:border-eburon-accent hover:text-eburon-accent transition-colors duration-300 rounded-xl flex flex-col items-center justify-center p-6 text-eburon-fg/70 aspect-square"
                    >
                        <PlusIcon className="w-12 h-12 mb-2" />
                        <span className="font-semibold">Create New Agent</span>
                    </button>
                    {agents.map(agent => (
                        <div key={agent.id} className="relative group">
                             <button
                                onClick={() => setSelectedCardId(agent.id === selectedCardId ? null : agent.id)}
                                className={`bg-eburon-panel rounded-xl p-6 text-left flex flex-col h-full w-full hover:bg-white/5 hover:shadow-lg hover:shadow-eburon-accent/10 transition-all duration-300 transform hover:-translate-y-1 ${
                                    selectedCardId === agent.id 
                                    ? 'border-2 border-eburon-accent shadow-lg shadow-eburon-accent/20' 
                                    : 'border border-eburon-border hover:border-eburon-accent'
                                }`}
                            >
                                <div className="flex-grow">
                                    <div className="relative p-3 bg-eburon-bg border border-eburon-border rounded-lg inline-block mb-4 group-hover:border-eburon-accent/50 transition-colors">
                                        <AgentIcon className="w-8 h-8 text-eburon-accent" />
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayPreview(agent.voice);
                                            }}
                                            className="absolute inset-0 bg-eburon-accent/80 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:opacity-50"
                                            aria-label={`Play preview for ${agent.name}`}
                                        >
                                            {loadingVoiceId === agent.voice ? (
                                                <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                            ) : playingVoiceId === agent.voice ? (
                                                <PauseIcon className="w-6 h-6 text-white" />
                                            ) : (
                                                <PlayIcon className="w-6 h-6 text-white" />
                                            )}
                                        </button>
                                    </div>
                                    <h3 className="text-lg font-bold text-eburon-fg mb-2">{agent.name}</h3>
                                    <p title={agent.description || 'No description provided.'} className="text-sm text-eburon-fg/70 line-clamp-3 min-h-[60px]">{agent.description || 'No description provided.'}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-eburon-border flex items-center justify-between text-xs text-eburon-fg/60">
                                    <div className="flex items-center gap-1.5">
                                        <VoiceIcon className="w-4 h-4" />
                                        <span className="truncate">{voices.find(v => v.id === agent.voice)?.name || 'Default'}</span>
                                    </div>
                                    <span className="font-mono bg-eburon-bg px-2 py-0.5 rounded flex-shrink-0">{agent.tools?.length || 0} tools</span>
                                </div>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectAgent(agent);
                                }}
                                className="absolute top-4 right-4 p-2 rounded-lg bg-eburon-bg/50 backdrop-blur-sm text-eburon-fg/70 hover:text-eburon-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                                title={`Edit ${agent.name}`}
                            >
                                <EditIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AgentsView;
