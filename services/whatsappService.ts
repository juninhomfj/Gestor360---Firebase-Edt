
import { WAContact, WATag, WACampaign, WAMessageQueue } from '../types';
import { dbGetAll, dbPut, dbBulkPut, dbDelete, dbGet } from '../storage/db';
import { auth, db } from './firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
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

// Detecção de saúde do backend para decidir entre modo Cloud ou Local
export const checkBackendHealth = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
};

export const createSession = async (sessionId: string) => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/sessions/create`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ sessionId })
        });
        if (!res.ok) throw new Error('Offline');
        return res.json();
    } catch {
        return { status: 'STANDALONE', message: 'Operando em modo nativo (Link Direto)' };
    }
};

export const getSessionStatus = async (sessionId: string) => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/status`, {
            headers: getHeaders()
        });
        if (!res.ok) return { status: 'STANDALONE' };
        return res.json();
    } catch {
        return { status: 'STANDALONE' };
    }
};

export const logoutSession = async (sessionId: string) => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/logout`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    } catch {
        return { ok: true };
    }
};

// --- Funções Locais com Persistência no Firestore ---

export const getWAContacts = async () => (await dbGetAll('wa_contacts')).filter(c => !c.deleted);
export const getWATags = async () => (await dbGetAll('wa_tags')).filter(t => !t.deleted);
export const getWACampaigns = async () => (await dbGetAll('wa_campaigns')).filter(c => !c.deleted);

export const saveWAContact = async (contact: WAContact) => {
    const stamped = { ...contact, phone: normalizePhone(contact.phone), updatedAt: new Date().toISOString() };
    await dbPut('wa_contacts', stamped);
    
    // Sincroniza com Firestore
    if (auth.currentUser) {
        await setDoc(doc(db, "wa_contacts", stamped.id), {
            ...stamped,
            userId: auth.currentUser.uid,
            syncAt: serverTimestamp()
        });
    }
};

export const deleteWAContact = async (id: string) => {
    await dbDelete('wa_contacts', id);
    if (auth.currentUser) {
        await setDoc(doc(db, "wa_contacts", id), { deleted: true, updatedAt: serverTimestamp() }, { merge: true });
    }
};

export const saveWACampaign = async (campaign: WACampaign) => {
    await dbPut('wa_campaigns', campaign);
    if (auth.currentUser) {
        await setDoc(doc(db, "wa_campaigns", campaign.id), {
            ...campaign,
            userId: auth.currentUser.uid,
            syncAt: serverTimestamp()
        });
    }
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
    
    // Opcional: Salvar fila no Firestore para multi-device
    if (auth.currentUser) {
        for (const item of queueItems) {
            await setDoc(doc(db, "wa_queue", item.id), { ...item, syncAt: serverTimestamp() });
        }
    }
};

export const getWAQueue = async (campaignId: string) => (await dbGetAll('wa_queue')).filter(i => i.campaignId === campaignId && !i.deleted);

export const updateQueueStatus = async (id: string, status: WAMessageQueue['status']) => {
    const item = await dbGet('wa_queue', id);
    if (item) {
        const updated = { ...item, status, updatedAt: new Date().toISOString() } as any;
        await dbPut('wa_queue', updated);
        if (auth.currentUser) {
            await setDoc(doc(db, "wa_queue", id), { status, updatedAt: serverTimestamp() }, { merge: true });
        }
    }
};

export const copyToClipboard = async (text: string) => await navigator.clipboard.writeText(text);

export const openWhatsAppWeb = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    // Usando o link universal api.whatsapp.com que funciona em mobile e desktop
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
};

export const copyImageToClipboard = async (base64Data: string): Promise<boolean> => {
    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        if (typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            return true;
        }
        return false;
    } catch { return false; }
};

export const parseCSVContacts = (content: string): WAContact[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== "");
    const contacts: WAContact[] = [];
    if (lines.length === 0) return [];
    
    const headerRow = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
    const phoneIdx = headerRow.findIndex(h => h.includes('phone') || h.includes('tel') || h.includes('cel') || h.includes('fone'));
    const nameIdx = headerRow.findIndex(h => h.includes('name') || h.includes('nome') || h.includes('cliente'));
    
    if (phoneIdx === -1) return [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map(s => s.trim());
        if (!cols[phoneIdx]) continue;
        contacts.push({
            id: crypto.randomUUID(),
            name: cols[nameIdx !== -1 ? nameIdx : 0] || 'Sem Nome',
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
    await dbBulkPut('wa_contacts', contacts);
    if (auth.currentUser) {
        for (const c of contacts) {
            await setDoc(doc(db, "wa_contacts", c.id), { ...c, syncAt: serverTimestamp() });
        }
    }
};

/**
 * Exporta todos os contatos locais para o servidor de automação.
 */
export const exportWAContactsToServer = async () => {
    const contacts = await getWAContacts();
    const res = await fetch(`${BACKEND_URL}/api/v1/contacts/sync`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ contacts })
    });
    if (!res.ok) throw new Error('Falha ao exportar contatos para o servidor.');
    return res.json();
};

/**
 * Cria uma campanha no servidor remoto para processamento via Cloud.
 */
export const createWACampaignRemote = async (campaign: Partial<WACampaign>, recipients: WAContact[]) => {
    const res = await fetch(`${BACKEND_URL}/api/v1/campaigns`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ campaign, recipients })
    });
    if (!res.ok) throw new Error('Falha ao sincronizar campanha com servidor.');
    return res.json();
};
