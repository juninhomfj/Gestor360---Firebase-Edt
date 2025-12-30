
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    Timestamp,
    limit,
    /* Fix: Added serverTimestamp to firestore imports */
    serverTimestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { dbPut, dbGetAll, dbGet } from '../storage/db';
import { InternalMessage, User } from '../types';

/**
 * Envia uma mensagem persistindo localmente e no Firestore.
 */
export const sendMessage = async (
    sender: User, 
    content: string, 
    type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' | 'SYSTEM' = 'CHAT',
    recipientId: string = 'ADMIN',
    image?: string,
    relatedModule?: 'sales' | 'finance' | 'ai'
) => {
    const msg: InternalMessage = {
        id: crypto.randomUUID(),
        senderId: sender.id,
        senderName: sender.name,
        recipientId,
        content,
        image: image || "", 
        type,
        timestamp: new Date().toISOString(),
        read: false,
        relatedModule
    };

    await dbPut('internal_messages', msg);

    if (auth.currentUser) {
        try {
            const payload: any = {
                senderId: msg.senderId,
                senderName: msg.senderName,
                recipientId: msg.recipientId,
                content: msg.content,
                type: msg.type,
                timestamp: msg.timestamp,
                read: msg.read,
                userId: auth.currentUser.uid,
                createdAt: serverTimestamp()
            };

            if (msg.image) payload.image = msg.image;
            if (msg.relatedModule) payload.relatedModule = msg.relatedModule;

            await setDoc(doc(db, "internal_messages", msg.id), payload);
        } catch (e) {
            console.error("[Chat] Falha ao enviar para nuvem", e);
        }
    }

    return msg;
};

/**
 * Carrega histórico local de mensagens com filtro RLS obrigatório.
 */
export const getMessages = async (userId: string, isAdmin: boolean) => {
    // 1. Busca mensagens locais no IndexedDB
    const all = await dbGetAll('internal_messages');
    let filtered = all.filter(m => m.recipientId === userId || m.senderId === userId || m.recipientId === 'BROADCAST');

    // 2. Busca mensagens do Firestore com filtro obrigatório
    try {
        const q = query(
            collection(db, "internal_messages"),
            where("recipientId", "in", [userId, "BROADCAST"]),
            orderBy("createdAt", "desc"),
            limit(50)
        );
        const snap = await getDocs(q);
        const cloudMsgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as InternalMessage));
        
        // Merge seguro
        const merged = [...filtered];
        cloudMsgs.forEach(cm => {
            if (!merged.find(m => m.id === cm.id)) merged.push(cm);
        });
        
        return merged.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (e) {
        console.warn("[Chat] Falha ao ler nuvem:", e);
        return filtered.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
};

/**
 * Subscreve ao Firestore para mensagens novas com filtro mandatório.
 */
export const subscribeToMessages = (
    userId: string, 
    isAdmin: boolean, 
    onNewMessage: (msg: InternalMessage) => void
) => {
    const q = query(
        collection(db, "internal_messages"),
        where("recipientId", "in", [userId, "BROADCAST"]),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const newMsg = {
                    ...data,
                    id: change.doc.id,
                    timestamp: data.timestamp || (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
                } as InternalMessage;
                
                const existing = await dbGet('internal_messages', newMsg.id);
                if (!existing) {
                    await dbPut('internal_messages', newMsg);
                    onNewMessage(newMsg);
                }
            }
        });
    });

    return { unsubscribe };
};

export const markMessageRead = async (msgId: string, userId: string) => {
    const msg = await dbGet('internal_messages', msgId);
    if (msg) {
        const updated = { ...msg, read: true };
        if (msg.recipientId === 'BROADCAST') {
            const readers = msg.readBy || [];
            if (!readers.includes(userId)) updated.readBy = [...readers, userId];
            else return;
        }

        await dbPut('internal_messages', updated);
        
        if (auth.currentUser) {
            try {
                await setDoc(doc(db, "internal_messages", msgId), { 
                    read: updated.read, 
                    readBy: updated.readBy || [] 
                }, { merge: true });
            } catch (e) {}
        }
    }
};
