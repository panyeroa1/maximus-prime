import * as idbService from './idbService';
import * as supabaseService from './supabaseService';
import * as blandAiService from './blandAiService';
import * as geminiService from './geminiService';
import { Agent, Voice, CallLog, TtsGeneration, ChatMessage, Feedback, AgentFeedback, LiveTranscript, CallAnalysisResult } from '../types';
import { MOCK_KNOWLEDGE_BASE, MOCK_VOICES } from '../constants';
import { demoData } from './demoData';

type DbMode = 'supabase' | 'indexedDB';
let dbMode: DbMode = 'supabase'; // Assume online by default
let hasSeededDemoData = false;

const seedDemoDataIfNeeded = async () => {
  if (hasSeededDemoData) return;
  try {
    const [existingAgents, existingVoices, existingCalls] = await Promise.all([
      idbService.getAgentsFromIdb(),
      idbService.getVoicesFromIdb(),
      idbService.getCallLogsFromIdb(),
    ]);

    const seedPromises: Promise<void>[] = [];

    if (existingAgents.length === 0 && demoData.agents.length > 0) {
      seedPromises.push(idbService.upsertAgentsToIdb(demoData.agents));
    }
    if (existingVoices.length === 0 && demoData.voices.length > 0) {
      seedPromises.push(idbService.upsertVoicesToIdb(demoData.voices));
    }
    if (existingCalls.length === 0 && demoData.callLogs.length > 0) {
      seedPromises.push(idbService.upsertCallLogsToIdb(demoData.callLogs));
    }

    if (seedPromises.length > 0) {
      await Promise.all(seedPromises);
    }

    hasSeededDemoData = true;
  } catch (error) {
    console.error("Failed to seed demo data:", error);
  }
};

const getAgentsFromLocal = async (): Promise<Agent[]> => {
  const agents = await idbService.getAgentsFromIdb();
  if (agents.length > 0) {
    return agents;
  }
  if (demoData.agents.length > 0) {
    await idbService.upsertAgentsToIdb(demoData.agents);
    return demoData.agents;
  }
  return [];
};

const getCallLogsFromLocal = async (): Promise<CallLog[]> => {
  const logs = await idbService.getCallLogsFromIdb();
  if (logs.length > 0) {
    return logs;
  }
  if (demoData.callLogs.length > 0) {
    await idbService.upsertCallLogsToIdb(demoData.callLogs);
    return demoData.callLogs;
  }
  return [];
};

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
  await seedDemoDataIfNeeded();
}

// --- AGENTS ---
export async function getAgents(): Promise<Agent[]> {
    if (dbMode === 'supabase') {
        try {
            return await supabaseService.getAgentsFromSupabase();
        } catch (error) {
            console.error("Supabase failed to get agents, falling back to IDB", (error as Error).message);
            dbMode = 'indexedDB';
            return getAgentsFromLocal();
        }
    }
    return getAgentsFromLocal();
}

export async function upsertAgents(agents: Agent[]): Promise<void> {
    if (dbMode === 'supabase') {
        try {
            // Sync with Supabase first to get real IDs for new agents
            const syncedAgents = await supabaseService.upsertAgentsToSupabase(agents);
            // Then, save the final, correct state to IDB
            await idbService.upsertAgentsToIdb(syncedAgents);
        } catch (error) {
            console.error("Supabase sync failed for agents", (error as Error).message);
            // Re-throw the error so the UI can display it
            throw error;
        }
    } else {
        // In offline mode, just save to IDB. New agents will have temp IDs.
        await idbService.upsertAgentsToIdb(agents);
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
    if (dbMode === 'indexedDB') {
        const cachedVoices = await idbService.getVoicesFromIdb();
        if (cachedVoices.length > 0) {
            return cachedVoices;
        }
        if (demoData.voices.length > 0) {
            await idbService.upsertVoicesToIdb(demoData.voices);
            return demoData.voices;
        }
        return MOCK_VOICES;
    }

    try {
        const freshVoices = await blandAiService.listVoices();
        
        const eburonAylaVoice: Voice = {
            id: '1a7a4ab1-2434-4a87-9152-45a8d9a2a3e0',
            name: 'Eburon Ayla',
            provider: 'Eburon TTS',
            type: 'Prebuilt',
            tags: ['Turkish', 'Female', 'Professional']
        };

        const allVoices = [eburonAylaVoice, ...freshVoices.filter(v => v.id !== eburonAylaVoice.id)];

        let customTagsMap = new Map<string, string[]>();
        if (dbMode === 'supabase') {
            try {
                customTagsMap = await supabaseService.getCustomVoiceTags();
            } catch (e) {
                console.warn("Could not fetch custom tags from Supabase. Voices will be displayed without them.", e);
            }
        }
        
        const mergedVoices = allVoices.map(voice => {
            const customTags = customTagsMap.get(voice.id) || [];
            const allTags = [...new Set([...(voice.tags || []), ...customTags])]; 
            return { ...voice, tags: allTags };
        });

        upsertVoices(mergedVoices).catch(err => console.error("Failed to cache voices:", err));
        return mergedVoices;
    } catch (error) {
        console.error("Failed to fetch fresh voices, falling back to IDB", (error as Error).message);
        const cachedVoices = await idbService.getVoicesFromIdb();
        if (cachedVoices && cachedVoices.length > 0) {
            return cachedVoices;
        }
        if (demoData.voices.length > 0) {
            console.warn("IDB cache empty. Loading bundled demo voices.");
            await idbService.upsertVoicesToIdb(demoData.voices);
            return demoData.voices;
        }
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

export const generateVoiceSample = async (voice: Voice, text: string, language: string): Promise<Blob> => {
    // For special Eburon voices, use the high-quality Gemini TTS engine.
    if (voice.provider === 'Eburon TTS' || voice.provider === 'Gemini') {
        let geminiVoiceName = 'Kore'; // Default for Eburon Ayla
        if (voice.name === 'Zephyr') {
            geminiVoiceName = 'Zephyr';
        }
        return geminiService.generateTtsWithGemini(text, geminiVoiceName);
    }
    // For all other voices (assumed to be from Bland AI), use their native sample generator.
    return blandAiService.generateVoiceSample(voice.id, text, language);
};

export const generateTts = async (text: string, voiceId: string): Promise<Blob> => {
    // This function is now self-contained and determines the correct TTS provider.
    // It leverages getVoices which has its own caching logic.
    const allVoices = await getVoices();
    const selectedVoice = allVoices.find(v => v.id === voiceId);

    if (!selectedVoice) {
        console.warn(`Voice with ID ${voiceId} not found. Using default Gemini TTS.`);
        return geminiService.generateTtsWithGemini(text);
    }

    // For special Eburon voices, use the high-quality Gemini TTS engine.
    if (selectedVoice.provider === 'Eburon TTS' || selectedVoice.provider === 'Gemini') {
        let geminiVoiceName = 'Kore'; // Default
        
        // This mapping allows using Gemini-native voices by name if they are in the list
        if (selectedVoice.name === 'Zephyr') geminiVoiceName = 'Zephyr';
        else if (selectedVoice.name === 'Puck') geminiVoiceName = 'Puck';
        else if (selectedVoice.name === 'Charon') geminiVoiceName = 'Charon';
        else if (selectedVoice.name === 'Fenrir') geminiVoiceName = 'Fenrir';
        // 'Kore' is the default for 'Eburon Ayla' or any other non-mapped Gemini/Eburon voice.

        return geminiService.generateTtsWithGemini(text, geminiVoiceName);
    }
    
    // For all other voices (assumed to be from Bland AI), use their native sample generator.
    
    // Helper to infer language from tags for Bland AI API
    const getLanguageFromTags = (tags: string[] = []): string => {
        const langMap: { [key: string]: string } = {
            english: 'en-US',
            turkish: 'tr-TR',
            spanish: 'es-ES',
        };
        for (const tag of tags) {
            const langCode = langMap[tag.toLowerCase()];
            if (langCode) return langCode;
        }
        return 'en-US'; // Default to English
    };

    const language = getLanguageFromTags(selectedVoice.tags);
    return blandAiService.generateVoiceSample(selectedVoice.id, text, language);
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

export async function updateVoiceTags(voiceId: string, newTags: string[]): Promise<void> {
    // Differentiate between API tags and custom tags to save only the custom ones.
    const freshVoices = await blandAiService.listVoices();
    const targetVoice = freshVoices.find(v => v.id === voiceId);
    const baseTags = targetVoice?.tags || [];

    const customTags = newTags.filter(tag => !baseTags.includes(tag));
    
    if (dbMode === 'supabase') {
        try {
            await supabaseService.updateCustomVoiceTags(voiceId, customTags);
        } catch (error) {
            console.error("Supabase failed to update voice tags", (error as Error).message);
            throw error;
        }
    }

    // Update the local IDB cache for immediate UI feedback and offline persistence.
    const voicesFromIdb = await idbService.getVoicesFromIdb();
    const updatedVoices = voicesFromIdb.map(v => 
        v.id === voiceId ? { ...v, tags: newTags } : v
    );
    await idbService.upsertVoicesToIdb(updatedVoices);
}

export async function cloneVoice(name: string, audioSample: Blob): Promise<{ voice_id: string, name: string }> {
    try {
        // This is a network-only operation, no offline/IDB equivalent.
        const clonedVoiceData = await blandAiService.cloneVoice(name, audioSample);
        // The UI should refresh the voice list after this completes successfully to show the new voice.
        // The current implementation in VoicesView does this when switching back to 'list' mode.
        return clonedVoiceData;
    } catch (error) {
        console.error("Data service error during voice cloning:", error);
        // Re-throw for UI to handle
        throw error;
    }
}


// --- CALL LOGS ---
export async function getCallLogs(): Promise<CallLog[]> {
    if (dbMode === 'supabase') {
        try {
            const logs = await supabaseService.getCallLogsFromSupabase();
            // Also update local cache for offline access
            await idbService.upsertCallLogsToIdb(logs);
            return logs;
        } catch (error) {
            console.error("Supabase failed to get call logs, falling back to IDB", (error as Error).message);
            dbMode = 'indexedDB';
            return getCallLogsFromLocal();
        }
    }
    return getCallLogsFromLocal();
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

export async function saveCallAnalysis(callId: string, analysisResult: CallAnalysisResult): Promise<void> {
    // Update IDB first for immediate local persistence
    try {
        const logs = await idbService.getCallLogsFromIdb();
        const updatedLogs = logs.map(log =>
            log.call_id === callId ? { ...log, analysisResult } : log
        );
        await idbService.upsertCallLogsToIdb(updatedLogs);
    } catch (idbError) {
        console.error("Failed to save analysis to IndexedDB:", idbError);
    }

    if (dbMode === 'supabase') {
        try {
            await supabaseService.updateCallAnalysisInSupabase(callId, analysisResult);
        } catch (supabaseError) {
            console.error("Supabase failed to save call analysis", (supabaseError as Error).message);
            // Don't rethrow, as the data is saved locally in IDB.
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
    // The `chatbot_messages` table does not exist in Supabase.
    // Chat history is managed exclusively via IndexedDB (local storage).
    return idbService.getChatbotMessagesFromIdb();
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
    // The `chatbot_messages` table does not exist in Supabase.
    // Chat messages are saved exclusively to IndexedDB (local storage).
    await idbService.upsertChatbotMessagesToIdb([message]);
}

export async function clearChatbotMessages(): Promise<void> {
    // The `chatbot_messages` table does not exist in Supabase.
    // This function now only clears messages from IndexedDB (local storage).
    await idbService.clearChatbotMessagesFromIdb();
}

// --- FEEDBACK ---
export async function submitFeedback(feedbackText: string): Promise<void> {
    const newFeedback: Feedback = {
        id: `feedback-${Date.now()}`,
        created_at: new Date().toISOString(),
        feedback_text: feedbackText,
    };

    await idbService.upsertFeedbackToIdb([newFeedback]);

    if (dbMode === 'supabase') {
        try {
            await supabaseService.saveFeedbackToSupabase(feedbackText);
        } catch (error) {
            console.error("Supabase failed to save feedback, but it's saved locally.", (error as Error).message);
            // Don't rethrow, as the user experience should be "success" since it's cached.
        }
    }
}

// --- AGENT FEEDBACK ---
export async function submitAgentFeedback(
    agentId: string,
    sessionId: string,
    transcript: LiveTranscript[],
    feedbackText: string
): Promise<void> {
    const newFeedback: AgentFeedback = {
        id: `agent-feedback-${sessionId}`,
        created_at: new Date().toISOString(),
        agent_id: agentId,
        session_id: sessionId,
        transcript,
        feedback_text: feedbackText,
    };

    await idbService.upsertAgentFeedbackToIdb([newFeedback]);

    if (dbMode === 'supabase') {
        try {
            await supabaseService.saveAgentFeedbackToSupabase(newFeedback);
        } catch (error) {
            console.error("Supabase failed to save agent feedback, but it's saved locally.", (error as Error).message);
            // Don't rethrow
        }
    }
}

// --- KNOWLEDGE BASE ---
export const getKnowledgeBase = (): string => {
    try {
        let knowledgeText = "\n\n--- KNOWLEDGE BASE ---\n";
        if (MOCK_KNOWLEDGE_BASE && Array.isArray(MOCK_KNOWLEDGE_BASE.articles)) {
            for (const article of MOCK_KNOWLEDGE_BASE.articles) {
                if (article.title && article.content) {
                    knowledgeText += `Title: ${article.title}\nContent: ${article.content}\n\n---\n\n`;
                }
            }
        } else {
            // Fallback for any other JSON structure
            knowledgeText += JSON.stringify(MOCK_KNOWLEDGE_BASE, null, 2);
        }
        knowledgeText += "--- END KNOWLEDGE BASE ---";
        return knowledgeText;
    } catch (error) {
        console.error("Failed to parse mock knowledge base:", error);
        return "KNOWLEDGE BASE: UNAVAILABLE (parsing failed).";
    }
};
