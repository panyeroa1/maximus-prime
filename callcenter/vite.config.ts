import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
    const supabaseKey = env.VITE_SUPABASE_KEY || env.SUPABASE_KEY || '';
    const blandApiKey = env.VITE_BLAND_API_KEY || env.BLAND_API_KEY || '';
    const blandEncryptedKey = env.VITE_BLAND_ENCRYPTED_KEY || env.BLAND_ENCRYPTED_KEY || '';
    const ollamaApiKey = env.VITE_OLLAMA_API_KEY || env.OLLAMA_API_KEY || '';
    const ollamaApiUrl = env.VITE_OLLAMA_API_URL || env.OLLAMA_API_URL || 'https://ollama.com/api';
    const ollamaModel = env.VITE_OLLAMA_MODEL || env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';
    const ollamaTranscribeModel = env.VITE_OLLAMA_TRANSCRIBE_MODEL || env.OLLAMA_TRANSCRIBE_MODEL || 'whisper-large-v3';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(supabaseKey),
        'import.meta.env.VITE_BLAND_API_KEY': JSON.stringify(blandApiKey),
        'import.meta.env.VITE_BLAND_ENCRYPTED_KEY': JSON.stringify(blandEncryptedKey),
        'import.meta.env.VITE_OLLAMA_API_KEY': JSON.stringify(ollamaApiKey),
        'import.meta.env.VITE_OLLAMA_API_URL': JSON.stringify(ollamaApiUrl),
        'import.meta.env.VITE_OLLAMA_MODEL': JSON.stringify(ollamaModel),
        'import.meta.env.VITE_OLLAMA_TRANSCRIBE_MODEL': JSON.stringify(ollamaTranscribeModel),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
