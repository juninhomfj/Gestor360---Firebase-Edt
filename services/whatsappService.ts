
import {
  WAContact,
  WATag,
  WACampaign,
  WAMessageQueue
} from '../types';

import { auth, db } from './firebase';
import {
  collection,
  serverTimestamp,
  setDoc,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  getDoc,
  updateDoc
} from 'firebase/firestore';

const BACKEND_URL =
  (import.meta as any).env?.VITE_WA_BACKEND_URL || 'http://localhost:3001';

const WA_KEY =
  (import.meta as any).env?.VITE_WA_MODULE_KEY || 'default-dev-key';

const getHeaders = (uid?: string) => ({
  'Content-Type': 'application/json',
  'x-wa-module-key': WA_KEY,
  ...(uid ? { 'x-user-id': uid } : {})
});

/**
 * Normaliza telefone para padrão E.164 Brasil
 */
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length === 13) return digits;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 10) return `55${digits.slice(0, 2)}9${digits.slice(2)}`;

  throw new Error('Telefone inválido');
};

/**
 * Backend health
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(2000)
    });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Sessões
 */
export const createSession = async (sessionId: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/sessions/create`, {
      method: 'POST',
      headers: getHeaders(uid),
      body: JSON.stringify({ sessionId })
    });

    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { status: 'STANDALONE' };
  }
};

export const getSessionStatus = async (sessionId: string) => {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/status`,
      { headers: getHeaders() }
    );
    return res.ok ? res.json() : { status: 'STANDALONE' };
  } catch {
    return { status: 'STANDALONE' };
  }
};

export const logoutSession = async (sessionId: string) => {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/logout`,
      { method: 'POST', headers: getHeaders() }
    );
    return res.ok ? res.json() : { status: 'STANDALONE' };
  } catch {
    return { status: 'STANDALONE' };
  }
};

/**
 * Firestore queries
 */
export const getWAContacts = async (): Promise<WAContact[]> => {
  if (!auth.currentUser) return [];

  const q = query(
    collection(db, 'wa_contacts'),
    where('userId', '==', auth.currentUser.uid),
    where('deleted', '==', false)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as WAContact);
};

export const getWATags = async (): Promise<WATag[]> => {
  if (!auth.currentUser) return [];

  const q = query(
    collection(db, 'wa_tags'),
    where('userId', '==', auth.currentUser.uid),
    where('deleted', '==', false)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as WATag);
};

export const getWACampaigns = async (): Promise<WACampaign[]> => {
  if (!auth.currentUser) return [];

  const q = query(
    collection(db, 'wa_campaigns'),
    where('userId', '==', auth.currentUser.uid),
    where('deleted', '==', false)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as WACampaign);
};

/**
 * Persistência
 */
export const saveWAContact = async (contact: WAContact) => {
  if (!auth.currentUser) return;

  const data: WAContact = {
    ...contact,
    phone: normalizePhone(contact.phone),
    userId: auth.currentUser.uid,
    updatedAt: new Date().toISOString(),
    deleted: contact.deleted ?? false
  };

  await setDoc(
    doc(db, 'wa_contacts', data.id),
    { ...data, syncAt: serverTimestamp() },
    { merge: true }
  );
};

export const deleteWAContact = async (id: string) => {
  if (!auth.currentUser) return;

  await setDoc(
    doc(db, 'wa_contacts', id),
    {
      deleted: true,
      updatedAt: serverTimestamp(),
      deletedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const saveWACampaign = async (campaign: WACampaign) => {
  if (!auth.currentUser) return;

  await setDoc(
    doc(db, 'wa_campaigns', campaign.id),
    {
      ...campaign,
      userId: auth.currentUser.uid,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

/**
 * Queue com batch
 */
export const createCampaignQueue = async (
  campaignId: string,
  template: string,
  contacts: WAContact[],
  tags: string[],
  abTest?: any,
  media?: any
) => {
  if (!auth.currentUser) return;

  const batch = writeBatch(db);
  const uid = auth.currentUser.uid;

  contacts.forEach((contact, idx) => {
    let message = template;
    let variant: 'A' | 'B' = 'A';

    if (abTest?.enabled && idx % 2 !== 0) {
      message = abTest.templateB;
      variant = 'B';
    }

    message = message
      .replace('{nome}', contact.name)
      .replace('{primeiro_nome}', contact.name.split(' ')[0]);

    const ref = doc(collection(db, 'wa_queue'));

    const item: WAMessageQueue = {
      id: ref.id,
      campaignId,
      contactId: contact.id,
      phone: contact.phone,
      message,
      status: 'PENDING',
      variant,
      media,
      deleted: false,
      userId: uid
    };

    batch.set(ref, { ...item, createdAt: serverTimestamp() });
  });

  await batch.commit();
};

/**
 * CSV parser real
 */
export const parseCSVContacts = (content: string): WAContact[] => {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const headers = lines[0].split(/[;,]/).map(h => h.toLowerCase());

  const phoneIdx = headers.findIndex(h => /fone|tel|phone|cel/.test(h));
  const nameIdx = headers.findIndex(h => /nome|name|cliente/.test(h));
  const tagIdx = headers.findIndex(h => h.includes('tag'));

  if (phoneIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(/[;,]/);

    return {
      id: crypto.randomUUID(),
      name: cols[nameIdx] || 'Sem Nome',
      phone: normalizePhone(cols[phoneIdx]),
      tags: tagIdx !== -1 ? cols[tagIdx].split('|').map(t => t.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      userId: auth.currentUser?.uid || ''
    };
  });
};

/* Fix: Added missing WhatsApp service exports to resolve module member errors */
export const getWAQueue = async (campaignId: string): Promise<WAMessageQueue[]> => {
    const q = query(collection(db, 'wa_queue'), where('campaignId', '==', campaignId), where('deleted', '==', false));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WAMessageQueue);
};

export const updateQueueStatus = async (id: string, status: WAMessageQueue['status']) => {
    await updateDoc(doc(db, 'wa_queue', id), { status, updatedAt: serverTimestamp() });
};

export const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) { return false; }
};

export const openWhatsAppWeb = (phone: string, message: string) => {
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
};

export const copyImageToClipboard = async (base64: string) => {
    try {
        const response = await fetch(base64);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
        ]);
        return true;
    } catch (e) { return false; }
};

export const exportWAContactsToServer = async () => {};
export const createWACampaignRemote = async (c: WACampaign, t: WAContact[]) => {};
export const importWAContacts = async (contacts: WAContact[]) => {
    const batch = writeBatch(db);
    contacts.forEach(c => {
        const ref = doc(collection(db, 'wa_contacts'), c.id);
        batch.set(ref, { ...c, createdAt: serverTimestamp() });
    });
    await batch.commit();
};
