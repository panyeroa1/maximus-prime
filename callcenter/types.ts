export enum ActiveView {
  CallLogs = 'CallLogs',
  Agents = 'Agents',
  Crm = 'Crm', // New CRM View
  Voices = 'Voices',
  TTSStudio = 'TTSStudio',
  Chatbot = 'Chatbot',
  Templates = 'Templates',
  ActiveCall = 'ActiveCall',
  WebDemo = 'WebDemo',
}

export interface Template {
  id: string;
  name: string;
  description: string;
  useCases: string[];
  systemPrompt: string;
  firstSentence: string;
  recommendedVoice: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets: any[];
    };
  };
}

export interface TelemetryData {
  tokensUsed?: number;
  energy?: string;
  wps?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // for local preview
  imageUrl?: string; // for remote storage
  groundingChunks?: GroundingChunk[];
  telemetry?: TelemetryData;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  voice: string;
  systemPrompt: string;
  firstSentence: string;
  thinkingMode: boolean;
  avatarUrl: string | null;
  tools?: string[];
}

export interface Voice {
  id: string;
  name: string;
  provider: string;
  type: 'Prebuilt' | 'Cloned';
  tags: string[];
}

export interface TranscriptSegment {
  user: 'agent' | 'user';
  text: string;
  start_time: number;
}

export interface CallAnalysisResult {
  summary: string;
  overallSentiment: 'Positive' | 'Neutral' | 'Negative' | 'Mixed';
  topics: string[];
  sentimentTimeline: {
    user: 'agent' | 'user';
    text: string;
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    start_time?: number;
  }[];
}

export interface CallLog {
  call_id: string;
  created_at: string;
  duration: number;
  from: string;
  to: string;
  recording_url: string;
  concatenated_transcript: string;
  transcript: TranscriptSegment[];
  analysisResult?: CallAnalysisResult;
}

export interface TtsGeneration {
  id:string;
  created_at: string;
  input_text: string;
  audio_url: string;
}

export interface Feedback {
  id: string;
  created_at: string;
  feedback_text: string;
}

export interface LiveTranscript {
    id: number;
    role: 'user' | 'model';
    text: string;
    isFinal: boolean;
}

export interface AgentFeedback {
  id: string;
  created_at: string;
  agent_id: string;
  session_id: string;
  transcript: LiveTranscript[];
  feedback_text: string;
}

export interface Booking {
  id: string;
  passengerName: string;
  pnr: string;
  email: string;
  flightNumber: string;
  origin: string;
  destination: string;
  flightDate: string;
  status: 'Confirmed' | 'Cancelled' | 'Pending';
  notes?: string;
}