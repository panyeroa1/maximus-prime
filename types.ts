// FIX: Added missing type definitions.
import { FunctionDeclaration } from '@google/genai';

export type Speaker = 'user' | 'model' | 'system';

export interface ConversationTurn {
  speaker: Speaker;
  text: string;
  timestamp: number;
}

export interface Tool {
  name: string;
  description: string;
  configurable?: boolean;
  functionDeclaration?: FunctionDeclaration;
}

export type CallerLanguage = 'Default' | 'English (Indian)' | 'English (Turkish Native)';

export interface AppSettings {
  voice: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
  enabledTools: string[];
  systemInstruction: string;
  language: CallerLanguage;
  toolSettings: {
    generateImage?: {
      aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    };
  };
}

export type MediaAction = 'analyzeImage' | 'editImage' | 'generateVideo' | 'transcribeAudio' | 'recordMedia' | 'recordScreen' | 'analyzeTradingData';

export type WorkspaceMode = 'idle' | 'action_select' | 'upload' | 'recording' | 'screen_sharing_setup' | 'processing' | 'result' | 'api_key_needed';

// FIX: Added missing UploadAction type that was referenced in Workspace.tsx.
export type UploadAction = 'analyzeImage' | 'editImage' | 'generateVideo' | 'transcribeAudio' | 'analyzeTradingData';


export type WorkspaceContent = {
  type: 'image' | 'video' | 'text' | 'code' | 'grounding_search' | 'grounding_maps';
  data: any; // string for image/video url, object for others
  prompt?: string;
  sources?: { uri: string; title: string }[];
};

export interface ToolOutput {
  id: string;
  toolName: string;
  content: WorkspaceContent;
}

export interface WorkspaceState {
  mode: WorkspaceMode;
  uploadAction?: UploadAction;
  message?: string;
  primaryContent?: WorkspaceContent;
  uploadedFile?: {
    file: File;
    base64: string;
    mimeType: string;
  };
  toolOutputs: ToolOutput[];
}

export interface ActiveToolCall {
  id: string;
  name: string;
  args: any;
}