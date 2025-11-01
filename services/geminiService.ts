// FIX: The `LiveSession` type is not exported from @google/genai.
import { GoogleGenAI, LiveCallbacks, Modality, FunctionDeclaration } from '@google/genai';
import { ALL_TOOLS } from '../constants/tools';
import { AppSettings } from '../types';

let ai: GoogleGenAI;

function getAiInstance() {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    // FIX: Initialize GoogleGenAI with a named apiKey parameter.
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

export function startLiveSession(
  settings: AppSettings,
  callbacks: LiveCallbacks
// FIX: The `LiveSession` type is not exported from @google/genai, so use `any` for the return promise.
): Promise<any> {
  const ai = getAiInstance();

  const systemInstruction = `You are Maximus, ${settings.role}. ${settings.instructions}`;

  const enabledTools: FunctionDeclaration[] = ALL_TOOLS
    .filter(tool => settings.enabledTools.includes(tool.name))
    .map(tool => tool.functionDeclaration);

  return ai.live.connect({
    // FIX: Use the correct model for real-time audio conversations.
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      // FIX: responseModalities must be an array with a single Modality.AUDIO element.
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voice as any } },
      },
      systemInstruction: systemInstruction,
      tools: enabledTools.length > 0 ? [{ functionDeclarations: enabledTools }] : undefined,
      outputAudioTranscription: {},
      inputAudioTranscription: {},
    },
  });
}
