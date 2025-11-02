import React, { useState, useRef, useCallback, useEffect } from 'react';
import { listenToActiveCall } from '../services/blandAiService';
import { SpeakerIcon, StopIcon } from './icons';

// Helper to decode PCM data. Assume 16-bit, 1-channel PCM at 16kHz.
async function decodePcmData(arrayBuffer: ArrayBuffer, ctx: AudioContext): Promise<AudioBuffer> {
    const sampleRate = 16000;
    const dataInt16 = new Int16Array(arrayBuffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}


const ActiveCallView: React.FC = () => {
    const [callId, setCallId] = useState('80d3a394-fbdd-466e-ba17-bc7f2f6f81bf'); // Default for easy testing
    const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playbackQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);

    const cleanup = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.onerror = null;
            wsRef.current.onmessage = null;
            wsRef.current.onopen = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        
        audioCtxRef.current?.close().catch(console.error);
        audioCtxRef.current = null;

        playbackQueueRef.current.forEach(source => source.stop());
        playbackQueueRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);
    
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);


    const handleListen = async () => {
        if (!callId.trim()) {
            setError("Please enter a Call ID.");
            setStatus('error');
            return;
        }
        setStatus('connecting');
        setError(null);

        const result = await listenToActiveCall(callId);
        if (result.success && result.url) {
            connectWebSocket(result.url);
        } else {
            setError(result.message || 'Failed to get listen URL.');
            setStatus('error');
        }
    };

    const connectWebSocket = (url: string) => {
        cleanup();

        try {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const ws = new WebSocket(url);
            wsRef.current = ws;
            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                setStatus('listening');
            };

            ws.onmessage = async (event) => {
                // Ensure this handler is for the current WebSocket instance
                if (wsRef.current !== ws) return;

                let audioData: ArrayBuffer | null = null;
                
                try {
                    if (event.data instanceof ArrayBuffer) {
                        audioData = event.data;
                    } else if (typeof event.data === 'string') {
                        try {
                            const message = JSON.parse(event.data);
                            // Proactively check for an error message from the server before it closes the connection
                            if (message.status === 'error' || message.error) {
                                const errorMessage = message.message || message.error || 'Received an error from the audio stream.';
                                setError(errorMessage);
                                setStatus('error');
                                cleanup(); // Close the connection as it's errored
                                return;
                            }
    
                            if (typeof message.data === 'string') {
                                // Handle cases where audio data is sent as base64 encoded string in a JSON object
                                const binaryString = atob(message.data);
                                const len = binaryString.length;
                                const bytes = new Uint8Array(len);
                                for (let i = 0; i < len; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                audioData = bytes.buffer;
                            }
                        } catch (e) {
                            console.warn("Received non-audio or non-JSON WebSocket message:", event.data);
                        }
                    }

                    if (audioData && audioCtxRef.current) {
                        const ctx = audioCtxRef.current;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                        const audioBuffer = await decodePcmData(audioData, ctx);
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(ctx.destination);
                        
                        source.addEventListener('ended', () => {
                            playbackQueueRef.current.delete(source);
                        });
                        
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        playbackQueueRef.current.add(source);
                    }
                } catch(err) {
                     // Catch errors from audio decoding/playback to prevent crashing
                    console.error("Error processing incoming audio data:", err);
                }
            };
            
            ws.onerror = () => {
                // This event is generic. We rely on 'onclose' for specific error details.
                console.error("WebSocket error observed. See 'onclose' event for details.");
            };

            ws.onclose = (event: CloseEvent) => {
                if (wsRef.current === ws) {
                    // Don't override a more specific error that might have been received via onmessage
                    if (status === 'error') {
                        cleanup();
                        return;
                    }

                    if (!event.wasClean) {
                        let errorMessage: string;
                        // Provide a more helpful message for the common abnormal closure error
                        if (event.code === 1006) {
                            errorMessage = `Audio stream disconnected. This can happen if the Call ID is invalid, the call has ended, or due to a network issue. Please verify the ID and try again. (Code: 1006)`;
                        } else {
                            errorMessage = `Audio stream disconnected. Code: ${event.code}, Reason: ${event.reason || 'Abnormal closure'}`;
                        }
                        setError(errorMessage);
                        setStatus('error');
                        console.error(`WebSocket closed unexpectedly. Code: ${event.code}, Reason: '${event.reason}'`);
                    } else {
                        // Clean closure (e.g., user clicked stop, or call ended normally)
                        setStatus('idle');
                    }
                    cleanup();
                }
            };

        } catch (err: any) {
            setError(`Failed to start listening session: ${err.message}`);
            setStatus('error');
            cleanup();
        }
    };

    const handleStop = () => {
        setStatus('idle');
        cleanup();
    };

    return (
        <div className="p-8 h-full flex flex-col items-center justify-center bg-eburon-bg text-eburon-fg">
            <div className="w-full max-w-md text-center">
                <SpeakerIcon className="w-16 h-16 mx-auto text-eburon-accent mb-4" />
                <h1 className="text-3xl font-bold mb-2">Listen to Active Call</h1>
                <p className="text-eburon-fg/70 mb-8">
                    Enter a Call ID to start a live listening session.
                </p>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={callId}
                        onChange={(e) => setCallId(e.target.value)}
                        placeholder="Enter Call ID (e.g., 80d3a394-...)"
                        className="flex-1 bg-eburon-panel border border-eburon-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                        disabled={status === 'listening' || status === 'connecting'}
                    />
                    {status === 'listening' ? (
                        <button onClick={handleStop} className="bg-red-500 hover:bg-red-600 text-white font-bold p-3 rounded-lg transition-colors flex items-center justify-center aspect-square">
                            <StopIcon className="w-6 h-6" />
                        </button>
                    ) : (
                         <button onClick={handleListen} disabled={status === 'connecting'} className="bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-600">
                            {status === 'connecting' ? 'Connecting...' : 'Listen'}
                        </button>
                    )}
                </div>

                <div className="h-10 mt-4 flex items-center justify-center">
                    {status === 'listening' && (
                        <div className="text-eburon-ok flex items-center justify-center gap-3">
                            <div className="relative flex h-6 w-6">
                                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-eburon-ok opacity-75"></div>
                                <SpeakerIcon className="relative inline-flex rounded-full h-6 w-6"/>
                            </div>
                            <span>Live Listening...</span>
                        </div>
                    )}
                     {status === 'error' && error && (
                        <p className="text-red-400">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActiveCallView;