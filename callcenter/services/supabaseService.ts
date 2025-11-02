import { createClient } from '@supabase/supabase-js';
import { Agent, Voice, CallLog, TtsGeneration, ChatMessage, AgentFeedback, CallAnalysisResult } from '../types';
import { runtimeEnv } from './runtimeEnv';

export const supabase = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseKey);

// AGENTS
export const getAgentsFromSupabase = async (): Promise<Agent[]> => {
    const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    // Map snake_case from DB to camelCase in application
    return data.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description || '', // Fallback for missing column
        voice: agent.voice,
        systemPrompt: agent.system_prompt,
        firstSentence: agent.first_sentence || '',
        thinkingMode: agent.thinking_mode,
        avatarUrl: null, // The 'avatar_url' column does not exist in the schema.
        tools: agent.tools || [],
    }));
};

export const upsertAgentsToSupabase = async (agents: Agent[]): Promise<Agent[]> => {
    const newAgentPayloads: any[] = [];
    const existingAgents: Agent[] = [];

    for (const agent of agents) {
        if (agent.id.startsWith('new-agent-')) {
            const { id, systemPrompt, firstSentence, thinkingMode, avatarUrl, ...rest } = agent;
            newAgentPayloads.push({
                ...rest,
                system_prompt: systemPrompt,
                first_sentence: firstSentence,
                thinking_mode: thinkingMode,
            });
        } else {
            existingAgents.push(agent);
        }
    }
    
    let createdAgents: Agent[] = [];

    if (newAgentPayloads.length > 0) {
        const { data, error } = await supabase.from('agents').insert(newAgentPayloads).select();
        if (error) {
            console.error("Supabase failed to insert new agents:", error);
            throw error;
        }
        createdAgents = data.map(dbAgent => ({
            id: dbAgent.id,
            name: dbAgent.name,
            description: dbAgent.description || '',
            voice: dbAgent.voice,
            systemPrompt: dbAgent.system_prompt,
            firstSentence: dbAgent.first_sentence || '',
            thinkingMode: dbAgent.thinking_mode,
            avatarUrl: null,
            tools: dbAgent.tools || [],
        }));
    }

    if (existingAgents.length > 0) {
        const existingAgentsForSupabase = existingAgents.map(agent => {
            const { systemPrompt, firstSentence, thinkingMode, avatarUrl, ...rest } = agent;
            return {
                ...rest,
                system_prompt: systemPrompt,
                first_sentence: firstSentence,
                thinking_mode: thinkingMode,
            };
        });
        const { error } = await supabase.from('agents').upsert(existingAgentsForSupabase, { onConflict: 'id' });
        if (error) {
            console.error("Supabase failed to upsert existing agents:", error);
            throw error;
        }
    }

    return [...createdAgents, ...existingAgents];
};


export const updateAgentInSupabase = async (agent: Agent) => {
    // Map camelCase properties to snake_case for Supabase.
    const { id, systemPrompt, firstSentence, thinkingMode, avatarUrl, ...rest } = agent;
    const updatePayload = {
        ...rest, // includes name, description, voice, tools
        system_prompt: systemPrompt,
        first_sentence: firstSentence,
        thinking_mode: thinkingMode,
        // avatar_url is removed as the column does not exist.
    };
    
    const { error } = await supabase.from('agents').update(updatePayload).eq('id', agent.id);
    if (error) throw error;
};

export const deleteAgentFromSupabase = async (agentId: string) => {
    const { error } = await supabase.from('agents').delete().eq('id', agentId);
    if (error) throw error;
};

// VOICES
export const getVoicesFromSupabase = async (): Promise<Voice[]> => {
    const { data, error } = await supabase.from('voices').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    // The data from Supabase won't have a `tags` property. To conform to the `Voice` type, we add an empty array.
    return data.map(v => ({...v, tags: [] })) as Voice[];
};

export const upsertVoicesToSupabase = async (voices: Voice[]) => {
    // The 'voices' table in Supabase does not have a 'tags' column.
    // We must remove it from the payload before upserting.
    const voicesForSupabase = voices.map(({ tags, ...restOfVoice }) => restOfVoice);

    const { error } = await supabase.from('voices').upsert(voicesForSupabase, { onConflict: 'id' });
    if (error) {
        // Log the full error object for better debugging
        console.error("Supabase failed to upsert voices:", error);
        throw error;
    }
};

export const saveEmotionTagForVoice = async (voiceId: string, emotionTag: string): Promise<void> => {
    // Fetch existing tags first
    const { data: existingData, error: selectError } = await supabase
        .from('voices_tags_backup')
        .select('tags')
        .eq('id', voiceId)
        .single();

    // PGRST116 = 'single row not found', which is a normal case for the first tag.
    if (selectError && selectError.code !== 'PGRST116') {
        console.error("Supabase failed to select existing tags:", selectError);
        throw selectError;
    }

    const existingTags = existingData?.tags ? existingData.tags.split(', ') : [];
    if (!existingTags.includes(emotionTag)) {
        existingTags.push(emotionTag);
    }
    
    const newTags = existingTags.join(', ');

    const { error: upsertError } = await supabase
        .from('voices_tags_backup')
        .upsert({ id: voiceId, tags: newTags }, { onConflict: 'id' });

    if (upsertError) {
        console.error("Supabase failed to save emotion tag:", upsertError);
        throw upsertError;
    }
};

export const getCustomVoiceTags = async (): Promise<Map<string, string[]>> => {
    const { data, error } = await supabase.from('voices_tags_backup').select('id, tags');
    if (error) {
        // Let the caller handle the error. This provides more flexibility and better error reporting.
        throw error;
    }
    const tagMap = new Map<string, string[]>();
    data.forEach(item => {
        if (item.id && item.tags) {
            tagMap.set(item.id, item.tags.split(',').map(t => t.trim()).filter(Boolean));
        }
    });
    return tagMap;
};

export const updateCustomVoiceTags = async (voiceId: string, tags: string[]): Promise<void> => {
    const tagsString = tags.join(', ');
    const { error } = await supabase.from('voices_tags_backup').upsert({ id: voiceId, tags: tagsString }, { onConflict: 'id' });
    if (error) {
        console.error("Supabase failed to update custom voice tags:", error);
        throw error;
    }
};


// CALL LOGS
export const getCallLogsFromSupabase = async (): Promise<CallLog[]> => {
    const { data, error } = await supabase.from('call_logs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(log => ({
        ...log,
        analysisResult: log.analysis_result,
    }));
}

export const upsertCallLogsToSupabase = async (logs: CallLog[]) => {
    const sanitizedLogs = logs.map(log => ({
        call_id: log.call_id,
        created_at: log.created_at,
        duration: log.duration,
        from: log.from,
        to: log.to,
        recording_url: log.recording_url,
        concatenated_transcript: log.concatenated_transcript,
        transcript: log.transcript,
        analysis_result: log.analysisResult,
    }));
    const { error } = await supabase.from('call_logs').upsert(sanitizedLogs, { onConflict: 'call_id' });
    if (error) throw error;
}

export const updateCallAnalysisInSupabase = async (callId: string, analysisResult: CallAnalysisResult): Promise<void> => {
    const { error } = await supabase
        .from('call_logs')
        .update({ analysis_result: analysisResult })
        .eq('call_id', callId);
    if (error) {
        console.error("Supabase failed to update call analysis:", error);
        throw error;
    }
};

// === AUDIO STORAGE ===
const AUDIO_BUCKET = 'eburon-audio';

// Helper to determine file extension from MIME type
const getExtensionFromMimeType = (mimeType: string) => {
    if (!mimeType) return 'wav'; // Default extension
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('ogg')) return 'ogg';
    return mimeType.split('/')[1] || 'audio';
};


export const uploadAgentAvatar = async (
  agentId: string,
  imageFile: File
): Promise<string> => {
  const fileExtension = imageFile.name.split('.').pop() || 'png';
  const fileName = `public/agent-avatars/${agentId}/avatar.${fileExtension}`;

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, imageFile, {
      cacheControl: '3600',
      upsert: true, // Replace if exists
    });

  if (error) throw new Error(`Avatar upload failed: ${error.message}`);

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
  return `${data.publicUrl}?t=${new Date().getTime()}`; // Add timestamp to break cache
};


export const uploadAudioSample = async (
  voiceName: string,
  audioBlob: Blob
): Promise<string> => {
  const extension = getExtensionFromMimeType(audioBlob.type);
  const fileName = `public/voice-previews/${voiceName.toLowerCase().replace(/ /g, '_')}_${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, audioBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

// === TTS STUDIO ===
const TTS_AUDIO_BUCKET_PATH = 'tts-generations';

export const uploadTtsAudio = async (
  audioBlob: Blob
): Promise<string> => {
  const extension = getExtensionFromMimeType(audioBlob.type);
  const fileName = `public/${TTS_AUDIO_BUCKET_PATH}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, audioBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`TTS audio upload failed: ${error.message}`);

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

export const saveTtsGeneration = async (generation: {
    input_text: string,
    audio_url: string,
}): Promise<TtsGeneration> => {
    const { data, error } = await supabase.from('tts_generations').insert([generation]).select();
    if (error) throw error;
    return data[0];
};

export const getTtsGenerations = async (): Promise<TtsGeneration[]> => {
    const { data, error } = await supabase.from('tts_generations').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data;
}

// === CHATBOT ===
const CHAT_IMAGES_BUCKET_PATH = 'chat-images';

export const uploadChatImage = async (imageFile: File): Promise<string> => {
    const fileExtension = imageFile.name.split('.').pop() || 'png';
    const fileName = `public/${CHAT_IMAGES_BUCKET_PATH}/${Date.now()}.${fileExtension}`;
    
    const { error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) throw new Error(`Chat image upload failed: ${error.message}`);
    
    const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
};

export const getChatbotMessagesFromSupabase = async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase.from('chatbot_messages').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(msg => ({
        id: msg.id,
        role: msg.role,
        text: msg.text,
        imageUrl: msg.image_url,
    }));
};

export const upsertChatbotMessageToSupabase = async (message: ChatMessage) => {
    const { error } = await supabase.from('chatbot_messages').upsert({
        id: message.id,
        role: message.role,
        text: message.text,
        image_url: message.imageUrl,
    });
    if (error) throw error;
};

export const clearChatbotMessagesFromSupabase = async (): Promise<void> => {
    // Using `neq` with a value that doesn't exist (`system`) effectively targets all rows.
    // This is more efficient and robust than deleting by 'user' and 'model' roles separately.
    const { error } = await supabase.from('chatbot_messages').delete().neq('role', 'system');
    if (error) throw error;
};

// === FEEDBACK ===
export const saveFeedbackToSupabase = async (feedbackText: string): Promise<void> => {
    const { error } = await supabase.from('feedback').insert([{ feedback_text: feedbackText }]);
    if (error) throw error;
};

// === AGENT FEEDBACK ===
export const saveAgentFeedbackToSupabase = async (feedback: Omit<AgentFeedback, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('agent_feedback').insert([
        {
            agent_id: feedback.agent_id,
            session_id: feedback.session_id,
            transcript: feedback.transcript, // assuming 'transcript' column is of type jsonb
            feedback_text: feedback.feedback_text,
        }
    ]);
    if (error) throw error;
};
