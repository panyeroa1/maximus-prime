import { GOOGLE_OAUTH_CONFIG, assertGoogleConfigReady } from './googleOAuthConfig';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

const encodeBase64Url = (value: string): string => {
  const base64 = btoa(unescape(encodeURIComponent(value)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const buildMimeMessage = ({ to, subject, body }: SendEmailPayload, from: string): string => {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
  ];
  return [...headers, body].join('\r\n');
};

const fetchAccessToken = async (): Promise<string> => {
  const { clientId, clientSecret, refreshToken, tokenUri } = GOOGLE_OAUTH_CONFIG;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to refresh Google access token: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Google token response did not include access_token.');
  }
  return data.access_token as string;
};

export const sendEmailViaGmail = async (payload: SendEmailPayload) => {
  assertGoogleConfigReady();
  const sender = GOOGLE_OAUTH_CONFIG.sender;
  const rawMime = buildMimeMessage(payload, sender);
  const encodedRaw = encodeBase64Url(rawMime);

  const accessToken = await fetchAccessToken();

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ raw: encodedRaw }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to send email via Gmail API: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
};
