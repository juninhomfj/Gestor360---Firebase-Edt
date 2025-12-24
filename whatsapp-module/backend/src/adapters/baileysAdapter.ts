import makeWASocket, { fetchLatestBaileysVersion, useSingleFileAuthState } from "@adiwajshing/baileys";
import { uploadAuthBlob } from "../sessions/storageManager";
import path from "path";
import fs from "fs";

const SESSIONS_TMP = '/tmp/wa_sessions';
if (!fs.existsSync(SESSIONS_TMP)) fs.mkdirSync(SESSIONS_TMP, { recursive: true });

const sessions: Map<string, any> = new Map();

export const initSession = async (sessionId: string) => {
  const tmpFile = path.join(SESSIONS_TMP, `${sessionId}.json`);
  const { state, saveState } = useSingleFileAuthState(tmpFile);

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', async () => {
    saveState();
    try {
      const buf = fs.readFileSync(tmpFile);
      await uploadAuthBlob(sessionId, buf);
    } catch (e) {
      console.error('[baileysAdapter] failed upload auth blob', maskError(e));
    }
  });

  sock.ev.on('connection.update', (update: any) => {
    sessions.set(sessionId, { sock, update, connected: update.connection === 'open' });
  });

  sessions.set(sessionId, { sock, saveState });
  return { sessionId, status: 'STARTED' };
};

export const sendMessage = async (sessionId: string, to: string, body: string, mediaUrl?: string) => {
  const s = sessions.get(sessionId);
  if (!s || !s.sock) throw new Error('Session not found or not connected');
  const sock = s.sock;
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  const res = await sock.sendMessage(jid, { text: body });
  return res;
};

export const closeSession = async (sessionId: string) => {
  const s = sessions.get(sessionId);
  if (!s || !s.sock) return;
  try {
    await s.sock.logout();
  } catch (e) {
    // swallow
  }
  sessions.delete(sessionId);
};

const maskError = (e: any) => {
  try {
    if (typeof e === 'string') return e;
    const copy = { ...e };
    if (copy?.message) copy.message = copy.message.replace(/\d{6,}/g, '*****');
    return copy;
  } catch {
    return 'error';
  }
};