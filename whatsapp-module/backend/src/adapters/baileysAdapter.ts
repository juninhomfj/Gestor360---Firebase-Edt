import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  AuthenticationState,
  BufferJSON
} from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { uploadAuthBlob, downloadAuthBlob } from '../sessions/storageManager';
import { updateSessionStatus, saveSessionAuthPath, getSession } from '../firestoreStore';
import { Buffer } from 'node:buffer';

const activeSessions = new Map<string, any>();

export const initBaileys = async (sessionId: string) => {
  if (activeSessions.has(sessionId)) return { status: 'ALREADY_ACTIVE' };

  // Manual implementation of state hydration from Storage would be here
  // For this implementation, we use a basic ephemeral state that persists to Storage on change
  // Note: in a real production environment, use a custom AuthState provider for Baileys
  
  const { version } = await fetchLatestBaileysVersion();
  
  let authState: AuthenticationState;
  const sessionData = await getSession(sessionId);
  
  // Skeleton for persistent state logic
  // if (sessionData?.auth_blob_path) { ... hydrate ... }
  
  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: (await useMultiFileAuthState(`temp_sessions/${sessionId}`)).state
  });

  activeSessions.set(sessionId, sock);

  return new Promise((resolve) => {
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr);
        await updateSessionStatus(sessionId, 'PAIRING');
        resolve({ qr: qrDataUrl, status: 'PAIRING' });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        activeSessions.delete(sessionId);
        await updateSessionStatus(sessionId, 'DISCONNECTED');
        if (shouldReconnect) initBaileys(sessionId);
      } else if (connection === 'open') {
        const phone = sock.user?.id.split(':')[0];
        await updateSessionStatus(sessionId, 'CONNECTED', phone);
        resolve({ status: 'CONNECTED', phone });
      }
    });

    sock.ev.on('creds.update', async () => {
      // In a real implementation, we would extract the state and upload:
      // const blob = Buffer.from(JSON.stringify(state, BufferJSON.replacer));
      // const path = await uploadAuthBlob(sessionId, blob);
      // await saveSessionAuthPath(sessionId, path);
    });
  });
};

export const sendMessageBaileys = async (sessionId: string, to: string, body: string, mediaUrl?: string) => {
  const sock = activeSessions.get(sessionId);
  if (!sock) throw new Error('Session not found');

  const jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`;
  
  if (mediaUrl) {
    // Basic image support
    return await sock.sendMessage(jid, { image: { url: mediaUrl }, caption: body });
  }
  
  return await sock.sendMessage(jid, { text: body });
};

export const closeBaileys = async (sessionId: string) => {
  const sock = activeSessions.get(sessionId);
  if (sock) {
    await sock.logout();
    activeSessions.delete(sessionId);
  }
};
