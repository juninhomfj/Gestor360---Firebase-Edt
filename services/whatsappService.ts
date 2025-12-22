
import { WAContact, WATag, WACampaign, WAMessageQueue, WAMediaType } from '../types';
/* Fix: Removed non-existent export WAManualLog from types import */
import { dbGetAll, dbPut, dbDelete, dbBulkPut } from '../storage/db';
import { markDirty } from './sync';
import { base64ToBlob } from '../utils/fileHelper';

// --- CONTACTS ---

export const getWAContacts = async (): Promise<WAContact[]> => {
    const contacts = await dbGetAll('wa_contacts');
    return contacts.filter(c => !c.deleted);
};

export const saveWAContact = async (contact: WAContact) => {
    const stamped = { ...contact, updatedAt: new Date().toISOString() };
    await dbPut('wa_contacts', stamped);
    markDirty();
};

export const deleteWAContact = async (id: string) => {
    // Soft delete locally
    const contacts = await dbGetAll('wa_contacts');
    const target = contacts.find(c => c.id === id);
    if (target) {
        const deleted = { ...target, deleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await dbPut('wa_contacts', deleted);
        markDirty();
    }
};

export const importWAContacts = async (contacts: WAContact[]) => {
    const stamped = contacts.map(c => ({...c, updatedAt: new Date().toISOString()}));
    await dbBulkPut('wa_contacts', stamped);
    markDirty();
};

// --- TAGS ---

export const getWATags = async (): Promise<WATag[]> => {
    const tags = await dbGetAll('wa_tags');
    return tags.filter(t => !t.deleted);
};

export const saveWATag = async (tag: WATag) => {
    const stamped = { ...tag, updatedAt: new Date().toISOString() };
    await dbPut('wa_tags', stamped);
    markDirty();
};

// --- CAMPAIGNS & QUEUE ---

export const getWACampaigns = async (): Promise<WACampaign[]> => {
    const campaigns = await dbGetAll('wa_campaigns');
    return campaigns.filter(c => !c.deleted);
};

export const saveWACampaign = async (campaign: WACampaign) => {
    // Ensure integers for counters to match DB constraint
    const stamped = { 
        ...campaign, 
        totalContacts: Math.floor(campaign.totalContacts),
        sentCount: Math.floor(campaign.sentCount),
        updatedAt: new Date().toISOString() 
    };
    await dbPut('wa_campaigns', stamped);
    markDirty();
};

export const archiveWACampaign = async (campaign: WACampaign) => {
    const updated = { ...campaign, archived: true, updatedAt: new Date().toISOString() };
    await dbPut('wa_campaigns', updated);
    markDirty();
};

export const createCampaignQueue = async (
    campaignId: string, 
    messageTemplate: string, 
    contacts: WAContact[], 
    targetTags: string[], 
    abTest?: { enabled: boolean, templateB: string },
    media?: { data: string, type: WAMediaType, name: string }
) => {
    // A lista 'contacts' já vem filtrada do Wizard
    
    const queueItems: WAMessageQueue[] = contacts.map((c, index) => {
        let variant: 'A' | 'B' = 'A';
        let templateToUse = messageTemplate;

        // Lógica de Teste A/B: Alterna entre A e B
        if (abTest?.enabled && abTest.templateB) {
            variant = index % 2 === 0 ? 'A' : 'B';
            templateToUse = variant === 'A' ? messageTemplate : abTest.templateB;
        }

        return {
            id: crypto.randomUUID(),
            campaignId,
            contactId: c.id,
            phone: c.phone,
            message: replaceVariables(templateToUse, c), 
            status: 'PENDING', // Explicit status
            variant,
            media: media, // Anexa mídia se houver
            sentAt: undefined // Nullable
        };
    });
    
    await dbBulkPut('wa_queue', queueItems);
    markDirty();
    return queueItems.length;
};

export const getWAQueue = async (campaignId?: string): Promise<WAMessageQueue[]> => {
    const all = await dbGetAll('wa_queue');
    const active = all.filter(q => !q.deleted);
    if (campaignId) {
        return active.filter(q => q.campaignId === campaignId);
    }
    return active;
};

export const updateQueueStatus = async (itemId: string, status: 'SENT' | 'FAILED' | 'SKIPPED') => {
    const all = await dbGetAll('wa_queue');
    const item = all.find(i => i.id === itemId);
    
    if (item) {
        item.status = status;
        item.sentAt = new Date().toISOString();
        await dbPut('wa_queue', item);
        markDirty();
    }
};

// --- BROWSER-ONLY HELPER FUNCTIONS ---

export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
};

/**
 * Copies a Base64 image to the system clipboard as a Blob.
 * This allows the user to Paste (Ctrl+V) directly into WhatsApp Web.
 */
export const copyImageToClipboard = async (base64: string): Promise<boolean> => {
    try {
        const blob = await base64ToBlob(base64);
        
        // Clipboard Item constructor expects a Promise for the Blob in some browsers or just the Blob.
        // Modern approach:
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
        return true;
    } catch (err) {
        console.error('Failed to copy image: ', err);
        // Fallback or alert handled by caller
        return false;
    }
};

export const openWhatsAppWeb = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, '_blank', 'noreferrer');
};

// --- UTILS ---

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
};

const getFirstName = (fullName: string) => {
    const first = fullName.trim().split(' ')[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};

const replaceVariables = (template: string, contact: WAContact): string => {
    let text = template;
    
    // Etapa 5: Smart Variables
    // Saudação automática
    text = text.replace(/{saudacao}/gi, getGreeting());
    text = text.replace(/{bom_dia}/gi, getGreeting());
    
    // Primeiro Nome
    text = text.replace(/{primeiro_nome}/gi, getFirstName(contact.name));
    text = text.replace(/{first_name}/gi, getFirstName(contact.name));

    // Standard variables
    text = text.replace(/{name}/gi, contact.name);
    text = text.replace(/{nome}/gi, contact.name);
    text = text.replace(/{phone}/gi, contact.phone);
    text = text.replace(/{telefone}/gi, contact.phone);
    
    // Custom variables
    if (contact.variables) {
        Object.keys(contact.variables).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'gi');
            text = text.replace(regex, contact.variables![key]);
        });
    }
    
    return text;
};

export const parseCSVContacts = (content: string): WAContact[] => {
    const lines = content.split('\n');
    const contacts: WAContact[] = [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const hasHeader = headers.includes('phone') || headers.includes('nome') || headers.includes('telefone');
    
    const nameIdx = headers.findIndex(h => h === 'nome' || h === 'name');
    const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'telefone' || h === 'celular');
    const tagsIdx = headers.findIndex(h => h === 'tags');
    
    const varIndexes: { [key: string]: number } = {};
    headers.forEach((h, idx) => {
        if (idx !== nameIdx && idx !== phoneIdx && idx !== tagsIdx && h) {
            varIndexes[h] = idx; 
        }
    });

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(s => s.trim());
        
        let name = hasHeader && nameIdx !== -1 ? cols[nameIdx] : cols[0];
        let phone = hasHeader && phoneIdx !== -1 ? cols[phoneIdx] : cols[1];
        let tagsStr = hasHeader && tagsIdx !== -1 ? cols[tagsIdx] : cols[2];

        const variables: Record<string, string> = {};
        if (hasHeader) {
            Object.keys(varIndexes).forEach(key => {
                const val = cols[varIndexes[key]];
                if (val) variables[key] = val;
            });
        }
        
        if (phone) {
            /* Fixed: Added missing updatedAt property */
            contacts.push({
                id: crypto.randomUUID(),
                name: name || 'Sem Nome',
                phone: phone.replace(/\D/g, ''),
                tags: tagsStr ? tagsStr.split(';').map(t => t.trim()) : [],
                variables: Object.keys(variables).length > 0 ? variables : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    }
    return contacts;
};
