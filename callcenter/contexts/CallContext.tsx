import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AUDIO_ASSETS } from '../constants';
import { ActiveView } from '../types';

type CallStatus = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ending' | 'ended' | 'error';

interface CallContextType {
  status: CallStatus;
  number: string;
  duration: number;
  handleKeyPress: (key: string) => void;
  handleDelete: () => void;
  handleCall: () => void;
  handleEndCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

interface CallProviderProps {
  children: React.ReactNode;
  activeView: ActiveView;
}

export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [number, setNumber] = useState('');
  const [duration, setDuration] = useState(0);
  const durationIntervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const statusRef = useRef(status);
  const callStateTimersRef = useRef<number[]>([]);
  const holdSoundTimerRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearCallStateTimers = useCallback(() => {
    callStateTimersRef.current.forEach(clearTimeout);
    callStateTimersRef.current = [];
  }, []);

  // Clean up intervals and timers on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (holdSoundTimerRef.current) {
        clearTimeout(holdSoundTimerRef.current);
        holdSoundTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      clearCallStateTimers();
    };
  }, [clearCallStateTimers]);

  const clearHoldTimer = useCallback(() => {
    if (holdSoundTimerRef.current) {
      clearTimeout(holdSoundTimerRef.current);
      holdSoundTimerRef.current = null;
    }
  }, []);

  const playSound = useCallback((sound: 'ring' | 'hold' | 'busy', loop = false) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audioEl = audioRef.current;
    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.src = AUDIO_ASSETS[sound];
    audioEl.loop = sound === 'hold' ? true : loop;
    audioEl.volume = sound === 'hold' ? 0.15 : 1;
    audioEl.play().catch(e => console.error("Audio playback error:", e));
    if (sound === 'hold') {
      clearHoldTimer();
      holdSoundTimerRef.current = window.setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }, 15000);
    } else {
      clearHoldTimer();
    }
  }, [clearHoldTimer]);

  const stopSound = useCallback(() => {
    clearHoldTimer();
    if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  }, [clearHoldTimer]);

  const handleKeyPress = (key: string) => {
    if (status !== 'connected' && number.length < 15) {
      setNumber(prev => prev + key);
    }
  };

  const handleDelete = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const startDurationCounter = () => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    setDuration(0);
    durationIntervalRef.current = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };
  
  const stopDurationCounter = () => {
      if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
      }
  };

  const handleCall = useCallback(() => {
    if (!number || statusRef.current !== 'idle') return;
    
    // FIX: Clear previous timers to prevent race conditions if called multiple times.
    clearCallStateTimers();
    setStatus('dialing');
    
    const dialingTimer = window.setTimeout(() => {
      if (statusRef.current === 'dialing') {
        setStatus('ringing');
        playSound('ring', true);

        const ringingTimer = window.setTimeout(() => {
          if (statusRef.current === 'ringing') {
            stopSound();
            setStatus('connected');
            startDurationCounter();
          }
        }, 5500); // Ring for 5.5 seconds
        callStateTimersRef.current.push(ringingTimer);
      }
    }, 1500); // Dial for 1.5 seconds
    callStateTimersRef.current.push(dialingTimer);
  }, [number, playSound, stopSound, clearCallStateTimers]);

  const handleEndCall = useCallback(() => {
      if (statusRef.current === 'idle' || statusRef.current === 'ended' || statusRef.current === 'ending') return;
      
      clearCallStateTimers();
      
      setStatus('ending');
      stopSound();
      stopDurationCounter();
      
      const endTimer = window.setTimeout(() => {
          setStatus('ended');
          const resetTimer = window.setTimeout(() => {
              setStatus('idle');
              setNumber('');
              setDuration(0);
          }, 1000);
          callStateTimersRef.current.push(resetTimer);
      }, 500);
      callStateTimersRef.current.push(endTimer);
  }, [clearCallStateTimers, stopSound]);

  const value = {
    status,
    number,
    duration,
    handleKeyPress,
    handleDelete,
    handleCall,
    handleEndCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
