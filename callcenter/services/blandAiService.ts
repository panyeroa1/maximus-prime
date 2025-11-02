import { CallLog, Voice, Booking } from "../types";
import { AYLA_MULTILINGUAL_PROMPT } from '../constants';
import { runtimeEnv } from "./runtimeEnv";

const BLAND_API_KEY = runtimeEnv.blandApiKey;
const BLAND_ENCRYPTED_KEY = runtimeEnv.blandEncryptedKey;
// The base URL for the Bland AI API. Direct requests are made from the client.
const API_BASE_URL = 'https://api.bland.ai';
const EBURON_ERROR_MESSAGE = "The Phone API service encountered an error. Please try again.";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const defaultHeaders: HeadersInit = {
        'Authorization': BLAND_API_KEY,
        'Content-Type': 'application/json',
    };

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        // FIX: Provide more descriptive error messages from the API.
        let errorMessage = `Phone API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (e) {
            // Not a JSON response, stick with the status text.
        }
        throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    if (contentType && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
        return response.blob();
    }
    return response;
};

// --- Call Logs ---
export const fetchCallLogs = async (): Promise<CallLog[]> => {
    try {
        const response = await apiFetch('/v1/calls');
        return response.calls.map((c: any) => ({
            call_id: c.call_id,
            created_at: c.created_at,
            duration: c.duration,
            from: c.from,
            to: c.to,
            recording_url: c.recording_url,
            concatenated_transcript: c.concatenated_transcript,
            transcript: c.transcript,
        }));
    } catch (error) {
        console.error("Error fetching call logs:", error);
        throw new Error("Failed to fetch call logs from Phone API.");
    }
};

export const fetchRecording = async (recordingUrl: string): Promise<Blob> => {
    let lastError: Error | null = null;
    // Retry logic is still useful for transient network issues or if the URL takes a moment to become valid.
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            // Use a simple fetch, as the URL is likely pre-signed and doesn't need Bland API auth headers.
            const response = await fetch(recordingUrl);
            
            if (!response.ok) {
                // Throw an error to be caught and retried.
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();

            if (blob.type === 'application/json') {
                const errorJson = JSON.parse(await blob.text());
                throw new Error(errorJson.message || 'API returned a JSON error instead of audio.');
            }

            if (blob.size === 0) {
                throw new Error("Recording file is empty and may still be processing.");
            }
            
            return blob;

        } catch (error: any) {
            lastError = error;
            const isRetryable = error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('processing');
            if (isRetryable && attempt < 4) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`Fetch recording failed (Attempt ${attempt}). Retrying in ${delay}ms... Error: ${error.message}`);
                await sleep(delay);
            } else {
                break; // Non-retryable error or max attempts reached
            }
        }
    }
    // If loop finishes without returning, throw final error.
    throw new Error(`Failed to fetch recording. It may not be available yet. Last error: ${lastError?.message}`);
};

// --- Voice Management ---
export const listVoices = async (): Promise<Voice[]> => {
    try {
        const response = await apiFetch('/v1/voices');
        return response.voices
            .filter((v: any) => v && v.id)
            .map((v: any) => ({
                id: v.id,
                name: v.name,
                provider: 'Bland AI',
                type: v.public ? 'Prebuilt' : 'Cloned',
                tags: v.tags || []
            }));
    } catch (error) {
        console.error("Error fetching voices:", error);
        throw new Error("Failed to fetch voices from Phone API.");
    }
};

export const generateVoiceSample = async (voiceId: string, text: string, language: string): Promise<Blob> => {
     try {
        const response = await apiFetch(`/v1/voices/${voiceId}/sample`, {
            method: 'POST',
            body: JSON.stringify({
                text,
                language,
                model: "base",
                temperature: 0.7,
            }),
        });
        return response as Blob;
    } catch (error) {
        console.error("Error generating voice sample:", error);
        throw new Error("Failed to generate voice sample.");
    }
};

export const cloneVoice = async (name: string, audioSample: Blob): Promise<{ voice_id: string, name: string }> => {
    const formData = new FormData();
    formData.append('name', name);
    // Bland API expects a file with a name. 'sample.wav' is a reasonable default.
    formData.append('audio_samples', audioSample, 'sample.wav');

    try {
        const response = await fetch(`${API_BASE_URL}/v1/voices/clone`, {
            method: 'POST',
            headers: {
                'Authorization': BLAND_API_KEY,
                // The browser automatically sets the 'Content-Type' for FormData with the correct boundary.
            },
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            // Bland's API seems to return errors in a `message` property on the root object
            // or an `errors` array for validation issues.
            const errorMessage = result.message || result.errors?.[0]?.message || `Cloning failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        if (result.data && result.data.voice_id) {
            return result.data;
        }

        // Handle unexpected success response format
        throw new Error("Cloning API call succeeded but did not return the expected voice data.");

    } catch (error) {
        console.error("Error in blandAiService.cloneVoice:", error);
        // Re-throw the error so it can be handled by the calling component
        throw error;
    }
};


// --- Call Control ---
export const startAylaCall = async (phoneNumber: string): Promise<{ success: boolean, message?: string, call_id?: string }> => {
    const headers = { 'encrypted_key': BLAND_ENCRYPTED_KEY };
    const data = {
        "phone_number": phoneNumber,
        "voice": "e43eed48-ffec-488e-a0ac-f655c15f5523",
        "wait_for_greeting": false,
        "record": true,
        "answered_by_enabled": true,
        "noise_cancellation": true,
        "interruption_threshold": 1000,
        "block_interruptions": false,
        "max_duration": 15,
        "model": "base",
        "memory_id": "1bae20f6-b7fc-4ddb-8ddb-ef42519bc3f6",
        "language": "babel",
        "background_track": "none",
        "endpoint": "https://api.bland.ai",
        "voicemail_action": "hangup",
        "summary_prompt": "analize how the agent response and give the proper way it should be if you see needed corrections, ignore and say your complement if theres no need of anything to change in terms of call approach.",
        // FIX: Replaced the large hardcoded prompt with an imported constant.
        "task": AYLA_MULTILINGUAL_PROMPT,
        "first_sentence": "Thank you for calling Turkish Airlines. My name is Ayla. How may I help you today?",
        "temperature": 0.3,
        "from": "+15674234720",
        "timezone": "Europe/Moscow",
        "tools": [
            "KB-a333f472-3918-4fff-915a-2b3e783abd62"
        ],
        "ivr_mode": false,
        "webhook": "https://api.bland.ai",
        "webhook_events": [
            "dynamic_data",
            "webhook",
            "tool",
            "latency",
            "queue",
            "call",
            "error"
        ],
        "analysis_schema": {
            "sentiment": "customer_mood, emotion, "
        }
    };

    try {
        const response = await apiFetch('/v1/calls', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: headers
        });
        return { success: true, ...response };
    } catch (error: any) {
        console.error('Error starting call:', error);
        return { success: false, message: error.message || EBURON_ERROR_MESSAGE };
    }
};

export const stopCall = async (callId: string): Promise<{ success: boolean, message?: string }> => {
    try {
        await apiFetch(`/v1/calls/${callId}/stop`, { method: 'POST' });
        return { success: true };
    } catch (error: any) {
        console.error('Error stopping call:', error);
        return { success: false, message: error.message || EBURON_ERROR_MESSAGE };
    }
};

export const listenToActiveCall = async (callId: string): Promise<{ success: boolean, message?: string, url?: string }> => {
    try {
        const response = await apiFetch(`/v1/calls/${callId}/listen`, { method: 'POST' });
        return { success: true, ...response };
    } catch (error: any) {
        console.error('Error listening to call:', error);
        return { success: false, message: error.message || EBURON_ERROR_MESSAGE };
    }
}
