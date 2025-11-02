const readEnv = (primary: string, fallback?: string, defaultsTo?: string) => {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[primary] ?? (fallback ? env[fallback] : undefined) ?? defaultsTo;
  return value ?? '';
};

const ensure = (primary: string, fallback?: string) => {
  const value = readEnv(primary, fallback);
  if (!value) {
    throw new Error(`Required environment variable ${primary}${fallback ? ` (or ${fallback})` : ''} is not set.`);
  }
  return value;
};

export const runtimeEnv = {
  supabaseUrl: ensure('VITE_SUPABASE_URL', 'SUPABASE_URL'),
  supabaseKey: ensure('VITE_SUPABASE_KEY', 'SUPABASE_KEY'),
  blandApiKey: ensure('VITE_BLAND_API_KEY', 'BLAND_API_KEY'),
  blandEncryptedKey: ensure('VITE_BLAND_ENCRYPTED_KEY', 'BLAND_ENCRYPTED_KEY'),
  ollama: {
    apiKey: readEnv('VITE_OLLAMA_API_KEY', 'OLLAMA_API_KEY'),
    apiUrl: readEnv('VITE_OLLAMA_API_URL', 'OLLAMA_API_URL', 'https://ollama.com/api'),
    model: readEnv('VITE_OLLAMA_MODEL', 'OLLAMA_MODEL', 'gpt-oss:120b-cloud'),
    transcriptionModel: readEnv('VITE_OLLAMA_TRANSCRIBE_MODEL', 'OLLAMA_TRANSCRIBE_MODEL', 'whisper-large-v3'),
  },
};
