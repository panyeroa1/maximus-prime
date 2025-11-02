import { runtimeEnv } from './runtimeEnv';
import type { ChatMessage, TranscriptSegment, CallAnalysisResult } from '../types';

type OllamaRole = 'system' | 'user' | 'assistant';

const baseUrl = runtimeEnv.ollama.apiUrl.replace(/\/$/, '');

const buildAuthHeaders = (): HeadersInit => {
  if (!runtimeEnv.ollama.apiKey) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${runtimeEnv.ollama.apiKey}`,
  };
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama request failed (${response.status} ${response.statusText}): ${text}`);
  }
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const normaliseJson = (text: string): any => {
  const trimmed = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(trimmed);
};

const mapChatHistory = (history: ChatMessage[]): { role: OllamaRole; content: string }[] =>
  history
    .filter(message => message.text && message.text.trim().length > 0)
    .map(message => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: message.text,
    }));

export interface OllamaChatResult {
  text: string;
  tokensUsed?: number;
}

export const chatWithOllama = async (
  history: ChatMessage[],
  latestUserInput: string,
  systemPrompt: string
): Promise<OllamaChatResult> => {
  const messages = mapChatHistory(history);
  const payload = {
    model: runtimeEnv.ollama.model,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: latestUserInput },
    ],
  };

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  const text: string =
    data?.message?.content ??
    data?.message?.text ??
    data?.response ??
    data?.choices?.[0]?.message?.content ??
    '';

  const tokensUsed: number | undefined =
    data?.metrics?.token_count ??
    data?.usage?.total_tokens;

  return { text: text ?? '', tokensUsed };
};

export const transcribeAudioWithOllama = async (audioFile: File): Promise<string> => {
  const formData = new FormData();
  formData.append('model', runtimeEnv.ollama.transcriptionModel);
  formData.append('response_format', 'text');
  formData.append('file', audioFile, audioFile.name || 'audio.webm');

  const headers: HeadersInit = runtimeEnv.ollama.apiKey
    ? { Authorization: `Bearer ${runtimeEnv.ollama.apiKey}` }
    : {};

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await handleResponse(response);
  if (typeof data === 'string') {
    return data;
  }
  return data.text ?? data.transcription ?? data.result ?? '';
};

export const transcribeAudioWithDiarization = async (audioFile: File): Promise<TranscriptSegment[]> => {
  const baseTranscript = await transcribeAudioWithOllama(audioFile);

  const prompt = `
You are a call centre transcription assistant. 
Given the raw transcript of a two-person conversation (agent and user), restructure it into JSON.
Output a JSON array. Each element must include:
  - "user": either "agent" or "user"
  - "text": the spoken words for that turn (string)
Ensure you preserve the order of utterances.
Return ONLY valid JSON. No prose before or after.

Transcript:
${baseTranscript}
`;

  const messages = [
    { role: 'system' as OllamaRole, content: 'You produce clean JSON outputs for call transcripts.' },
    { role: 'user' as OllamaRole, content: prompt },
  ];

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({ model: runtimeEnv.ollama.model, stream: false, messages }),
  });

  const data = await handleResponse(response);
  const textResponse: string =
    data?.message?.content ??
    data?.response ??
    '';

  try {
    const parsed = normaliseJson(textResponse);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected an array of transcript segments.');
    }
    return parsed as TranscriptSegment[];
  } catch (error) {
    console.error('Failed to parse diarized transcript from Ollama:', error);
    throw new Error('Ollama returned an invalid diarized transcript.');
  }
};

export const analyzeCallTranscript = async (transcript: TranscriptSegment[]): Promise<CallAnalysisResult> => {
  const transcriptText = transcript.map(segment => `${segment.user}: ${segment.text}`).join('\n');

  const prompt = `
You analyse customer support call transcripts.
Return a JSON object with keys: summary (string), overallSentiment (Positive|Neutral|Negative|Mixed),
topics (array of strings), sentimentTimeline (array matching each segment with fields user, text, sentiment).
Sentiment values must be Positive, Neutral, or Negative. Include every segment exactly once.
Transcript:
${transcriptText}
`;

  const messages = [
    { role: 'system' as OllamaRole, content: 'You are a structured analytics engine for call centre conversations.' },
    { role: 'user' as OllamaRole, content: prompt },
  ];

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({ model: runtimeEnv.ollama.model, stream: false, messages }),
  });

  const data = await handleResponse(response);
  const textResponse: string =
    data?.message?.content ??
    data?.response ??
    '';

  try {
    return normaliseJson(textResponse) as CallAnalysisResult;
  } catch (error) {
    console.error('Call analysis parse error:', error);
    throw new Error('Ollama returned an invalid call analysis payload.');
  }
};
