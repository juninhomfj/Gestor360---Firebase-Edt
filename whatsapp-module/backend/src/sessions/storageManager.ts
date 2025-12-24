/* Fix: Imported Buffer from 'buffer' to provide explicit type and global access in Node ESM environment */
import { Buffer } from 'buffer';
import { storage } from '../firebaseAdmin';
import crypto from 'crypto';

const KEY = process.env.SESSIONS_ENC_KEY || '';

/* Fix: Used explicit Buffer type from 'buffer' import */
export const encrypt = (plain: Buffer) => {
  if (!KEY) return plain;
  /* Fix: Used Buffer.from from explicit import */
  const key = Buffer.from(KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  /* Fix: Used Buffer.concat from explicit import */
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  /* Fix: Used Buffer.concat from explicit import */
  return Buffer.concat([iv, tag, encrypted]);
};

/* Fix: Used explicit Buffer type from 'buffer' import */
export const decrypt = (blob: Buffer) => {
  if (!KEY) return blob;
  /* Fix: Used Buffer.from from explicit import */
  const key = Buffer.from(KEY, 'base64');
  const iv = blob.slice(0, 12);
  const tag = blob.slice(12, 28);
  const encrypted = blob.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  /* Fix: Used Buffer.concat from explicit import */
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain;
};

/* Fix: Used explicit Buffer type from 'buffer' import */
export const uploadAuthBlob = async (sessionId: string, buffer: Buffer) => {
  const enc = encrypt(buffer);
  const path = `sessions/${sessionId}.auth`;
  const file = storage.file(path);
  await file.save(enc, { resumable: false, contentType: 'application/octet-stream' });
  return path;
};

export const downloadAuthBlob = async (path: string) => {
  const file = storage.file(path);
  const [contents] = await file.download();
  const dec = decrypt(contents);
  return dec;
};