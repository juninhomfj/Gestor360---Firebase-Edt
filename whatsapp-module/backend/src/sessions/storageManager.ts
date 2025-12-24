import crypto from 'node:crypto';
import { storage } from '../firebaseAdmin';
import { Buffer } from 'node:buffer';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const getEncryptionKey = () => {
  const keyBase64 = process.env.SESSIONS_ENC_KEY;
  if (!keyBase64) throw new Error('SESSIONS_ENC_KEY is required');
  return Buffer.from(keyBase64, 'base64');
};

export const encryptAuthState = (plain: Buffer): Buffer => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Storage format: IV (12) + TAG (16) + EncryptedData
  return Buffer.concat([iv, tag, encrypted]);
};

export const decryptAuthState = (cipherText: Buffer): Buffer => {
  const key = getEncryptionKey();
  
  const iv = cipherText.slice(0, IV_LENGTH);
  const tag = cipherText.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = cipherText.slice(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

export const uploadAuthBlob = async (sessionId: string, buffer: Buffer): Promise<string> => {
  const bucket = storage.bucket();
  const path = `wa_sessions/${sessionId}/auth_state.enc`;
  const file = bucket.file(path);
  
  const encrypted = encryptAuthState(buffer);
  await file.save(encrypted, {
    metadata: { contentType: 'application/octet-stream' }
  });
  
  return path;
};

export const downloadAuthBlob = async (path: string): Promise<Buffer> => {
  const bucket = storage.bucket();
  const file = bucket.file(path);
  const [buffer] = await file.download();
  return decryptAuthState(buffer);
};
