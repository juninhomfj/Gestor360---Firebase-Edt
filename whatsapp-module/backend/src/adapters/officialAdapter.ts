import fetch from 'node-fetch';

const PROVIDER_URL = process.env.WABA_PROVIDER_URL;
const PROVIDER_KEY = process.env.WABA_API_KEY;

export const initSession = async (sessionId: string) => {
  if (!PROVIDER_URL || !PROVIDER_KEY) {
    return { sessionId, status: 'READ_ONLY', message: 'Official provider not configured' };
  }
  return { sessionId, status: 'READY' };
};

export const sendMessage = async (sessionId: string, to: string, body: string, mediaUrl?: string) => {
  if (!PROVIDER_URL || !PROVIDER_KEY) throw new Error('Provider not configured');
  const res = await fetch(`${PROVIDER_URL}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PROVIDER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, to, body, mediaUrl })
  });
  if (!res.ok) throw new Error(`Provider error: ${res.status}`);
  return await res.json();
};

export const closeSession = async (sessionId: string) => {
  // provider-specific close
};