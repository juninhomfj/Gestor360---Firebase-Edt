
import makeWASocket, { fetchLatestBaileysVersion, useSingleFileAuthState, DisconnectReason } from "@adiwajshing/baileys";
import { uploadAuthBlob } from "../sessions/storageManager.js";
import { createSessionDoc } from "../firestoreStore.js";
import path from "path";
import fs from "fs";

const SESSIONS_TMP = '/tmp/wa_sessions';
if (!fs.existsSync(SESSIONS_TMP)) fs.mkdirSync(SESSIONS_TMP, { recursive: true });

const sessions: Map<string, any> = new Map();

export const initSession = async (sessionId: string) => {
  if (sessions.has(sessionId)) {
    return { sessionId, status: 'ALREADY_EXISTS' };
  }

  const tmpFile = path.join(SESSIONS_TMP, `${sessionId}.json`);
  const { state, saveState } = useSingleFileAuthState(tmpFile);

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false
  });

  let currentQr: string | null = null;

  sock.ev.on('creds.update', async () => {
    saveState();
    try {
      const buf = fs.readFileSync(tmpFile);
      await uploadAuthBlob(sessionId, buf);
    } catch (e: any) {
      console.error('[Baileys] Erro ao subir auth blob:', e.message);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      currentQr = qr;
      await createSessionDoc(sessionId, { status: 'PAIRING', qr });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('[Baileys] Conexão fechada. Reconectar:', shouldReconnect);
      
      if (shouldReconnect) {
        sessions.delete(sessionId);
        initSession(sessionId);
      } else {
        await createSessionDoc(sessionId, { status: 'DISCONNECTED' });
        sessions.delete(sessionId);
      }
    } else if (connection === 'open') {
      console.log('[Baileys] Conexão aberta com sucesso.');
      await createSessionDoc(sessionId, { status: 'CONNECTED', phone: sock.user?.id });
    }
  });

  sessions.set(sessionId, { sock, saveState });
  
  // Retorna uma promessa curta para dar tempo de gerar o QR inicial se necessário
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ sessionId, status: 'STARTED', qr: currentQr });
    }, 1500);
  });
};

export const sendMessage = async (sessionId: string, to: string, body: string, mediaUrl?: string) => {
  const s = sessions.get(sessionId);
  if (!s || !s.sock) throw new Error('Sessão não encontrada ou desconectada');
  
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  
  if (mediaUrl) {
    // Exemplo simplificado de envio de imagem
    return await s.sock.sendMessage(jid, { image: { url: mediaUrl }, caption: body });
  }
  
  return await s.sock.sendMessage(jid, { text: body });
};

export const closeSession = async (sessionId: string) => {
  const s = sessions.get(sessionId);
  if (!s || !s.sock) return;
  try {
    await s.sock.logout();
  } catch (e) {}
  sessions.delete(sessionId);
};

const maskError = (e: any) => {
  try {
    const m = e.message || JSON.stringify(e);
    return m.replace(/\d{6,}/g, '*****');
  } catch { return 'error'; }
};
