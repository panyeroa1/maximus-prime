import { GoogleGenAI, GenerateContentResponse, GroundingMetadata, Modality, Content, Part, Type } from "@google/genai";
import { ChatMessage, TranscriptSegment, CallAnalysisResult } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const EBURON_ERROR_MESSAGE = "The Eburon.ai service encountered an error. Please try again.";

// --- Audio Helper Functions ---
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function pcmToWavBlob(pcmData: Uint8Array, options: { numChannels: number, sampleRate: number, bitDepth: number }): Blob {
    const { numChannels, sampleRate, bitDepth } = options;
    const byteRate = sampleRate * numChannels * bitDepth / 8;
    const blockAlign = numChannels * bitDepth / 8;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
}
// --- End Audio Helper Functions ---


const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

export const sendMessageStreamToGemini = async (
    history: ChatMessage[],
    newMessage: string,
    imageFile: File | null,
    options: {
        useSearchGrounding: boolean;
        useMapsGrounding: boolean;
        useLowLatency: boolean;
        useThinkingMode: boolean;
        userLocation: { latitude: number; longitude: number } | null;
    },
    systemPrompt: string
): Promise<AsyncIterable<GenerateContentResponse>> => {
    try {
        let modelName = 'gemini-2.5-flash';
        if (options.useThinkingMode) modelName = 'gemini-2.5-pro';
        else if (options.useLowLatency) modelName = 'gemini-flash-lite-latest';

        const contents: Content[] = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }],
        }));

        const userParts: Part[] = [{ text: newMessage }];
        if (imageFile) {
            const imagePart = await fileToGenerativePart(imageFile);
            userParts.push(imagePart);
        }
        contents.push({ role: 'user', parts: userParts });

        const config: any = {
            systemInstruction: systemPrompt,
        };
        
        if (options.useThinkingMode) {
            config.thinkingConfig = { thinkingBudget: 32768 };
        } else {
            // Ensure thinking is off for other models
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        const tools: any[] = [];
        if (options.useSearchGrounding) tools.push({ googleSearch: {} });
        if (options.useMapsGrounding) tools.push({ googleMaps: {} });
        if (tools.length > 0) config.tools = tools;

        const toolConfig: any = {};
        if (options.useMapsGrounding && options.userLocation) {
            toolConfig.retrievalConfig = {
                latLng: {
                    latitude: options.userLocation.latitude,
                    longitude: options.userLocation.longitude
                }
            };
        }
        if (Object.keys(toolConfig).length > 0) {
            config.toolConfig = toolConfig;
        }

        return ai.models.generateContentStream({
            model: modelName,
            contents,
            config,
        });
    } catch (error) {
        console.error("Eburon AI Service Error (Stream):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const generateImageWithGemini = async (
    prompt: string,
    imageFile: File | null
): Promise<string> => {
    try {
        const parts: Part[] = [{ text: prompt }];
        if (imageFile) {
            const imagePart = await fileToGenerativePart(imageFile);
            parts.unshift(imagePart); // Image comes first for editing
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType;
                const base64ImageBytes: string = part.inlineData.data;
                return `data:${mimeType};base64,${base64ImageBytes}`;
            }
        }

        throw new Error("No image data was found in the Eburon.ai response.");

    } catch (error) {
        console.error("Eburon AI Service Error (Image Gen):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
}

export const generateTtsWithGemini = async (text: string, voiceName: string = 'Kore'): Promise<Blob> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS service.");
        }
        const pcmData = decode(base64Audio);
        return pcmToWavBlob(pcmData, { sampleRate: 24000, bitDepth: 16, numChannels: 1 });
    } catch (error) {
        console.error("Eburon AI Service Error (TTS):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
}

export const transcribeAudioWithGemini = async (audioFile: File): Promise<string> => {
    try {
        const audioPart = await fileToGenerativePart(audioFile);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: "Transcribe the following audio recording." },
                    audioPart
                ]
            },
        });
        return response.text;
    } catch (error) {
        console.error("Eburon AI Service Error (Transcription):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const transcribeAudioWithDiarization = async (audioFile: File): Promise<TranscriptSegment[]> => {
    try {
        const audioPart = await fileToGenerativePart(audioFile);
        const systemInstruction = `You are a highly accurate audio transcription service. 
        Transcribe the provided audio from a customer service call. There are two speakers: an "agent" and a "user".
        Identify who is speaking for each segment.
        Your output MUST be a valid JSON array of objects.
        Each object must have two properties: 
        1. "user": a string, which must be either "user" or "agent".
        2. "text": a string containing the transcribed text for that segment.
        Do not include any other text, explanations, or formatting outside of the JSON array.`;

        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    user: { type: Type.STRING, enum: ['agent', 'user'] },
                    text: { type: Type.STRING }
                },
                required: ['user', 'text']
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart] },
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            }
        });

        const jsonResponse = JSON.parse(response.text.trim());
        
        if (!Array.isArray(jsonResponse) || (jsonResponse.length > 0 && jsonResponse.some(item => typeof item.user !== 'string' || typeof item.text !== 'string'))) {
            throw new Error("AI transcription response did not match the expected JSON schema.");
        }
        
        return jsonResponse as TranscriptSegment[];

    } catch (error) {
        console.error("Eburon AI Service Error (Diarization):", error);
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse transcription from the AI. The response was not valid JSON.");
        }
        throw new Error("An error occurred during multi-speaker transcription.");
    }
};


export const analyzeCallTranscript = async (transcript: TranscriptSegment[]): Promise<CallAnalysisResult> => {
    try {
        const transcriptText = transcript.map(t => `${t.user}: ${t.text}`).join('\n');
        
        const systemInstruction = `You are a highly intelligent call analysis AI. Analyze the provided customer service call transcript. Your task is to provide a concise summary, identify the overall sentiment, extract key topics, and provide a sentiment for each segment of the conversation. The output must be a valid JSON object that adheres to the provided schema. The sentiment must be one of 'Positive', 'Neutral', or 'Negative'. The overall sentiment can also be 'Mixed'. The sentimentTimeline MUST contain one entry for each segment of the original transcript, matching the text and speaker exactly.`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: "A concise summary of the call's purpose and outcome." },
                overallSentiment: { type: Type.STRING, enum: ['Positive', 'Neutral', 'Negative', 'Mixed'], description: "The single, overall sentiment of the entire call." },
                topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 2-5 key topics discussed in the call." },
                sentimentTimeline: {
                    type: Type.ARRAY,
                    description: "An array where each object represents a segment of the transcript with its corresponding sentiment.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            user: { type: Type.STRING, enum: ['agent', 'user'], description: "The speaker of this transcript segment." },
                            text: { type: Type.STRING, description: "The text of the transcript segment." },
                            sentiment: { type: Type.STRING, enum: ['Positive', 'Neutral', 'Negative'], description: "The sentiment of this specific segment." }
                        },
                        required: ['user', 'text', 'sentiment']
                    }
                }
            },
            required: ['summary', 'overallSentiment', 'topics', 'sentimentTimeline']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Here is the transcript:\n\n${transcriptText}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
        });
        
        const jsonResponse = JSON.parse(response.text.trim());
        
        if (!jsonResponse.summary || !jsonResponse.sentimentTimeline) {
            throw new Error("Analysis response from AI is missing required fields.");
        }
        
        const result: CallAnalysisResult = jsonResponse;

        // Merge start_time from original transcript into the sentiment timeline
        // This assumes the AI preserves the order of transcript segments, as instructed.
        if (result.sentimentTimeline && Array.isArray(result.sentimentTimeline) && result.sentimentTimeline.length === transcript.length) {
            result.sentimentTimeline.forEach((segment, index) => {
                if (transcript[index] && typeof transcript[index].start_time === 'number') {
                    segment.start_time = transcript[index].start_time;
                }
            });
        } else {
            console.warn("Sentiment timeline length from AI does not match original transcript length. Timestamps for chart will be missing.");
        }
        
        return result;

    } catch (error) {
        console.error("Eburon AI Service Error (Call Analysis):", error);
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse the analysis from the AI. The response was not valid JSON.");
        }
        throw new Error("An error occurred during call analysis.");
    }
};