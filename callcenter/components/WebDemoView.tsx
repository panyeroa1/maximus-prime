import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Template, Agent, LiveTranscript } from '../types';
import { useGeminiLiveAgent } from '../hooks/useGeminiLive';
import * as dataService from '../services/dataService';
import { IphoneSimulator } from './IphoneSimulator';
import { LoadingIndicator } from './LoadingIndicator';
import { AgentIcon, UserIcon, GlobeIcon, MicIcon, PhoneIcon, ClipboardEditIcon, SaveIcon, CheckCircleIcon } from './icons';
import { AUDIO_ASSETS } from '../constants';
import { useIsMobile } from '../hooks/useIsMobile';
import { AudioVisualizer } from './AudioVisualizer';
import { ActionLogToast } from './ActionLogToast';

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

interface WebDemoViewProps {
    template: Template;
    onEndDemo: () => void;
}

const LANGUAGE_MENU_PROMPT = `<speak>
    <p>Thank you for calling Turkish Airlines. Your call is important to us. Please note that this call may be recorded for quality assurance and training purposes. Thank you.</p>
    <break time="1000ms"/>
    <p>To continue in English, press 1.</p>
    <p>Türkçe devam etmek için 2'ye basın.</p>
    <p>To speak to one of our customer service representatives, please press 0.</p>
</speak>`;

const DEPARTMENT_MENU_PROMPT = `<speak>
    <p>For sales and new bookings, press 1.</p>
    <p>For support with an existing booking, press 2.</p>
    <p>For billing inquiries, press 3.</p>
    <p>To return to the main menu, press star.</p>
</speak>`;

const TURKISH_CONNECTING_PROMPT = `<speak>
    <p>Türkçe'yi seçtiniz. Sizi şimdi bir temsilciye bağlıyorum.</p>
</speak>`;

const getConnectingPrompt = (department?: string) => `<speak>
    <p>Thank you. Connecting you to ${department ? `the ${department} department` : 'the next available agent'}.</p>
</speak>`;


type CallState = 
    'idle' | 
    'dialing' | 
    'ringing' | 
    'playingLanguageMenu' | 
    'awaitingLanguageInput' |
    'playingDepartmentMenu' |
    'awaitingDepartmentInput' |
    'playingConnectingMessage' |
    'connectingAgent' | 
    'agentActive' | 
    'onHold' | 
    'connectingHuman' | 
    'error';

type FeedbackStatus = 'idle' | 'saving' | 'saved' | 'error';

const IVR_DIALPAD_KEYS = [
    { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' },
];

const Dialpad: React.FC<{ onKeyPress: (key: string) => void, keys: { key: string, sub: string }[] }> = ({ onKeyPress, keys }) => {
    return (
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
            {keys.map(({ key, sub }) => (
                <button
                    key={key}
                    onClick={() => onKeyPress(key)}
                    className="bg-white/20 hover:bg-white/30 text-white rounded-full aspect-square text-3xl font-light flex flex-col items-center justify-center transition-colors active:bg-white/40"
                >
                    {key}
                    {sub && <span className="text-xs font-semibold tracking-widest">{sub}</span>}
                </button>
            ))}
        </div>
    );
};

const WebDemoView: React.FC<WebDemoViewProps> = ({ template, onEndDemo }) => {
    const [agent, setAgent] = useState<Agent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [callState, setCallState] = useState<CallState>('idle');
    const [duration, setDuration] = useState(0);
    const [isAwaitingHoldConfirmation, setIsAwaitingHoldConfirmation] = useState(false);
    
    // Feedback State
    const [isFeedbackMode, setIsFeedbackMode] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
    const [sessionId] = useState(() => `session-${Date.now()}`);

    const { 
        transcripts, 
        actionLog,
        startSession, 
        endSession, 
        isSessionActive, 
        pauseMicrophoneStream, 
        resumeMicrophoneStream,
        inputAnalyserNode,
        outputAnalyserNode 
    } = useGeminiLiveAgent();
    const [localTranscripts, setLocalTranscripts] = useState<LiveTranscript[]>([]);
    
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const holdAudioRef = useRef<HTMLAudioElement | null>(null);

    const durationIntervalRef = useRef<number | null>(null);
    const callTimersRef = useRef<number[]>([]);
    const isMobile = useIsMobile();


    useEffect(() => {
        holdAudioRef.current = new Audio(AUDIO_ASSETS.hold);
        holdAudioRef.current.volume = 0.25;

        const loadDependencies = async () => {
            setIsLoading(true);
            try {
                const knowledgeBaseContent = dataService.getKnowledgeBase();
                const fetchedVoices = await dataService.getVoices();

                const recommendedVoice = fetchedVoices.find(v => v.name === template.recommendedVoice);
                const voiceId = recommendedVoice ? recommendedVoice.id : (fetchedVoices.length > 0 ? fetchedVoices[0].id : '');
                
                if (voiceId) {
                    const agentForSession: Agent = {
                        id: template.id, name: template.name, description: template.description,
                        systemPrompt: `${template.systemPrompt}\n${knowledgeBaseContent}`,
                        firstSentence: template.firstSentence,
                        voice: voiceId, thinkingMode: false, avatarUrl: null, tools: [],
                    };
                    setAgent(agentForSession);
                } else {
                    throw new Error("Recommended voice not found.");
                }
            } catch (err) {
                console.error("Failed to load demo dependencies:", err);
                setCallState('error');
            } finally {
                setIsLoading(false);
            }
        };
        loadDependencies();

        return () => {
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
            callTimersRef.current.forEach(window.clearTimeout);
            endSession();
            holdAudioRef.current?.pause();
            audioRef.current.pause();
        };
    }, [template, endSession]);

    const startTimer = useCallback(() => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        setDuration(0);
        durationIntervalRef.current = window.setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    }, []);

    const playTtsPrompt = useCallback(async (prompt: string, onEnded: () => void) => {
        if (!agent) {
            setCallState('error');
            return;
        }
        try {
            const audioBlob = await dataService.generateTts(prompt, agent.voice);
            const url = URL.createObjectURL(audioBlob);
            audioRef.current.src = url;
            audioRef.current.onended = onEnded;
            audioRef.current.play();
        } catch (e) {
            console.error("Failed to generate/play IVR audio", e);
            setCallState('error');
        }
    }, [agent]);

    const startAylaSequence = useCallback(async () => {
        if (!agent) return;

        if (holdAudioRef.current) {
            holdAudioRef.current.pause();
            holdAudioRef.current.currentTime = 0;
        }

        setCallState('connectingAgent');

        try {
            const audioBlob = await dataService.generateTts(agent.firstSentence, agent.voice);
            const url = URL.createObjectURL(audioBlob);
            
            audioRef.current.src = url;
            audioRef.current.play();

            audioRef.current.onplay = () => {
                setCallState('agentActive');
                startTimer();
                setLocalTranscripts(prev => [...prev, {id: Date.now(), role: 'model', text: agent.firstSentence.replace(/<[^>]+>/g, ''), isFinal: true}]);
            };
            
            audioRef.current.onended = async () => {
                try {
                    await startSession(agent);
                } catch (error) {
                    console.error("Failed to start live agent session:", error);
                    setCallState('error');
                }
            };

        } catch (error) {
            console.error("Failed to start Ayla sequence:", error);
            setCallState('error');
        }
    }, [agent, startSession, startTimer]);
    
    const combinedTranscripts = useMemo(() => {
        return [...localTranscripts, ...transcripts];
    }, [localTranscripts, transcripts]);

    const handleHold = useCallback(() => {
        pauseMicrophoneStream();
        const originalCallState = callState;
        setCallState('onHold');
        holdAudioRef.current?.play();
        const holdDuration = Math.random() * (15000 - 8000) + 8000; 

        const holdTimer = window.setTimeout(() => {
            holdAudioRef.current?.pause();
            if (holdAudioRef.current) holdAudioRef.current.currentTime = 0;
            setCallState(originalCallState);
            resumeMicrophoneStream();
        }, holdDuration);
        callTimersRef.current.push(holdTimer);
    }, [pauseMicrophoneStream, resumeMicrophoneStream, callState]);

    useEffect(() => {
        const lastTranscript = combinedTranscripts[combinedTranscripts.length - 1];
        if (!lastTranscript || !lastTranscript.isFinal) return;

        if (lastTranscript.role === 'model') {
            const text = lastTranscript.text.toLowerCase();
            if (text.includes("hold on") || text.includes("one moment") || text.includes("on hold")) {
                setIsAwaitingHoldConfirmation(true);
            }
        } else if (isAwaitingHoldConfirmation && lastTranscript.role === 'user') {
            const text = lastTranscript.text.toLowerCase();
            const affirmativeResponses = ["ok", "okay", "yes", "sure", "alright", "fine", "go ahead"];
            if (affirmativeResponses.some(w => text.includes(w))) {
                handleHold();
            }
            setIsAwaitingHoldConfirmation(false);
        }
    }, [combinedTranscripts, isAwaitingHoldConfirmation, handleHold]);

    const handleConnectHuman = useCallback(() => {
        setCallState('connectingHuman');
        const connectTimer = window.setTimeout(() => {
            audioRef.current.src = AUDIO_ASSETS.busy;
            audioRef.current.play();
            const busyTimer = window.setTimeout(onEndDemo, 2000); 
            callTimersRef.current.push(busyTimer);
        }, 2000);
        callTimersRef.current.push(connectTimer);
    }, [onEndDemo]);


    const handleDialpadPress = useCallback((key: string) => {
        if (holdAudioRef.current) {
            holdAudioRef.current.pause();
            holdAudioRef.current.currentTime = 0;
        }

        if (callState === 'awaitingLanguageInput') {
           switch(key) {
               case '1': // English -> Department Menu
                   setCallState('playingDepartmentMenu');
                   playTtsPrompt(DEPARTMENT_MENU_PROMPT, () => {
                       setCallState('awaitingDepartmentInput');
                       if (holdAudioRef.current) {
                            holdAudioRef.current.loop = true;
                            holdAudioRef.current.play().catch(e => console.error("Hold audio failed to play", e));
                        }
                   });
                   break;
               case '2': // Turkish -> Connect to agent
                   setCallState('playingConnectingMessage');
                   playTtsPrompt(TURKISH_CONNECTING_PROMPT, () => {
                       startAylaSequence();
                   });
                   break;
               case '0': // Representative -> Connect to agent
                   setCallState('playingConnectingMessage');
                   playTtsPrompt(getConnectingPrompt(), () => {
                       startAylaSequence();
                   });
                   break; 
               default: // Invalid input, keep waiting
                   if (holdAudioRef.current) {
                       holdAudioRef.current.play().catch(e => console.error("Hold audio failed to play", e));
                   }
                   break;
           }
        } else if (callState === 'awaitingDepartmentInput') {
            let department: string | undefined;
            switch(key) {
                case '1':
                    department = 'Sales';
                    break;
                case '2':
                    department = 'Support';
                    break;
                case '3':
                    department = 'Billing';
                    break;
                case '*': // Back to main menu
                    setCallState('playingLanguageMenu');
                    playTtsPrompt(LANGUAGE_MENU_PROMPT, () => {
                        setCallState('awaitingLanguageInput');
                        if (holdAudioRef.current) {
                            holdAudioRef.current.loop = true;
                            holdAudioRef.current.play().catch(e => console.error("Hold audio failed to play", e));
                        }
                    });
                    return;
                default:
                    if (holdAudioRef.current) {
                       holdAudioRef.current.play().catch(e => console.error("Hold audio failed to play", e));
                    }
                    return;
            }

            if (department) {
                setCallState('playingConnectingMessage');
                playTtsPrompt(getConnectingPrompt(department), () => {
                    startAylaSequence();
                });
            }
        }
    }, [callState, startAylaSequence, playTtsPrompt]);

    const handleStartCall = () => {
        if (callState !== 'idle' || !agent) return;
        
        setCallState('dialing');
        
        const dialingTimer = window.setTimeout(() => {
            setCallState('ringing');
            audioRef.current.src = AUDIO_ASSETS.ring;
            audioRef.current.loop = true;
            audioRef.current.play();

            const ringTimer = window.setTimeout(async () => {
                audioRef.current.loop = false;
                audioRef.current.pause();
                
                setCallState('playingLanguageMenu');
                await playTtsPrompt(LANGUAGE_MENU_PROMPT, () => {
                    setCallState('awaitingLanguageInput');
                    if (holdAudioRef.current) {
                        holdAudioRef.current.loop = true;
                        holdAudioRef.current.play().catch(e => console.error("Hold audio failed to play", e));
                    }
                });
            }, 8000);
            callTimersRef.current.push(ringTimer);
        }, 1500);
        callTimersRef.current.push(dialingTimer);
    };

    const handleEndCall = () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        callTimersRef.current.forEach(window.clearTimeout);
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        holdAudioRef.current?.pause();
        endSession();
        onEndDemo();
    };
    
    const handleSaveFeedback = async () => {
        if (!agent || !feedbackText.trim()) return;
        setFeedbackStatus('saving');
        try {
            await dataService.submitAgentFeedback(agent.id, sessionId, combinedTranscripts, feedbackText);
            setFeedbackStatus('saved');
            setTimeout(() => {
                setIsFeedbackMode(false);
                setFeedbackText('');
                setFeedbackStatus('idle');
            }, 2000);
        } catch (err) {
            console.error("Failed to save feedback", err);
            setFeedbackStatus('error');
        }
    };


    if (isLoading) {
        return <LoadingIndicator text="Preparing Demo Environment..." size="large" />;
    }

    const renderCallStatusText = () => {
        switch (callState) {
            case 'idle': return 'Ready to Call';
            case 'dialing': return 'Dialing...';
            case 'ringing': return 'Ringing...';
            case 'playingLanguageMenu':
            case 'playingDepartmentMenu':
            case 'playingConnectingMessage':
                return 'Connecting...';
            case 'awaitingLanguageInput': 
            case 'awaitingDepartmentInput':
                return 'Select an option';
            case 'connectingAgent': return 'Connecting AI Agent...';
            case 'connectingHuman': return 'Transferring...';
            case 'onHold': return 'On Hold';
            case 'agentActive': return formatDuration(duration);
            case 'error': return 'Connection Failed';
        }
    };

     const renderPhoneScreen = () => {
        return (
             <div className="w-full h-full flex flex-col bg-gray-900 text-white p-4">
                {callState !== 'idle' && (
                    <div className="text-center pt-12">
                        <h2 className="text-3xl font-bold">{agent?.name}</h2>
                        <p className={`mt-1 font-mono text-lg ${callState === 'agentActive' ? 'text-eburon-ok' : callState === 'onHold' ? 'text-eburon-warn' : 'text-eburon-fg/80'}`}>
                            {renderCallStatusText()}
                        </p>
                    </div>
                )}

                <div className="flex-grow flex flex-col items-center justify-center gap-8">
                    {callState === 'idle' && (
                        <div className="text-center">
                             <div className="w-24 h-24 rounded-full bg-eburon-bg border border-eburon-border flex items-center justify-center mx-auto mb-4">
                                <AgentIcon className="w-12 h-12 text-eburon-accent" />
                            </div>
                            <h2 className="text-3xl font-bold">{agent?.name}</h2>
                            <p className="text-eburon-fg/70 mt-1">Ready to start the demo call.</p>
                        </div>
                    )}
                    {(callState === 'dialing' || callState === 'ringing' || callState === 'playingLanguageMenu' || callState === 'playingDepartmentMenu' || callState === 'playingConnectingMessage' || callState === 'connectingAgent' || callState === 'connectingHuman') && (
                         <div className="w-24 h-24 rounded-full bg-eburon-bg border border-eburon-border flex items-center justify-center">
                            <AgentIcon className="w-12 h-12 text-eburon-accent animate-pulse" />
                        </div>
                    )}
                    {(callState === 'awaitingLanguageInput' || callState === 'awaitingDepartmentInput') && (
                         <Dialpad onKeyPress={handleDialpadPress} keys={IVR_DIALPAD_KEYS} />
                    )}
                    {callState === 'agentActive' && (
                        <GlobeIcon className={`w-48 h-48 text-white/50 z-10 transition-transform duration-500 ${isSessionActive ? 'animate-pulse' : ''}`} />
                    )}
                </div>

                <div className="mt-auto flex items-center justify-center">
                     {callState === 'idle' ? (
                        <button 
                            onClick={handleStartCall} 
                            className="w-full bg-eburon-ok text-black py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 mb-5"
                        >
                            <PhoneIcon className="w-5 h-5" />
                            <span>Call now</span>
                        </button>
                     ) : (
                         <button onClick={handleEndCall} className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center group transition-transform hover:scale-105">
                            <PhoneIcon className="w-10 h-10 text-white transform rotate-[135deg]" />
                        </button>
                     )}
                </div>
            </div>
        );
    };

    if (isMobile) {
        return renderPhoneScreen();
    }

    return (
        <div className="h-screen w-screen flex bg-eburon-bg text-eburon-fg p-8 gap-8 relative">
            <div className="absolute top-6 right-14 z-50">
                <ActionLogToast key={actionLog} log={actionLog} />
            </div>
            <aside className="w-[390px] flex-shrink-0">
                <IphoneSimulator>
                    {renderPhoneScreen()}
                </IphoneSimulator>
            </aside>
            <main className="flex-1 bg-eburon-panel border border-eburon-border rounded-xl flex flex-col">
                <header className="p-4 border-b border-eburon-border flex justify-between items-center">
                    <h1 className="text-xl font-bold">Live Transcription</h1>
                    <label htmlFor="feedback-mode-toggle" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${isFeedbackMode ? 'bg-eburon-accent text-white' : 'bg-eburon-bg hover:bg-white/10'}`} title="Toggle Feedback Mode">
                        <ClipboardEditIcon className="w-5 h-5"/>
                        <span>Record Feedback</span>
                        <div className="relative">
                            <input type="checkbox" id="feedback-mode-toggle" className="sr-only" checked={isFeedbackMode} onChange={() => setIsFeedbackMode(!isFeedbackMode)} />
                            <div className={`w-9 h-5 rounded-full transition-colors ${isFeedbackMode ? 'bg-white/30' : 'bg-gray-500'}`}></div>
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isFeedbackMode ? 'translate-x-4' : ''}`}></div>
                        </div>
                    </label>
                </header>

                {callState === 'agentActive' && (
                    <div className="grid grid-cols-2 gap-4 p-4 border-b border-eburon-border">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-sm text-eburon-fg/80">
                                <UserIcon className="w-5 h-5"/>
                                <span>Your Microphone</span>
                            </div>
                            <AudioVisualizer analyserNode={inputAnalyserNode} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-sm text-eburon-fg/80">
                                <AgentIcon className="w-5 h-5"/>
                                <span>Agent's Voice</span>
                            </div>
                            <AudioVisualizer analyserNode={outputAnalyserNode} />
                        </div>
                    </div>
                )}
                
                <div className="flex-grow p-6 space-y-4 overflow-y-auto">
                    {combinedTranscripts.map((t) => (
                         <div key={t.id} className={`flex gap-3 items-start ${t.role === 'user' ? 'justify-end' : ''}`}>
                             {t.role === 'model' && (
                                 <div className="w-8 h-8 rounded-full flex-shrink-0 grid place-items-center bg-eburon-accent">
                                     <AgentIcon className="w-5 h-5 text-white" />
                                 </div>
                             )}
                             <div className={`max-w-xl p-3 rounded-xl transition-opacity ${t.isFinal ? 'opacity-100' : 'opacity-70'} ${t.role === 'model' ? 'bg-eburon-bg rounded-bl-none' : 'bg-eburon-accent text-white rounded-br-none'}`}>
                                <p className="text-sm">{t.text}</p>
                             </div>
                             {t.role === 'user' && (
                                 <div className="w-8 h-8 rounded-full flex-shrink-0 grid place-items-center bg-gray-500">
                                    <UserIcon className="w-5 h-5 text-white" />
                                 </div>
                             )}
                        </div>
                    ))}
                     {isSessionActive && callState !== 'onHold' && (
                        <div className="flex justify-center items-center gap-2 pt-4 text-eburon-accent">
                            <MicIcon className="w-5 h-5 animate-pulse" />
                            <span className="text-sm font-semibold">Listening...</span>
                        </div>
                    )}
                </div>
                 {isFeedbackMode && (
                    <div className="p-4 border-t border-eburon-border bg-eburon-bg/30">
                        <h3 className="text-lg font-semibold mb-2">Improvements & Comments</h3>
                        <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Add notes here on what the agent should improve, do, or not do..."
                            className="w-full h-24 bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                            disabled={feedbackStatus === 'saving'}
                        />
                        <div className="flex justify-end items-center mt-2">
                             {feedbackStatus === 'error' && <p className="text-red-400 text-sm mr-4">Failed to save.</p>}
                             <button
                                onClick={handleSaveFeedback}
                                disabled={!feedbackText.trim() || feedbackStatus === 'saving' || feedbackStatus === 'saved'}
                                className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-accent hover:bg-eburon-accent-dark text-white disabled:bg-gray-500"
                            >
                                {feedbackStatus === 'saving' && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                                {feedbackStatus === 'saved' ? <CheckCircleIcon className="w-5 h-5" /> : <SaveIcon className="w-5 h-5" />}
                                <span>{feedbackStatus === 'saving' ? 'Saving...' : feedbackStatus === 'saved' ? 'Saved!' : 'Save Feedback'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WebDemoView;