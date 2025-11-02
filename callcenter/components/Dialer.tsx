import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhoneIcon, BackspaceIcon, XIcon } from './icons';
import { startAylaCall, stopCall } from '../services/blandAiService';
import { generateTts } from '../services/dataService';

// IVR Prompts
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

const DIALPAD_KEYS = [
    { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' },
];

const DTMF_FREQS: { [key: string]: [number, number] } = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

interface DialerProps {
    onClose?: () => void;
}

const Dialer: React.FC<DialerProps> = ({ onClose }) => {
    type CallFlowState = 'idle' | 'ivrLanguage' | 'ivrDepartment' | 'calling' | 'connected' | 'ended' | 'error';
    const [callFlowState, setCallFlowState] = useState<CallFlowState>('idle');
    const [number, setNumber] = useState('');
    const [callId, setCallId] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [statusText, setStatusText] = useState('Enter number to call');
    const [ivrPrompt, setIvrPrompt] = useState('');

    const durationIntervalRef = useRef<number | null>(null);
    const longPressTimeoutRef = useRef<number | null>(null);
    const isLongPressRef = useRef(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
    const ttsUrlRef = useRef<string | null>(null);


    useEffect(() => {
        return () => {
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
            if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
            audioCtxRef.current?.close();
            if (ttsAudioRef.current) {
                ttsAudioRef.current.pause();
                ttsAudioRef.current = null;
            }
            if (ttsUrlRef.current) {
                URL.revokeObjectURL(ttsUrlRef.current);
            }
        };
    }, []);

    const playTone = useCallback((key: string) => {
        if (!audioCtxRef.current || !DTMF_FREQS[key]) return;
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const [freq1, freq2] = DTMF_FREQS[key];
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
        osc2.frequency.setValueAtTime(freq2, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        setTimeout(() => {
            osc1.stop();
            osc2.stop();
            gain.disconnect();
        }, 150);
    }, []);

    const playTtsPrompt = useCallback(async (prompt: string, onEnded?: () => void) => {
        try {
            const cleanPrompt = prompt.replace(/<speak>|<\/speak>|<p>|<\/p>|<break[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            setIvrPrompt(cleanPrompt);
            const audioBlob = await generateTts(prompt, '1a7a4ab1-2434-4a87-9152-45a8d9a2a3e0');
            if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
            const url = URL.createObjectURL(audioBlob);
            ttsUrlRef.current = url;
            if (!ttsAudioRef.current) ttsAudioRef.current = new Audio();
            ttsAudioRef.current.src = url;
            ttsAudioRef.current.onended = onEnded || null;
            ttsAudioRef.current.play().catch(e => console.error("TTS playback error", e));
        } catch (e) {
            setStatusText('TTS service error.');
            setCallFlowState('error');
        }
    }, []);
    
    const stopTtsPrompt = useCallback(() => {
        if (ttsAudioRef.current) {
            if (!ttsAudioRef.current.paused) {
                ttsAudioRef.current.pause();
            }
            ttsAudioRef.current.onended = null;
            if (ttsUrlRef.current) {
                URL.revokeObjectURL(ttsUrlRef.current);
                ttsUrlRef.current = null;
            }
        }
    }, []);
    
    const handleActualCall = useCallback(async () => {
        setIvrPrompt('');
        setStatusText('Dialing...');
        setCallFlowState('calling');
        
        try {
            const result = await startAylaCall(number);
            if (result.success && result.call_id) {
                setCallId(result.call_id);
                setCallFlowState('connected');
                setStatusText('Connected');
                startDurationCounter();
            } else {
                throw new Error(result.message || 'Call failed to connect.');
            }
        } catch (error: any) {
            setCallFlowState('error');
            setStatusText(error.message || 'An error occurred.');
            setTimeout(() => {
                setCallFlowState('idle');
                setStatusText('Enter number to call');
            }, 3000);
        }
    }, [number]);
    
    const handleStartIvrLanguage = useCallback(() => {
        stopTtsPrompt();
        setCallFlowState('ivrLanguage');
        playTtsPrompt(LANGUAGE_MENU_PROMPT);
    }, [playTtsPrompt, stopTtsPrompt]);

    const handleIvrLanguageInput = useCallback((key: string) => {
        stopTtsPrompt();
        switch (key) {
            case '1':
                setCallFlowState('ivrDepartment');
                playTtsPrompt(DEPARTMENT_MENU_PROMPT);
                break;
            case '2':
                playTtsPrompt(TURKISH_CONNECTING_PROMPT, handleActualCall);
                break;
            case '0':
                playTtsPrompt(getConnectingPrompt(), handleActualCall);
                break;
        }
    }, [playTtsPrompt, handleActualCall, stopTtsPrompt]);
    
    const handleIvrDepartmentInput = useCallback((key: string) => {
        stopTtsPrompt();
        let department: string | undefined;
        switch (key) {
            case '1': department = 'Sales'; break;
            case '2': department = 'Support'; break;
            case '3': department = 'Billing'; break;
            case '*': handleStartIvrLanguage(); return;
            default: return; // Do nothing on invalid input
        }
        playTtsPrompt(getConnectingPrompt(department), handleActualCall);
    }, [playTtsPrompt, handleActualCall, handleStartIvrLanguage, stopTtsPrompt]);

    const handleKeyPress = useCallback((key: string) => {
        if (!audioCtxRef.current) {
            try {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.error("Could not create AudioContext", e);
                return;
            }
        }
        playTone(key);

        switch (callFlowState) {
            case 'idle':
            case 'ended':
                if (number.length < 15) setNumber(prev => prev + key);
                break;
            case 'ivrLanguage':
                handleIvrLanguageInput(key);
                break;
            case 'ivrDepartment':
                handleIvrDepartmentInput(key);
                break;
        }
    }, [callFlowState, number.length, playTone, handleIvrLanguageInput, handleIvrDepartmentInput]);

    const handleDelete = () => {
        if (callFlowState === 'idle' || callFlowState === 'ended') {
            setNumber(prev => prev.slice(0, -1));
        }
    };

    const handleZeroPressStart = () => {
        if (callFlowState === 'calling' || callFlowState === 'connected') return;
        isLongPressRef.current = false;
        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = window.setTimeout(() => {
            isLongPressRef.current = true;
            setNumber(prev => prev.length < 15 && !prev.includes('+') ? prev + '+' : prev);
        }, 600);
    };

    const handleZeroPressEnd = () => {
        if (callFlowState === 'calling' || callFlowState === 'connected') return;
        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
        if (!isLongPressRef.current) handleKeyPress('0');
    };

    const startDurationCounter = () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        setDuration(0);
        durationIntervalRef.current = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    };

    const stopDurationCounter = () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };

    const handleCall = () => {
        if (!number.trim() || callFlowState !== 'idle') return;
        handleStartIvrLanguage();
    };

    const handleEndCall = async () => {
        if (!callId && callFlowState !== 'calling' && callFlowState !== 'ivrLanguage' && callFlowState !== 'ivrDepartment') return;

        stopDurationCounter();
        stopTtsPrompt();
        setStatusText('Ending call...');

        if (callId) {
            try { await stopCall(callId); } catch (e) { console.error('Failed to stop call:', e); }
        }
        
        setCallFlowState('ended');
        setStatusText('Call Ended');
        setCallId(null);
        setTimeout(() => {
            setCallFlowState('idle');
            setNumber('');
            setDuration(0);
            setStatusText('Enter number to call');
            setIvrPrompt('');
        }, 1500);
    };

    const isCallingOrConnected = callFlowState === 'calling' || callFlowState === 'connected';
    const isInIvr = callFlowState === 'ivrLanguage' || callFlowState === 'ivrDepartment';

    return (
        <div className="w-full h-full flex flex-col bg-eburon-bg text-white p-4">
            {onClose && (
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="p-2 text-white/70 hover:text-white"><XIcon className="w-8 h-8" /></button>
                </div>
            )}
            <div className="pt-12 text-center flex-grow flex flex-col">
                <div className="h-24 flex flex-col justify-center">
                    { isCallingOrConnected || isInIvr ? (
                        <>
                            <p className="text-3xl font-semibold">{number}</p>
                            <p className={`text-eburon-fg/70 mt-1 min-h-[20px] px-4 ${isInIvr ? 'text-base' : ''}`}>
                                {isInIvr ? ivrPrompt : (callFlowState === 'connected' ? formatDuration(duration) : statusText)}
                            </p>
                        </>
                    ) : (
                        <>
                            <input
                                type="text"
                                value={number}
                                readOnly
                                className="w-full bg-transparent text-center text-4xl font-light focus:outline-none tracking-wider px-4"
                                placeholder=" "
                            />
                            <p className={`text-sm mt-2 transition-opacity h-5 ${callFlowState === 'error' ? 'text-red-400' : 'text-eburon-fg/60'}`}>{statusText}</p>
                        </>
                    )}
                </div>
                
                <div className="flex-grow flex items-center justify-center">
                    <div className="grid grid-cols-3 gap-5 w-full max-w-xs">
                        {DIALPAD_KEYS.map(({ key, sub }) => {
                             const isZeroKey = key === '0';
                             const props = isZeroKey ? {
                                 onMouseDown: handleZeroPressStart, onMouseUp: handleZeroPressEnd, onMouseLeave: handleZeroPressEnd,
                                 onTouchStart: handleZeroPressStart, onTouchEnd: handleZeroPressEnd,
                             } : { onClick: () => handleKeyPress(key) };
                             return (
                                <button
                                    key={key} {...props}
                                    disabled={isCallingOrConnected}
                                    className="bg-white/10 hover:bg-white/20 text-white rounded-full aspect-square text-3xl font-light flex flex-col items-center justify-center transition-colors active:bg-white/30 disabled:opacity-30"
                                >
                                    {key}
                                    {sub && <span className="text-xs font-semibold tracking-widest">{sub}</span>}
                                </button>
                             );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-center space-x-16 h-24">
                    <div className="w-20"></div>
                     <button
                        onClick={isCallingOrConnected || isInIvr ? handleEndCall : handleCall}
                        className={`w-20 h-20 rounded-full flex items-center justify-center group transition-all duration-200 ${isCallingOrConnected || isInIvr ? 'bg-red-600' : 'bg-green-600'} disabled:bg-gray-600`}
                        disabled={!number.trim() && !isCallingOrConnected && !isInIvr}
                    >
                        <PhoneIcon className={`w-10 h-10 text-white transition-transform ${isCallingOrConnected || isInIvr ? 'transform rotate-[135deg]' : ''}`} />
                    </button>
                    <div className="w-20">
                        {callFlowState === 'idle' && number.length > 0 && (
                            <button onClick={handleDelete} className="p-2 text-eburon-fg/70 h-full flex items-center justify-center">
                                <BackspaceIcon className="w-8 h-8"/>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dialer;