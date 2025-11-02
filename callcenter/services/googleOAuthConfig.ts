interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  authUri: string;
  tokenUri: string;
  refreshToken: string;
  sender: string;
}

let devSecret: { client_id: string; client_secret: string } | null = null;

if (import.meta.env.DEV) {
  try {
    const module = await import('../client_secret_125766648687-vaokj8ugus4rp4dutkd3m9tli8q0jm9a.apps.googleusercontent.com.json');
    const secret = (module as { default?: any }).default ?? module;
    devSecret = secret?.web ?? null;
  } catch (error) {
    console.warn('Google OAuth client secret JSON not found; relying on environment variables.', error);
  }
}

export const GOOGLE_OAUTH_CONFIG: GoogleOAuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? devSecret?.client_id ?? '',
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? devSecret?.client_secret ?? '',
  authUri: import.meta.env.VITE_GOOGLE_AUTH_URI ?? 'https://accounts.google.com/o/oauth2/auth',
  tokenUri: import.meta.env.VITE_GOOGLE_TOKEN_URI ?? 'https://oauth2.googleapis.com/token',
  refreshToken: import.meta.env.VITE_GOOGLE_REFRESH_TOKEN ?? '',
  sender: import.meta.env.VITE_GOOGLE_SENDER_EMAIL ?? '',
};

export const assertGoogleConfigReady = () => {
  if (!GOOGLE_OAUTH_CONFIG.clientId || !GOOGLE_OAUTH_CONFIG.clientSecret) {
    throw new Error('Google OAuth client configuration is missing. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET.');
  }
  if (!GOOGLE_OAUTH_CONFIG.refreshToken) {
    throw new Error('Google OAuth refresh token is missing. Set VITE_GOOGLE_REFRESH_TOKEN.');
  }
  if (!GOOGLE_OAUTH_CONFIG.sender) {
    throw new Error('Sender email address is missing. Set VITE_GOOGLE_SENDER_EMAIL.');
  }
};
