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

// Tenta pegar a URL salva nas configurações locais, senão usa a do ambiente ou localhost
const getBackendUrl = () => {
    const savedUrl = localStorage.getItem('wa_backend_url_override');
    if (savedUrl) return savedUrl;
    return (import.meta as any).env?.VITE_WA_BACKEND_URL || 'http://localhost:3333';
};

const getWaKey = () => {
    return localStorage.getItem('wa_module_key_override') || (import.meta as any).env?.VITE_WA_MODULE_KEY || 'default-dev-key';
};

const getHeaders = (uid?: string) => ({
  'Content-Type': 'application/json',
  'x-wa-module-key': getWaKey(),
  ...(uid ? { 'x-user-id': uid } : {})
});

export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 10) return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return digits; 
};

export const parseCSVContacts = (text: string): WAContact[] => {
    const lines = text.split('\n').filter(l => l.trim());
    const contacts: WAContact[] = [];
    const uid = auth.currentUser?.uid || '';

    lines.forEach(line => {
        const parts = line.split(/[,;]/);
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const phone = normalizePhone(parts[1].trim());
            if (phone) {
                contacts.push({
                    id: crypto.randomUUID(),
                    name,
                    phone,
                    tags: ['IMPORT'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deleted: false,
                    userId: uid,
                    source: 'IMPORT'
                });
            }
        }
    });
    return contacts;
};

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${getBackendUrl()}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
};

export const createSession = async (sessionId: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');
  try {
    const res = await fetch(`${getBackendUrl()}/api/v1/sessions/create`, {
      method: 'POST',
      headers: getHeaders(uid),
      body: JSON.stringify({ sessionId })
    });
    return res.ok ? await res.json() : { status: 'STANDALONE' };
  } catch { return { status: 'STANDALONE' }; }
};

export const getSessionStatus = async (sessionId: string) => {
  try {
    const res = await fetch(`${getBackendUrl()}/api/v1/sessions/${sessionId}/status`, { headers: getHeaders() });
    return res.ok ? res.json() : { status: 'STANDALONE' };
  } catch { return { status: 'STANDALONE' }; }
};

export const logoutSession = async (sessionId: string) => {
  try {
    const res = await fetch(`${getBackendUrl()}/api/v1/sessions/${sessionId}/logout`, { method: 'POST', headers: getHeaders() });
    return res.ok ? res.json() : { status: 'STANDALONE' };
  } catch { return { status: 'STANDALONE' }; }
};

export const getWAContacts = async (): Promise<WAContact[]> => {
  if (!auth.currentUser) return [];
  try {
      const q = query(collection(db, 'wa_contacts'), where('userId', '==', auth.currentUser.uid), where('deleted', '==', false));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WAContact));
  } catch (e) { return []; }
};

export const getWATags = async (): Promise<WATag[]> => {
  if (!auth.currentUser) return [];
  try {
      const q = query(collection(db, 'wa_tags'), where('userId', '==', auth.currentUser.uid), where('deleted', '==', false));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WATag));
  } catch (e) { return []; }
};

export const getWACampaigns = async (): Promise<WACampaign[]> => {
  if (!auth.currentUser) return [];
  try {
      const q = query(collection(db, 'wa_campaigns'), where('userId', '==', auth.currentUser.uid), where('deleted', '==', false));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WACampaign));
  } catch (e) { return []; }
};

export const saveWAContact = async (contact: WAContact) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const data = { ...contact, phone: normalizePhone(contact.phone), userId: uid, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, 'wa_contacts', data.id), { ...data, syncAt: serverTimestamp() }, { merge: true });
};

export const deleteWAContact = async (id: string) => {
  if (!auth.currentUser) return;
  await updateDoc(doc(db, 'wa_contacts', id), { deleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() });
};

export const saveWACampaign = async (campaign: WACampaign) => {
  if (!auth.currentUser) return;
  await setDoc(doc(db, 'wa_campaigns', campaign.id), { ...campaign, userId: auth.currentUser.uid, updatedAt: serverTimestamp() }, { merge: true });
};

export const createCampaignQueue = async (campaignId: string, template: string, contacts: WAContact[], tags: string[], abTest?: any, media?: any) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const batch = writeBatch(db);
  contacts.forEach((contact, idx) => {
    let message = template;
    let variant: 'A' | 'B' = 'A';
    if (abTest?.enabled && idx % 2 !== 0) { message = abTest.templateB; variant = 'B'; }
    message = message.replace('{nome}', contact.name).replace('{primeiro_nome}', contact.name.split(' ')[0]);
    const ref = doc(collection(db, 'wa_queue'));
    const item: WAMessageQueue = { id: ref.id, campaignId, contactId: contact.id, phone: contact.phone, message, status: 'PENDING', variant, media, deleted: false, isSeed: false, userId: uid };
    batch.set(ref, { ...item, createdAt: serverTimestamp() });
  });
  await batch.commit();
};

export const getWAQueue = async (campaignId: string): Promise<WAMessageQueue[]> => {
    try {
        const q = query(collection(db, 'wa_queue'), where('campaignId', '==', campaignId), where('deleted', '==', false));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as WAMessageQueue));
    } catch (e) { return []; }
};

export const updateQueueStatus = async (id: string, status: WAMessageQueue['status']) => {
    await updateDoc(doc(db, 'wa_queue', id), { status, updatedAt: serverTimestamp() });
};

export const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
};

export const openWhatsAppWeb = (phone: string, message: string) => {
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
};

export const copyImageToClipboard = async (base64: string) => {
    try {
        const response = await fetch(base64);
        const blob = await response.blob();
        await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
        return true;
    } catch (e) { return false; }
};

export const importWAContacts = async (contacts: WAContact[]) => {
    const batch = writeBatch(db);
    contacts.forEach(c => {
        const ref = doc(collection(db, 'wa_contacts'), c.id);
        batch.set(ref, { ...c, createdAt: serverTimestamp() });
    });
    await batch.commit();
};

export const exportWAContactsToServer = async () => {
    const contacts = await getWAContacts();
    if (!contacts.length) return;
    const uid = auth.currentUser?.uid;
    await fetch(`${getBackendUrl()}/api/v1/contacts/sync`, {
        method: 'POST',
        headers: getHeaders(uid),
        body: JSON.stringify({ contacts })
    });
};

export const createWACampaignRemote = async (campaign: WACampaign, recipients: WAContact[]) => {
    const uid = auth.currentUser?.uid;
    await fetch(`${getBackendUrl()}/api/v1/campaigns`, {
      method: 'POST',
      headers: getHeaders(uid),
      body: JSON.stringify({ campaign, recipients })
    });
};