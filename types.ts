import { FunctionDeclaration } from '@google/genai';

export interface ConversationTurn {
  speaker: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export interface ServerSettings {
  googleCloudProjectId: string;
  googleCloudServiceAccountJson: string;
  twilioSid: string;
  twilioAuthToken: string;
  blandApiKey: string;
  cartesiaApiKey: string;
  elevenLabsApiKey: string;
  ollamaCloudEndpoint: string;
  ollamaCloudApiKey: string;
}

export interface AppSettings {
  systemInstruction: string;
  voice: string;
  enabledTools: string[];
  serverSettings: ServerSettings;
}

export interface Tool {
  name: string;
  description: string;
  functionDeclaration?: FunctionDeclaration;
}

export interface ActiveToolCall {
  name: string;
  args: any;
}

// Workspace State Types
export type WorkspaceMode = 'idle' | 'action_select' | 'upload' | 'processing' | 'result' | 'api_key_needed' | 'recording' | 'screen_sharing_setup';

export type UploadAction = 'analyzeImage' | 'editImage' | 'generateVideo' | 'transcribeAudio';
export type MediaAction = UploadAction | 'recordMedia' | 'recordScreen';


export interface GroundingSource {
  uri: string;
  title: string;
}

export interface WorkspaceContent {
  type: 'image' | 'video' | 'text' | 'grounding_search' | 'grounding_maps' | 'code';
  data: any; // URL for image/video, text string, GroundingSource[], or { text: string; language: string } for code
  prompt?: string; // Original prompt that generated the content
}

export interface WorkspaceState {
  mode: WorkspaceMode;
  content: WorkspaceContent | null;
  message: string;
  uploadAction?: UploadAction;
}