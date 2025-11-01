import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, FunctionCall } from '@google/genai';
import { ALL_TOOLS } from '../constants/tools';

interface GeminiCallbacks {
  onmessage: (message: LiveServerMessage) => void;
  onclose: () => void;
  onerror: (error: ErrorEvent) => void;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface SpeechConfigParams {
  voice: string;
}

export function connectToGemini(
  ai: GoogleGenAI,
  callbacks: GeminiCallbacks,
  speechConfig: SpeechConfigParams,
  systemInstruction: string
): Promise<LiveSession> {
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
            prebuiltVoiceConfig: { voiceName: speechConfig.voice },
        }
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: ALL_TOOLS }],
    },
  });
}

export async function handleToolCall(fc: FunctionCall, geo: Geolocation | null): Promise<any> {
  console.log('Handling tool call:', fc.name, fc.args);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    switch (fc.name) {
      case 'deepThink':
        const thinkResponse = await ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: fc.args.query,
          config: { thinkingConfig: { thinkingBudget: 32768 } },
        });
        return { success: true, result: thinkResponse.text };

      case 'performGoogleSearch':
        const searchResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: fc.args.query,
          config: { tools: [{ googleSearch: {} }] },
        });
        return { 
            success: true, 
            result: searchResponse.text, 
            citations: searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || []
        };
      
      case 'findNearbyPlaces':
        if (!geo) {
          return { success: false, error: "Geolocation is not available." };
        }
        const mapResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: fc.args.query,
          config: { 
            tools: [{ googleMaps: {} }],
            toolConfig: { retrievalConfig: { latLng: geo } }
          },
        });
        return { 
            success: true, 
            result: mapResponse.text,
            places: mapResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || []
        };
      
      case 'performLowLatencyQuery':
          const liteResponse = await ai.models.generateContent({
              model: 'gemini-flash-lite-latest',
              contents: fc.args.query
          });
          return { success: true, result: liteResponse.text };

      // Mock implementations for other tools
      case 'postToTwitter':
        return { success: true, tweetId: `mock_tw_${Date.now()}` };
      case 'postToLinkedIn':
        console.log(`Posting to LinkedIn: ${fc.args.content}`);
        return { success: true, postId: `mock_li_${Date.now()}` };
      case 'scheduleCalendarEvent':
        return { success: true, eventId: `mock_event_${Date.now()}` };
      case 'sendEmail':
         return { success: true, message: 'Email sent successfully.' };
      case 'getWeather':
        return { success: true, weather: `Sunny, 25°C in ${fc.args.location}` };
      case 'getStockPrice':
        return { success: true, price: `${(Math.random() * 500 + 100).toFixed(2)} USD` };
      case 'takeNote':
        console.log(`Note Taken: ${fc.args.title || 'Untitled'}\n---\n${fc.args.content}`);
        return { success: true, message: 'Note has been successfully taken.' };
      default:
        console.warn(`No handler for tool: ${fc.name}`);
        return { success: false, error: `Tool '${fc.name}' is not implemented yet.` };
    }
  } catch (error) {
    console.error(`Error executing tool ${fc.name}:`, error);
    return { success: false, error: `Failed to execute tool ${fc.name}.` };
  }
}