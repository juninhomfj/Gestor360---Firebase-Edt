import { WAContact, WATag, WACampaign, WAMessageQueue } from '../types';
import { dbGetAll, dbPut, dbBulkPut, dbDelete, dbGet } from '../storage/db';
import { auth } from './firebase';
import { WhatsAppManualLogger } from './whatsappLogger';

const BACKEND_URL = (import.meta as any).env?.VITE_WA_BACKEND_URL || 'http://localhost:3001';
const WA_KEY = (import.meta as any).env?.VITE_WA_MODULE_KEY || 'default-dev-key';

const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-wa-module-key': WA_KEY
});

export const normalizePhone = (phone: string): string => {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 11) return '55' + clean;
    if (clean.length === 10) return '55' + clean.slice(0, 2) + '9' + clean.slice(2);
    if (clean.length === 13 && clean.startsWith('55')) return clean;
    return clean;
};

export const createSession = async (sessionId: string) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/sessions/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sessionId })
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
};

export const getSessionStatus = async (sessionId: string) => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/status`, {
            headers: getHeaders()
        });
        if (!res.ok) return { status: 'DISCONNECTED' };
        return res.json();
    } catch {
        return { status: 'DISCONNECTED' };
    }
};

export const logoutSession = async (sessionId: string) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/logout`, {
        method: 'POST',
        headers: getHeaders()
    });
    return res.json();
};

export const exportWAContactsToServer = async () => {
    const contacts = await getWAContacts();
    const res = await fetch(`${BACKEND_URL}/api/v1/contacts/import`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
            userId: auth.currentUser?.uid,
            contacts 
        })
    });
    return res.json();
};

export const createWACampaignRemote = async (campaign: Partial<WACampaign>, targetContacts: WAContact[]) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/campaigns`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
            userId: auth.currentUser?.uid,
            campaign, 
            recipients: targetContacts 
        })
    });
    if (!res.ok) throw new Error('Failed to create campaign');
    return res.json();
};

// --- Funções Locais para UX Offline ---
export const getWAContacts = async () => (await dbGetAll('wa_contacts')).filter(c => !c.deleted);
export const getWATags = async () => (await dbGetAll('wa_tags')).filter(t => !t.deleted);
export const getWACampaigns = async () => (await dbGetAll('wa_campaigns')).filter(c => !c.deleted);

export const saveWAContact = async (contact: WAContact) => {
    const stamped = { ...contact, phone: normalizePhone(contact.phone), updatedAt: new Date().toISOString() };
    await dbPut('wa_contacts', stamped);
    WhatsAppManualLogger.info("Contato salvo localmente", { phone: stamped.phone });
};

export const deleteWAContact = async (id: string) => await dbDelete('wa_contacts', id);

export const saveWACampaign = async (campaign: WACampaign) => {
    await dbPut('wa_campaigns', campaign);
};

export const createCampaignQueue = async (
    campaignId: string, 
    template: string, 
    contacts: WAContact[], 
    tags: string[], 
    abTest?: any, 
    media?: any
) => {
    const queueItems: WAMessageQueue[] = contacts.map((contact, idx) => {
        let msg = template.replace('{nome}', contact.name).replace('{primeiro_nome}', contact.name.split(' ')[0]);
        let variant: 'A' | 'B' = 'A';
        
        if (abTest?.enabled && idx % 2 !== 0) {
            msg = abTest.templateB.replace('{nome}', contact.name).replace('{primeiro_nome}', contact.name.split(' ')[0]);
            variant = 'B';
        }

        return {
            id: crypto.randomUUID(),
            campaignId,
            contactId: contact.id,
            phone: contact.phone,
            message: msg,
            status: 'PENDING',
            variant,
            media,
            deleted: false,
            userId: auth.currentUser?.uid || ''
        };
    });
    await dbBulkPut('wa_queue', queueItems);
};

export const getWAQueue = async (campaignId: string) => (await dbGetAll('wa_queue')).filter(i => i.campaignId === campaignId && !i.deleted);

export const updateQueueStatus = async (id: string, status: WAMessageQueue['status']) => {
    const item = await dbGet('wa_queue', id);
    if (item) await dbPut('wa_queue', { ...item, status, updatedAt: new Date().toISOString() } as any);
};

export const copyToClipboard = async (text: string) => await navigator.clipboard.writeText(text);

export const openWhatsAppWeb = (phone: string, text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`, '_blank');
};

export const copyImageToClipboard = async (base64Data: string): Promise<boolean> => {
    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        return true;
    } catch { return false; }
};

export const parseCSVContacts = (content: string): WAContact[] => {
    const lines = content.split(/\r?\n/);
    const contacts: WAContact[] = [];
    if (lines.length === 0) return [];
    
    const headerRow = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
    const phoneIdx = headerRow.findIndex(h => h.includes('phone') || h.includes('tel') || h.includes('cel'));
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

export const importWAContacts = async (contacts: WAContact[]) => {
    if (contacts.length > 500) throw new Error("Limite de 500 contatos por importação.");
    await dbBulkPut('wa_contacts', contacts);
};
