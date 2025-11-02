import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as dataService from '../services/dataService';
import { MicIcon, StopIcon, RefreshIcon, CheckCircleIcon, UploadIcon } from './icons';

type RecordingStatus = 'idle' | 'permission' | 'recording' | 'recorded' | 'cloning' | 'success' | 'error';


const CloneVoiceView: React.FC = () => {
    const [voiceName, setVoiceName] = useState('');
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const cleanup = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const handleStartRecording = async () => {
        setStatus('permission');
        setErrorMessage('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setAudioBlob(blob);
                setStatus('recorded');
                cleanup();
            };

            mediaRecorderRef.current.start();
            setStatus('recording');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setErrorMessage('Microphone access denied. Please allow microphone access in your browser settings.');
            setStatus('error');
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('audio/')) {
                setErrorMessage('Invalid file type. Please upload an audio file.');
                setStatus('error');
                return;
            }
            
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }

            const url = URL.createObjectURL(file);
            setAudioUrl(url);
            setAudioBlob(file);
            setStatus('recorded');
        }
    };

    const handleReset = () => {
        setAudioUrl(null);
        setAudioBlob(null);
        setStatus('idle');
        setErrorMessage('');
        setVoiceName('');
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const handleClone = async () => {
        if (!audioBlob) {
            setErrorMessage('Audio sample is missing. Please record or upload again.');
            setStatus('error');
            return;
        }

        setStatus('cloning');
        setErrorMessage('');
        try {
            await dataService.cloneVoice(voiceName, audioBlob);
            setStatus('success');
        } catch (err: any) {
            setErrorMessage(err.message || 'An unknown error occurred during cloning.');
            setStatus('error');
        }
    };

    const canClone = voiceName.trim() !== '' && status === 'recorded';

    const renderStatusUI = () => {
        switch (status) {
            case 'idle':
            case 'error':
                return (
                    <>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="audio/wav, audio/mpeg, audio/m4a"
                            className="hidden"
                        />
                        <div className="flex items-center gap-6">
                            <button
                                onClick={handleStartRecording}
                                className="w-24 h-24 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all duration-200 text-white flex-col gap-1"
                                aria-label="Start recording"
                            >
                                <MicIcon className="w-8 h-8" />
                                <span className="text-xs font-semibold">Record</span>
                            </button>
                            <span className="text-eburon-fg/60 font-semibold">OR</span>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-24 h-24 bg-eburon-accent hover:bg-eburon-accent-dark rounded-full flex items-center justify-center transition-all duration-200 text-white flex-col gap-1"
                                aria-label="Upload audio file"
                            >
                                <UploadIcon className="w-8 h-8" />
                                <span className="text-xs font-semibold">Upload</span>
                            </button>
                        </div>
                    </>
                );
            case 'permission':
                 return (
                    <button
                        disabled
                        className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center transition-all duration-200 text-white disabled:bg-gray-500"
                        aria-label="Requesting permission"
                    >
                        <div className="w-8 h-8 border-4 border-white/50 border-t-white rounded-full animate-spin"></div>
                    </button>
                );
            case 'recording':
                return (
                    <button
                        onClick={handleStopRecording}
                        className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center transition-all animate-pulse"
                        aria-label="Stop recording"
                    >
                        <StopIcon className="w-10 h-10 text-white" />
                    </button>
                );
            case 'recorded':
                return (
                    <div className="flex items-center gap-4 w-full">
                        <audio ref={audioRef} src={audioUrl!} controls className="w-full" />
                        <button onClick={handleReset} title="Record or upload again" className="p-3 text-eburon-fg/70 hover:text-eburon-fg bg-eburon-panel rounded-lg">
                            <RefreshIcon className="w-6 h-6" />
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    const getStatusMessage = () => {
        switch (status) {
            case 'idle': return 'Tap to record, or upload an audio file.';
            case 'permission': return 'Requesting microphone access...';
            case 'recording': return 'Recording... Tap to stop.';
            case 'recorded': return 'Review your audio sample below.';
            case 'cloning': return 'Cloning in progress... This may take a moment.';
            case 'success': return 'Voice cloned successfully! You can now use it to create agents.';
            case 'error': return errorMessage;
            default: return '';
        }
    }


    if (status === 'success') {
        return (
            <div className="p-8 h-full flex flex-col items-center justify-center text-center">
                 <CheckCircleIcon className="w-24 h-24 text-eburon-ok mb-4" />
                 <h1 className="text-3xl font-bold text-eburon-fg mb-2">Cloning Complete!</h1>
                 <p className="text-eburon-fg/70 mb-6">Your voice <span className="font-semibold text-eburon-accent">{voiceName}</span> is now available in your voice library.</p>
                 <button onClick={handleReset} className="bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-6 rounded-lg transition-colors duration-150">
                    Clone Another Voice
                </button>
            </div>
        )
    }

    return (
        <div className="p-8 h-full overflow-y-auto flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <h1 className="text-3xl font-bold text-eburon-fg mb-2">Clone a Voice</h1>
                <p className="text-eburon-fg/70 mb-8">
                    Record or upload a short audio sample to create a digital clone of a voice. For best results, use a clear recording in a quiet space.
                </p>

                <div className="space-y-8">
                    {/* Step 1: Name your voice */}
                    <div className="bg-eburon-panel p-6 rounded-xl border border-eburon-border">
                        <label htmlFor="voiceName" className="block text-xl font-semibold text-eburon-fg mb-3">
                           1. Name Your Voice
                        </label>
                        <input
                            id="voiceName"
                            type="text"
                            value={voiceName}
                            onChange={(e) => setVoiceName(e.target.value)}
                            placeholder="e.g., My Custom Voice"
                            className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                            disabled={status !== 'idle' && status !== 'recorded' && status !== 'error'}
                        />
                    </div>
                    
                    {/* Step 2: Record/Upload Audio */}
                    <div className="bg-eburon-panel p-6 rounded-xl border border-eburon-border">
                        <h2 className="text-xl font-semibold text-eburon-fg mb-3">2. Provide Audio Sample</h2>
                        <div className="bg-eburon-bg p-4 rounded-lg italic text-eburon-fg/80 mb-6">
                            <p>For recordings, we suggest reading this line: "I am not a wolf in sheep's clothing, I'm a wolf in wolf's clothing."</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center space-y-4 h-32">
                             {renderStatusUI()}
                             <p className={`text-sm h-4 ${status === 'error' ? 'text-red-400' : 'text-eburon-fg/60'}`}>
                                {getStatusMessage()}
                             </p>
                        </div>
                    </div>

                    {/* Step 3: Start Cloning */}
                    <div>
                         <button 
                            onClick={handleClone}
                            disabled={!canClone}
                            className="w-full bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-4 px-6 rounded-lg transition-all duration-150 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                           {status === 'cloning' ? (
                               <>
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-3"></div>
                                <span>Processing...</span>
                               </>
                           ) : (
                                "Start Cloning Process"
                           )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloneVoiceView;