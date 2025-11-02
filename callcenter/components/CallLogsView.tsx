import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CallLog, CallAnalysisResult } from '../types';
// FIX: Import 'fetchCallLogs' to resolve undefined function error.
import { fetchRecording, fetchCallLogs } from '../services/blandAiService';
import { analyzeCallTranscript, transcribeAudioWithDiarization } from '../services/ollamaService';
import { SearchIcon, PhoneIcon, UserIcon, AgentIcon, RefreshIcon, PlayIcon, PauseIcon, HistoryIcon, CalendarIcon, CopyIcon, ChevronLeftIcon, BrainCircuitIcon, SmileIcon, MehIcon, FrownIcon, SparklesIcon } from './icons';
import { LoadingIndicator } from './LoadingIndicator';
// FIX: Import dataService to access cached call logs on network failure.
import * as dataService from '../services/dataService';

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const SentimentChart: React.FC<{ 
    timeline: CallAnalysisResult['sentimentTimeline'], 
    duration: number 
}> = ({ timeline, duration }) => {
    if (!timeline || timeline.length === 0 || duration === 0) {
        return <div className="h-24 bg-eburon-bg rounded-md flex items-center justify-center text-sm text-eburon-fg/50">Not enough data for chart.</div>;
    }

    const sentimentToValue = (sentiment: 'Positive' | 'Neutral' | 'Negative') => {
        if (sentiment === 'Positive') return 1;
        if (sentiment === 'Negative') return -1;
        return 0;
    };

    const points = timeline
        .filter(d => typeof d.start_time === 'number')
        .map(d => ({
            x: (d.start_time! / duration) * 100,
            y: sentimentToValue(d.sentiment),
        }));

    if (points.length < 2) {
        return <div className="h-24 bg-eburon-bg rounded-md flex items-center justify-center text-sm text-eburon-fg/50">Not enough data points for a timeline chart.</div>;
    }
    
    // Add a starting point at time 0 with the first sentiment
    if (points[0].x > 0) {
        points.unshift({ x: 0, y: points[0].y });
    }
    // Add an ending point at the end of the call with the last sentiment
    if (points[points.length-1].x < 100) {
        points.push({ x: 100, y: points[points.length-1].y });
    }

    const width = 500;
    const height = 100;
    
    const yToSvg = (y: number) => (height / 2) - y * (height / 2.5); // Map -1, 0, 1 to svg coords

    const pathData = points.map((p, i) => {
        if (i === 0) return `M ${p.x * width / 100} ${yToSvg(p.y)}`;
        // Create a stepped path
        const prevP = points[i-1];
        const x1 = prevP.x * width / 100;
        const y1 = yToSvg(prevP.y);
        const x2 = p.x * width / 100;
        const y2 = yToSvg(p.y);
        return `L ${x2} ${y1} L ${x2} ${y2}`;
    }).join(' ');

    return (
        <div className="bg-eburon-bg p-4 rounded-md">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                {/* Center Line (Neutral) */}
                <line x1="0" y1={yToSvg(0)} x2={width} y2={yToSvg(0)} strokeDasharray="4 4" stroke="rgba(232, 238, 247, 0.3)" strokeWidth="1"/>
                
                {/* Sentiment Path */}
                <path d={pathData} stroke="#5bb6ff" strokeWidth="2" fill="none" />
                
                {/* Labels */}
                <text x="5" y="15" fill="rgba(52, 222, 156, 0.8)" fontSize="10" textAnchor="start">Positive</text>
                <text x="5" y={height - 5} fill="rgba(255, 100, 100, 0.7)" fontSize="10" textAnchor="start">Negative</text>

                 {/* Axis Labels */}
                <text x="0" y={height} fill="rgba(232, 238, 247, 0.5)" fontSize="8" textAnchor="start">0:00</text>
                <text x={width} y={height} fill="rgba(232, 238, 247, 0.5)" fontSize="8" textAnchor="end">{formatDuration(duration)}</text>
            </svg>
        </div>
    );
};

const SentimentIndicator: React.FC<{ sentiment: CallAnalysisResult['overallSentiment'], small?: boolean }> = ({ sentiment, small = false }) => {
    const sentimentConfig = {
        Positive: { icon: SmileIcon, color: 'text-eburon-ok', text: 'Positive' },
        Neutral: { icon: MehIcon, color: 'text-eburon-warn', text: 'Neutral' },
        Negative: { icon: FrownIcon, color: 'text-red-400', text: 'Negative' },
        Mixed: { icon: SparklesIcon, color: 'text-blue-400', text: 'Mixed' },
    };
    const config = sentimentConfig[sentiment];
    if (!config) return null;
    const Icon = config.icon;
    const iconSize = small ? 'w-4 h-4' : 'w-6 h-6';
    const textSize = small ? 'text-xs' : '';
    
    return (
        <div className={`flex items-center gap-1.5 font-semibold ${config.color}`}>
            <Icon className={iconSize} />
            <span className={textSize}>{config.text}</span>
        </div>
    );
};

const CallDetailView: React.FC<{ 
    call: CallLog, 
    onBack: () => void,
    onAnalysisUpdate: (callId: string, analysisResult: CallAnalysisResult) => void 
}> = ({ call, onBack, onAnalysisUpdate }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const objectUrlRef = useRef<string | null>(null);
    
    const [copyStatus, setCopyStatus] = useState('Copy');

    // State for Call Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<CallAnalysisResult | null>(call.analysisResult || null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);


    const loadRecording = useCallback(async () => {
        setIsLoadingAudio(true);
        setError(null);
        setAudioUrl(null);
        setAudioBlob(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);

        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        
        if (call.duration < 1) {
            setError("No recording is available for this call (it was too short).");
            setIsLoadingAudio(false);
            return;
        }

        if (!call.recording_url) {
            setError("This call has no recording available (missing recording URL).");
            setIsLoadingAudio(false);
            return;
        }

        try {
            const blob = await fetchRecording(call.recording_url);
            setAudioBlob(blob);
            const newObjectUrl = URL.createObjectURL(blob);
            objectUrlRef.current = newObjectUrl;
            setAudioUrl(newObjectUrl);
        } catch (err: any) {
            console.error("Failed to load recording:", err);
            setError(err.message || "Could not load audio recording.");
        } finally {
            setIsLoadingAudio(false);
        }
    }, [call]);

    useEffect(() => {
        loadRecording();
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [loadRecording]);
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        const setAudioData = () => {
            if (isFinite(audio.duration)) setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            const transcriptSource = analysisResult?.sentimentTimeline || call.transcript;
            if (!transcriptSource) return;

            let newActiveIndex = -1;
            for (let i = transcriptSource.length - 1; i >= 0; i--) {
                const segment = transcriptSource[i];
                if (typeof segment.start_time === 'number' && audio.currentTime >= segment.start_time) {
                    newActiveIndex = i;
                    break;
                }
            }
            if (newActiveIndex !== activeSegmentIndex) {
                setActiveSegmentIndex(newActiveIndex);
            }
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('canplay', setAudioData);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('canplay', setAudioData);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [audioUrl, call.transcript, analysisResult, activeSegmentIndex]);

    useEffect(() => {
        const activeElement = transcriptContainerRef.current?.children[activeSegmentIndex] as HTMLElement;
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }, [activeSegmentIndex]);

    const togglePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => setError("Playback failed."));
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !isFinite(duration) || duration === 0) return;

        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const seekTime = (clickX / width) * duration;
        audio.currentTime = seekTime;
    };

    const handleCopyTranscript = () => {
        if (call.concatenated_transcript) {
            navigator.clipboard.writeText(call.concatenated_transcript);
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus('Copy'), 2000);
        }
    };
    
    const handleAnalyzeFromAudio = useCallback(async () => {
        if (!audioBlob) {
            setAnalysisError("Audio has not been loaded yet. Please wait.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisError(null);

        try {
            const audioFile = new File([audioBlob], "recording.wav", { type: audioBlob.type || 'audio/wav' });
            
            // Step 1: Transcribe with speaker separation
            const newTranscript = await transcribeAudioWithDiarization(audioFile);
            
            if (!newTranscript || newTranscript.length === 0) {
                 throw new Error("Transcription failed or returned empty.");
            }

            // Step 2: Analyze the newly generated transcript
            const result = await analyzeCallTranscript(newTranscript);
            
            // Step 3: Save the analysis to DB and update parent state
            await dataService.saveCallAnalysis(call.call_id, result);
            onAnalysisUpdate(call.call_id, result);
            setAnalysisResult(result);

        } catch (err: any) {
            setAnalysisError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    }, [audioBlob, call.call_id, onAnalysisUpdate]);


    const progressPercentage = (currentTime / duration) * 100 || 0;
    
    const transcriptToDisplay = analysisResult ? analysisResult.sentimentTimeline : call.transcript;
    
    const getSentimentColor = (sentiment: 'Positive' | 'Neutral' | 'Negative') => {
        switch (sentiment) {
            case 'Positive': return 'bg-eburon-ok';
            case 'Neutral': return 'bg-eburon-warn';
            case 'Negative': return 'bg-red-500';
            default: return 'bg-eburon-border';
        }
    };

    return (
        <div className="p-8 flex flex-col bg-eburon-bg">
            {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}
             <div className="flex items-start justify-between mb-6">
                 <button onClick={onBack} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-eburon-panel transition-colors -ml-3">
                    <ChevronLeftIcon className="w-5 h-5" />
                    <span className="font-semibold">Back to Logs</span>
                 </button>
            </div>
           
           <div className="max-w-4xl mx-auto w-full flex-grow flex flex-col">
                <div className="flex items-start justify-between mb-6">
                     <div>
                        <h2 className="text-3xl font-bold text-eburon-fg">{call.to}</h2>
                        <p className="text-sm text-eburon-fg/60">Call from {call.from}</p>
                     </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="bg-eburon-panel p-3 rounded-lg flex items-center gap-3">
                        <CalendarIcon className="w-5 h-5 text-eburon-accent"/>
                        <div>
                            <p className="font-semibold text-eburon-fg/90">{formatDate(call.created_at).split(',')[0]}</p>
                            <p className="text-eburon-fg/60">{formatDate(call.created_at).split(',')[1]}</p>
                        </div>
                    </div>
                    <div className="bg-eburon-panel p-3 rounded-lg flex items-center gap-3">
                        <HistoryIcon className="w-5 h-5 text-eburon-accent"/>
                        <div>
                            <p className="font-semibold text-eburon-fg/90">{formatDuration(call.duration)}</p>
                            <p className="text-eburon-fg/60">Duration</p>
                        </div>
                    </div>
                </div>

                <div className="bg-eburon-panel p-4 rounded-xl mb-6">
                     {isLoadingAudio && <div className="h-14 flex items-center justify-center text-sm text-eburon-fg/60"><LoadingIndicator text="Loading Audio..." size="small" /></div>}
                     {error && (
                        <div className="h-14 bg-red-900/50 border border-red-500 text-red-300 rounded-lg flex items-center justify-between text-sm px-4">
                            <span>{error}</span>
                            <button onClick={loadRecording} className="p-2 rounded-lg hover:bg-white/10" title="Retry loading audio">
                                <RefreshIcon className="w-5 h-5" />
                            </button>
                        </div>
                     )}
                     {!isLoadingAudio && !error && audioUrl && (
                        <div className="flex items-center gap-4">
                            <button onClick={togglePlayPause} className="p-3 bg-eburon-accent text-white rounded-full hover:bg-eburon-accent-dark transition-colors">
                                {isPlaying ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                            </button>
                            <div className="flex-grow flex items-center gap-3">
                                 <span className="text-xs font-mono text-eburon-fg/70">{formatDuration(currentTime)}</span>
                                 <div onClick={handleSeek} className="w-full h-2 bg-eburon-bg rounded-full cursor-pointer group">
                                    <div style={{width: `${progressPercentage}%`}} className="h-full bg-eburon-accent rounded-full relative">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </div>
                                 </div>
                                 <span className="text-xs font-mono text-eburon-fg/70">{formatDuration(duration)}</span>
                            </div>
                        </div>
                     )}
                </div>

                 <div className="bg-eburon-panel p-6 rounded-xl mb-6">
                    <h3 className="text-lg font-semibold text-eburon-fg mb-4">AI Call Analysis</h3>
                    {isAnalyzing ? (
                        <LoadingIndicator text="Analyzing call audio..." size="small" />
                    ) : analysisError ? (
                         <div className="text-red-400 text-sm bg-red-900/50 p-3 rounded-lg">
                            <p className="font-semibold">Analysis Failed</p>
                            <p className="mb-2">{analysisError}</p>
                            <button onClick={handleAnalyzeFromAudio} className="text-sm font-semibold underline hover:text-red-300">Retry Analysis</button>
                        </div>
                    ) : analysisResult ? (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-semibold text-eburon-fg/80 mb-1">Overall Sentiment</p>
                                    <SentimentIndicator sentiment={analysisResult.overallSentiment} />
                                </div>
                                <div>
                                    <p className="font-semibold text-eburon-fg/80 mb-1">Key Topics</p>
                                    <div className="flex flex-wrap gap-2">
                                        {analysisResult.topics.map((topic, i) => (
                                            <span key={i} className="bg-eburon-bg border border-eburon-border text-eburon-accent px-2.5 py-1 rounded-full text-xs font-semibold">{topic}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="font-semibold text-eburon-fg/80 mb-1">Summary</p>
                                <p className="text-eburon-fg/90 bg-eburon-bg p-3 rounded-md">{analysisResult.summary}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-eburon-fg/80 mb-1">Sentiment Timeline</p>
                                <SentimentChart timeline={analysisResult.sentimentTimeline} duration={call.duration} />
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={handleAnalyzeFromAudio}
                            disabled={isLoadingAudio || !audioBlob}
                            className="w-full bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            <BrainCircuitIcon className="w-5 h-5" />
                            <span>Analyze from Audio</span>
                        </button>
                    )}
                </div>


                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold text-eburon-fg">Transcript</h3>
                    <button onClick={handleCopyTranscript} className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-md bg-eburon-panel hover:bg-eburon-border transition-colors text-eburon-fg/80">
                       <CopyIcon className="w-4 h-4" />
                       {copyStatus}
                    </button>
                </div>
                <div ref={transcriptContainerRef} className="flex-grow bg-eburon-panel p-4 rounded-lg space-y-3">
                    {transcriptToDisplay && transcriptToDisplay.length > 0 ? transcriptToDisplay.map((segment, index) => {
                        const sentiment = (analysisResult && 'sentiment' in segment) ? segment.sentiment : null;
                        return (
                            <div key={index} className={`flex gap-3 items-start p-3 rounded-lg transition-all duration-300 ${activeSegmentIndex === index ? 'bg-eburon-accent/10' : ''} ${segment.user === 'user' ? 'justify-end' : ''}`}>
                                 {segment.user === 'agent' && (
                                     <div className="flex-shrink-0 flex items-center gap-2">
                                         <div className="w-8 h-8 rounded-full grid place-items-center bg-eburon-accent">
                                             <AgentIcon className="w-5 h-5 text-white" />
                                         </div>
                                         {sentiment && <div className={`w-1 h-full rounded-full ${getSentimentColor(sentiment)}`}></div>}
                                     </div>
                                 )}
                                 <div className={`max-w-md p-3 rounded-xl ${segment.user === 'agent' ? 'bg-eburon-bg rounded-bl-none' : 'bg-eburon-accent text-white rounded-br-none'}`}>
                                    <p className="text-sm">{segment.text}</p>
                                 </div>
                                 {segment.user === 'user' && (
                                     <div className="flex-shrink-0 flex items-center gap-2">
                                        {sentiment && <div className={`w-1 h-full rounded-full ${getSentimentColor(sentiment)}`}></div>}
                                        <div className="w-8 h-8 rounded-full grid place-items-center bg-gray-500">
                                            <UserIcon className="w-5 h-5 text-white" />
                                        </div>
                                     </div>
                                 )}
                            </div>
                        )
                    }) : <p className="text-center text-sm text-eburon-fg/60 pt-4">No interactive transcript available for this call.</p>}
                </div>
            </div>
        </div>
    );
};

const CallLogsView: React.FC = () => {
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const freshLogs = await dataService.getCallLogs();
            setCallLogs(freshLogs);
        } catch (err: any) {
            console.error("Failed to load call logs:", err);
            setError(`Could not retrieve call logs: ${err.message}. Trying cache...`);
            try {
                const cachedLogs = await dataService.getCallLogs();
                setCallLogs(cachedLogs);
                if (cachedLogs.length > 0) {
                    setError(null);
                } else {
                    setError(`Could not retrieve call logs and cache is empty.`);
                }
            } catch (cacheErr: any) {
                 setError(`Failed to retrieve call logs and failed to load from cache: ${cacheErr.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);
    
    const handleAnalysisUpdate = (callId: string, newAnalysisResult: CallAnalysisResult) => {
        setCallLogs(prevLogs => 
            prevLogs.map(log => 
                log.call_id === callId 
                    ? { ...log, analysisResult: newAnalysisResult }
                    : log
            )
        );
    };

    const filteredLogs = useMemo(() => {
        if (!searchTerm) return callLogs;
        const lowercasedFilter = searchTerm.toLowerCase();
        return callLogs.filter(log => 
            log.from.includes(lowercasedFilter) || 
            log.to.includes(lowercasedFilter) ||
            log.concatenated_transcript.toLowerCase().includes(lowercasedFilter)
        );
    }, [callLogs, searchTerm]);

    if (isLoading) {
        return <LoadingIndicator text="Loading Call Logs..." />;
    }

    if (error) {
        return <div className="p-8 text-center text-red-400">{error}</div>;
    }
    
    if (selectedCall) {
        return <CallDetailView call={selectedCall} onBack={() => setSelectedCall(null)} onAnalysisUpdate={handleAnalysisUpdate} />;
    }

    return (
        <div className="flex flex-col bg-eburon-bg">
            <div className="p-4 border-b border-eburon-border">
                <h1 className="text-2xl font-bold mb-4">Call History</h1>
                 <div className="relative">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-eburon-fg/50" />
                    <input type="text" placeholder="Search by number or transcript..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
                </div>
            </div>
            <div className="flex-grow">
                {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-eburon-fg/60">
                        <p>No call logs found{searchTerm ? ` for "${searchTerm}"` : ''}.</p>
                    </div>
                ) : filteredLogs.map(log => {
                    return (
                        <button 
                            key={log.call_id} 
                            onClick={() => setSelectedCall(log)}
                            className={`w-full text-left p-4 border-b border-eburon-border hover:bg-eburon-panel transition-colors flex flex-col gap-3`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-eburon-panel grid place-items-center flex-shrink-0">
                                    <PhoneIcon className="w-5 h-5 text-eburon-accent" />
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-eburon-fg truncate">{log.to}</p>
                                        <p className="text-xs text-eburon-fg/60 font-mono flex-shrink-0 ml-2">{formatDuration(log.duration)}</p>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-eburon-fg/70 truncate">From: {log.from}</p>
                                        <div className="flex items-center gap-2 text-xs text-eburon-fg/50">
                                            {/* FIX: Wrap BrainCircuitIcon with a span to apply the title attribute, resolving a TypeScript error. */}
                                            {log.analysisResult && <span title="Analyzed"><BrainCircuitIcon className="w-4 h-4 text-eburon-accent" /></span>}
                                            <span>{new Date(log.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
            <div className="p-2 border-t border-eburon-border">
                <button onClick={loadLogs} className="w-full flex items-center justify-center gap-2 p-2 rounded-md hover:bg-eburon-panel text-sm text-eburon-fg/70">
                    <RefreshIcon className="w-4 h-4"/>
                    Refresh Logs
                </button>
            </div>
        </div>
    );
};

export default CallLogsView;
