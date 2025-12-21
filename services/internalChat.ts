
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
    addDoc,
    limit
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
    type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' = 'CHAT',
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
        image,
        type,
        timestamp: new Date().toISOString(),
        read: false,
        relatedModule
    };

    // 1. Salva localmente
    await dbPut('internal_messages', msg);

    // 2. Salva no Firestore se disponível
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            await setDoc(doc(db, "internal_messages", msg.id), {
                ...msg,
                userId: auth.currentUser.uid,
                createdAt: Timestamp.now()
            });
        } catch (e) {
            console.error("[Chat] Falha ao enviar para nuvem", e);
        }
    }

    return msg;
};

/**
 * Carrega histórico local de mensagens.
 */
export const getMessages = async (userId: string, isAdmin: boolean) => {
    const all = await dbGetAll('internal_messages');
    
    let filtered = [];
    if (isAdmin) {
        filtered = all.filter(m => m.recipientId === 'ADMIN' || m.senderId === userId || m.recipientId === userId);
    } else {
        filtered = all.filter(m => m.senderId === userId || m.recipientId === userId || m.recipientId === 'BROADCAST');
    }
    return filtered.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

/**
 * Subscreve ao Firestore para mensagens novas em tempo real.
 */
export const subscribeToMessages = (
    userId: string, 
    isAdmin: boolean, 
    onNewMessage: (msg: InternalMessage) => void
) => {
    // @ts-ignore
    if (!db || db.type === 'mock') return null;

    // Build query based on relevance
    const msgRef = collection(db, "internal_messages");
    
    // Security: Only messages where user is sender or recipient (simplified for client-side filtering or complex rules)
    const q = query(
        msgRef, 
        orderBy("createdAt", "desc"),
        limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const newMsg = change.doc.data() as InternalMessage;
                
                // Client-side relevance check
                const isRelevant = isAdmin || 
                                 newMsg.recipientId === userId || 
                                 newMsg.recipientId === 'BROADCAST' || 
                                 newMsg.senderId === userId;

                if (isRelevant) {
                    const existing = await dbGet('internal_messages', newMsg.id);
                    if (!existing) {
                        await dbPut('internal_messages', newMsg);
                        onNewMessage(newMsg);
                    }
                }
            }
        });
    });

    return { unsubscribe };
};

export const markMessageRead = async (msgId: string, userId: string) => {
    const msg = await dbGet('internal_messages', msgId);
    if (msg) {
        const updated = { ...msg };
        if (msg.recipientId === 'BROADCAST') {
            const readers = msg.readBy || [];
            if (!readers.includes(userId)) {
                updated.readBy = [...readers, userId];
            } else {
                return;
            }
        } else if (msg.recipientId === userId) {
            if (msg.read) return;
            updated.read = true;
        }

        await dbPut('internal_messages', updated);
        
        // @ts-ignore
        if (db && db.type !== 'mock' && auth.currentUser) {
            try {
                await setDoc(doc(db, "internal_messages", msgId), { 
                    read: updated.read, 
                    readBy: updated.readBy || [] 
                }, { merge: true });
            } catch (e) {}
        }
    }
};
