import * as idbService from './idbService';
import * as supabaseService from './supabaseService';
import * as blandAiService from './blandAiService';
import * as geminiService from './geminiService';
import { Agent, Voice, CallLog, TtsGeneration, ChatMessage } from '../types';
import { MOCK_VOICES } from './constants';

type DbMode = 'supabase' | 'indexedDB';
let dbMode: DbMode = 'supabase'; // Assume online by default

export async function initializeDataLayer(): Promise<void> {
  try {
    // A simple, fast query to check if Supabase is reachable.
    const { error } = await supabaseService.supabase
      .from('agents')
      .select('id', { count: 'exact', head: true });

    // We only consider network-related errors as a signal to go offline.
    // Other errors (like table not found on first run) are not connection issues.
    if (error && (error.message.includes('network error') || error.message.includes('Failed to fetch'))) {
      throw new Error('Supabase network error');
    }
    
    console.log('Supabase connection successful. Using online mode.');
    dbMode = 'supabase';
  } catch (e) {
    console.warn('Supabase connection failed. Falling back to IndexedDB for this session.', (e as Error).message);
    dbMode = 'indexedDB';
  }
  
  // Initialize IndexedDB in either case, as it's our fallback.
  await idbService.initDB();
}

// --- AGENTS ---
export async function getAgents(): Promise<Agent[]> {
    if (dbMode === 'supabase') {
        try {
            return await supabaseService.getAgentsFromSupabase();
        } catch (error) {
            console.error("Supabase failed to get agents, falling back to IDB", (error as Error).message);
            dbMode = 'indexedDB';
            return idbService.getAgentsFromIdb();
        }
    }
    return idbService.getAgentsFromIdb();
}

export async function upsertAgents(agents: Agent[]): Promise<void> {
    await idbService.upsertAgentsToIdb(agents); // Always update local first for speed
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertAgentsToSupabase(agents);
        } catch (error) {
            console.error("Supabase failed to upsert agents", (error as Error).message);
            // Data is already in IDB, so the app remains consistent.
        }
    }
}

export async function updateAgent(agent: Agent): Promise<void> {
     await idbService.upsertAgentsToIdb([agent]);
     if (dbMode === 'supabase') {
        try {
            await supabaseService.updateAgentInSupabase(agent);
        } catch (error) {
             console.error("Supabase failed to update agent", (error as Error).message);
        }
     }
}

export async function deleteAgent(agentId: string): Promise<void> {
    await idbService.deleteAgentFromIdb(agentId);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.deleteAgentFromSupabase(agentId);
        } catch (error) {
            console.error("Supabase failed to delete agent", (error as Error).message);
            // Potential to add sync logic here for failed deletions
        }
    }
}


// --- VOICES ---
export async function getVoices(): Promise<Voice[]> {
    try {
        // Always fetch from the source of truth (Bland AI)
        const freshVoices = await blandAiService.listVoices();
        // Asynchronously update caches, don't block the UI
        upsertVoices(freshVoices).catch(err => console.error("Failed to cache voices:", err));
        return freshVoices;
    } catch (error) {
        console.error("Failed to fetch fresh voices, falling back to IDB", (error as Error).message);
        // Fallback to local cache if API fails
        const cachedVoices = await idbService.getVoicesFromIdb();
        if (cachedVoices && cachedVoices.length > 0) {
            return cachedVoices;
        }
        // If cache is also empty, return mock data to ensure app functionality
        console.warn("IDB cache for voices is empty, falling back to mock data.");
        return MOCK_VOICES;
    }
}

export async function upsertVoices(voices: Voice[]): Promise<void> {
    await idbService.upsertVoicesToIdb(voices);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertVoicesToSupabase(voices);
        } catch (error) {
            console.error("Supabase failed to upsert voices", (error as Error).message);
        }
    }
}

export const generateVoiceSample = async (voiceId: string, text: string, language: string): Promise<Blob> => {
    // Ignore voiceId and language, use Gemini TTS with a default voice.
    return geminiService.generateTtsWithGemini(text);
};

export async function saveEmotionTagForVoice(voiceId: string, emotionTag: string): Promise<void> {
    if (dbMode === 'supabase') {
        try {
            await supabaseService.saveEmotionTagForVoice(voiceId, emotionTag);
        } catch (error) {
            console.error("Supabase failed to save emotion tag", (error as Error).message);
            throw error; // Re-throw to be caught in the UI
        }
    } else {
        // This feature is online-only as it requires saving to a specific table.
        console.warn("Cannot save emotion tag in offline mode.");
        throw new Error("This feature requires an online connection.");
    }
}

// --- CALL LOGS ---
export async function getCallLogs(): Promise<CallLog[]> {
    if (dbMode === 'supabase') {
        try {
            return await supabaseService.getCallLogsFromSupabase();
        } catch (error) {
            console.error("Supabase failed to get call logs, falling back to IDB", (error as Error).message);
            dbMode = 'indexedDB';
            return idbService.getCallLogsFromIdb();
        }
    }
    return idbService.getCallLogsFromIdb();
}

export async function upsertCallLogs(logs: CallLog[]): Promise<void> {
    await idbService.upsertCallLogsToIdb(logs);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertCallLogsToSupabase(logs);
        } catch (error) {
            console.error("Supabase failed to upsert call logs", (error as Error).message);
        }
    }
}

// --- TTS GENERATIONS ---
export async function getTtsGenerations(): Promise<TtsGeneration[]> {
    // The Supabase table for TTS generations is not configured.
    // This function now relies exclusively on IndexedDB to prevent errors.
    return idbService.getTtsGenerationsFromIdb();
}

export async function saveTtsGeneration(generationData: {
    input_text: string;
    audio_url: string;
}): Promise<TtsGeneration> {
    // Since Supabase is not used for TTS, we create a local-only record.
    const newGeneration: TtsGeneration = {
        ...generationData,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
    };
    
    // Always write to IDB.
    await idbService.upsertTtsGenerationsToIdb([newGeneration]);
    return newGeneration;
}

// --- CHATBOT MESSAGES ---
export async function getChatbotMessages(): Promise<ChatMessage[]> {
    // FIX: The `chatbot_messages` table does not exist in Supabase.
    // To prevent "table not found" errors, chat history is now managed
    // exclusively via IndexedDB (local storage).
    return idbService.getChatbotMessagesFromIdb();
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
    // FIX: The `chatbot_messages` table does not exist in Supabase.
    // To prevent "table not found" errors, chat messages are now saved
    // exclusively to IndexedDB (local storage).
    await idbService.upsertChatbotMessagesToIdb([message]);
}

export async function clearChatbotMessages(): Promise<void> {
    // FIX: The `chatbot_messages` table does not exist in Supabase.
    // To prevent "table not found" errors, this function now only
    // clears messages from IndexedDB (local storage).
    await idbService.clearChatbotMessagesFromIdb();
}