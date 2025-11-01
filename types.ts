import { FunctionDeclaration } from '@google/genai';

export interface ConversationTurn {
  speaker: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export interface ServerSettings {
  twilioSid: string;
  twilioAuthToken: string;
  blandApiKey: string;
  cartesiaApiKey: string;
  elevenLabsApiKey: string;
  ollamaCloudEndpoint: string;
  ollamaCloudApiKey: string;
}

export interface AppSettings {
  role: string;
  instructions: string;
  voice: string;
  enabledTools: string[];
  serverSettings: ServerSettings;
}

export interface Tool {
  name: string;
  description: string;
  functionDeclaration: FunctionDeclaration;
}

export interface ActiveToolCall {
  name: string;
  args: any;
}
