
import { WAContact, WATag, WACampaign, WAMessageQueue } from '../types';
import { dbGetAll, dbPut, dbBulkPut, dbDelete, dbGet } from '../storage/db';
import { auth } from './firebase';

const BACKEND_URL = (import.meta as any).env?.VITE_WA_BACKEND_URL || 'http://localhost:3001';
const WA_KEY = (import.meta as any).env?.VITE_WA_MODULE_KEY || 'default-dev-key';

const headers = {
    'Content-Type': 'application/json',
    'x-wa-module-key': WA_KEY
};

/**
 * Normaliza telefone para E.164 (Brasil default +55)
 */
export const normalizePhone = (phone: string): string => {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 11) return '55' + clean;
    if (clean.length === 10) return '55' + clean.slice(0, 2) + '9' + clean.slice(2);
    if (clean.length === 13 && clean.startsWith('55')) return clean;
    return clean;
};

export const getWAContacts = async () => (await dbGetAll('wa_contacts')).filter(c => !c.deleted);
export const getWATags = async () => (await dbGetAll('wa_tags')).filter(t => !t.deleted);
export const getWACampaigns = async () => (await dbGetAll('wa_campaigns')).filter(c => !c.deleted);

// Fix: Implemented saveWACampaign to store campaign data
export const saveWACampaign = async (campaign: WACampaign) => {
    await dbPut('wa_campaigns', campaign);
};

// Fix: Implemented createCampaignQueue to generate message items for a campaign
export const createCampaignQueue = async (
    campaignId: string, 
    template: string, 
    recipients: WAContact[], 
    tags: string[], 
    abTest?: { enabled: boolean; templateB: string }, 
    media?: any
) => {
    const queueItems: WAMessageQueue[] = recipients.map((contact, idx) => {
        const variant = abTest?.enabled && idx % 2 !== 0 ? 'B' : 'A';
        const messageText = variant === 'B' ? abTest!.templateB : template;
        
        // Simple variable replacement
        const finalMessage = messageText
            .replace(/{nome}/g, contact.name)
            .replace(/{primeiro_nome}/g, contact.name.split(' ')[0]);

        return {
            id: crypto.randomUUID(),
            campaignId,
            contactId: contact.id,
            phone: contact.phone,
            message: finalMessage,
            status: 'PENDING',
            variant,
            media,
            deleted: false
        } as WAMessageQueue;
    });

    await dbBulkPut('wa_queue', queueItems);
};

// Fix: Implemented getWAQueue to retrieve queue items for a campaign
export const getWAQueue = async (campaignId: string) => {
    return (await dbGetAll('wa_queue')).filter(i => i.campaignId === campaignId && !i.deleted);
};

// Fix: Implemented updateQueueStatus to track message delivery
export const updateQueueStatus = async (id: string, status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED') => {
    const item = await dbGet('wa_queue', id);
    if (item) {
        await dbPut('wa_queue', { ...item, status, sentAt: status === 'SENT' ? new Date().toISOString() : undefined });
    }
};

// Fix: Added utility functions for clipboard and WhatsApp Web integration
export const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
};

export const openWhatsAppWeb = (phone: string, text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`, '_blank');
};

export const copyImageToClipboard = async (base64Data: string): Promise<boolean> => {
    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        return true;
    } catch (e) {
        console.error("Clipboard Image Error:", e);
        return false;
    }
};

// Fix: Implemented deleteWAContact
export const deleteWAContact = async (id: string) => {
    await dbDelete('wa_contacts', id);
};

// Fix: Implemented importWAContacts
export const importWAContacts = async (contacts: WAContact[]) => {
    await dbBulkPut('wa_contacts', contacts);
};

export const createSession = async (sessionId: string) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/sessions/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId })
    });
    return res.json();
};

export const getSessionStatus = async (sessionId: string) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/status`, { headers });
    return res.json();
};

export const exportWAContactsToServer = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado.");

    const contacts = await getWAContacts();
    const res = await fetch(`${BACKEND_URL}/api/v1/contacts/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user.uid, contacts })
    });
    return res.json();
};

export const createCampaignRemote = async (campaign: Partial<WACampaign>, recipients: WAContact[]) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado.");

    const res = await fetch(`${BACKEND_URL}/api/v1/campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            userId: user.uid,
            campaign,
            recipients: recipients.map(r => ({ ...r, phone: normalizePhone(r.phone) }))
        })
    });
    return res.json();
};

export const saveWAContact = async (contact: WAContact) => {
    const stamped = { ...contact, phone: normalizePhone(contact.phone), updatedAt: new Date().toISOString() };
    await dbPut('wa_contacts', stamped);
};

export const parseCSVContacts = (content: string): WAContact[] => {
    const lines = content.split(/\r?\n/);
    const contacts: WAContact[] = [];
    const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
    
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel') || h.includes('cel'));
    if (phoneIdx === -1) return [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map(s => s.trim());
        if (!cols[phoneIdx]) continue;
        
        contacts.push({
            id: crypto.randomUUID(),
            name: cols[0] || 'Sem Nome',
            phone: normalizePhone(cols[phoneIdx]),
            tags: cols[2] ? cols[2].split('|').map(t => t.trim()) : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deleted: false,
            userId: auth.currentUser?.uid || ''
        });
    }
    return contacts;
};
