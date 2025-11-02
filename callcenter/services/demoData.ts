import type { Agent, Voice, CallLog, TranscriptSegment, CallAnalysisResult } from '../types';
import rawCalls from '../list-calls.json';
import rawVoices from '../voices.json';
import rawAgents from '../web-demo-agent.json';
import rawPersonas from '../personas.json';

type RawCallEntry = typeof rawCalls extends { calls: infer C } ? (C extends Array<infer R> ? R : never) : never;
type RawVoiceEntry = typeof rawVoices extends { voices: infer V } ? V extends Array<infer R> ? R : never : never;
type RawWebAgentEntry = typeof rawAgents extends { agents: infer A } ? A extends Array<infer R> ? R : never : never;
type RawPersonaEntry = typeof rawPersonas extends { data: infer D } ? D extends Array<infer R> ? R : never : never;

const sanitizeText = (text?: string | null) => {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').trim();
};

const inferSentiment = (value?: string | null): CallAnalysisResult['overallSentiment'] => {
  if (!value) return 'Neutral';
  const lowered = value.toLowerCase();
  if (lowered.includes('positive')) return 'Positive';
  if (lowered.includes('negative') || lowered.includes('angry') || lowered.includes('frustrated')) return 'Negative';
  if (lowered.includes('mixed')) return 'Mixed';
  return 'Neutral';
};

const buildTranscriptFromSummary = (summary: string): TranscriptSegment[] => {
  if (!summary) return [];
  const sections = summary
    .split(/\n{2,}/)
    .map(section => sanitizeText(section).replace(/^\d+\.\s*/, ''))
    .filter(Boolean);

  if (sections.length === 0) {
    return [{
      user: 'agent',
      text: summary,
      start_time: 0,
    }];
  }

  return sections.map((text, index) => ({
    user: index % 2 === 0 ? 'agent' : 'user',
    text,
    start_time: index * 15,
  }));
};

const extractTopics = (summary: string): string[] => {
  const matches = summary.match(/\*\*(.+?)\*\*/g);
  if (!matches) return [];
  return matches
    .map(topic => topic.replace(/\*\*/g, '').trim())
    .filter(Boolean);
};

const mapCallLog = (entry: RawCallEntry): CallLog => {
  const callId = entry.call_id || entry.c_id || `call-${entry.started_at ?? Date.now()}`;
  const summary = sanitizeText(entry.summary) || sanitizeText(entry.variables?.summary);
  const transcript = buildTranscriptFromSummary(summary);
  const sentiment = inferSentiment(entry.analysis?.sentiment);
  const topics = extractTopics(summary);

  const analysisResult: CallAnalysisResult | undefined = summary
    ? {
        summary,
        overallSentiment: sentiment,
        topics,
        sentimentTimeline: transcript.map(segment => ({
          user: segment.user,
          text: segment.text,
          sentiment,
          start_time: segment.start_time,
        })),
      }
    : undefined;

  return {
    call_id: callId,
    created_at: entry.created_at ?? entry.started_at ?? new Date().toISOString(),
    duration: Math.max(0, Math.round(Number(entry.call_length ?? entry.duration ?? 0))),
    from: entry.from ?? entry.variables?.from ?? 'Unknown',
    to: entry.to ?? entry.variables?.to ?? 'Unknown',
    recording_url: entry.recording_url ?? '',
    concatenated_transcript: summary || 'Transcript unavailable.',
    transcript,
    analysisResult,
  };
};

const mapVoice = (entry: RawVoiceEntry): Voice => {
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const type: Voice['type'] = tags.map(tag => tag.toLowerCase()).includes('cloned') ? 'Cloned' : 'Prebuilt';
  return {
    id: entry.id ?? entry.voice_id ?? entry.name,
    name: entry.name ?? entry.id ?? 'Unknown Voice',
    provider: entry.provider ?? 'Bland AI',
    type,
    tags,
  };
};

const pickVoiceId = (voiceName: string | null | undefined, voices: Voice[]): string => {
  if (!voiceName) {
    return voices[0]?.id ?? '';
  }
  const matchByName = voices.find(v => v.name.toLowerCase() === voiceName.toLowerCase());
  if (matchByName) return matchByName.id;
  const matchByTag = voices.find(v => v.tags.map(tag => tag.toLowerCase()).includes(voiceName.toLowerCase()));
  if (matchByTag) return matchByTag.id;
  return voices[0]?.id ?? '';
};

const mapWebAgent = (entry: RawWebAgentEntry, voices: Voice[]): Agent => ({
  id: entry.agent_id ?? entry.id ?? `web-demo-agent-${Date.now()}`,
  name: sanitizeText(entry.metadata?.name) || entry.agent_id || 'Web Demo Agent',
  description: sanitizeText(entry.metadata?.description) || 'Imported web demo agent.',
  voice: pickVoiceId(entry.voice, voices),
  systemPrompt: sanitizeText(entry.prompt) || 'You are a helpful assistant.',
  firstSentence: sanitizeText(entry.first_sentence) || 'Hello, how can I assist you today?',
  thinkingMode: Boolean(entry.tools && entry.tools.length),
  avatarUrl: null,
  tools: Array.isArray(entry.tools) ? entry.tools : [],
});

const mapPersonaAsAgent = (entry: RawPersonaEntry, voices: Voice[]): Agent | null => {
  if (!entry) return null;
  const personaVersion = entry.current_production_version ?? entry.current_draft_version;
  const systemPrompt = sanitizeText(personaVersion?.personality_prompt) || sanitizeText(personaVersion?.prompt);
  const voiceId = pickVoiceId(personaVersion?.call_config?.voice, voices);

  return {
    id: entry.id ?? `persona-${Date.now()}`,
    name: sanitizeText(entry.name) || 'Persona Agent',
    description: sanitizeText(entry.description) || 'Imported persona configuration.',
    voice: voiceId,
    systemPrompt: systemPrompt || 'You are a helpful assistant.',
    firstSentence: 'Hello, how can I help you today?',
    thinkingMode: false,
    avatarUrl: entry.image_url ?? null,
    tools: [],
  };
};

const DEMO_VOICES: Voice[] = (rawVoices.voices ?? []).map(mapVoice);
const DEMO_CALL_LOGS: CallLog[] = (rawCalls.calls ?? []).map(mapCallLog);

const webAgents: Agent[] = (rawAgents.agents ?? []).map(agent => mapWebAgent(agent, DEMO_VOICES));
const personaAgents: Agent[] = (rawPersonas.data ?? [])
  .map(persona => mapPersonaAsAgent(persona, DEMO_VOICES))
  .filter((agent): agent is Agent => Boolean(agent));

const seenAgentIds = new Set<string>();
const DEMO_AGENTS: Agent[] = [...webAgents, ...personaAgents].filter(agent => {
  if (seenAgentIds.has(agent.id)) return false;
  seenAgentIds.add(agent.id);
  return true;
});

export const demoData = {
  agents: DEMO_AGENTS,
  voices: DEMO_VOICES,
  callLogs: DEMO_CALL_LOGS,
};
