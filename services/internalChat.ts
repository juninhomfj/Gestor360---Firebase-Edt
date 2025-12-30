
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
    // Fix: Added 'BUG_REPORT' to the union type to match the InternalMessage interface and resolve type mismatch during bug reporting
    type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' = 'CHAT',
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
        image: image || "", // Firestore não aceita undefined
        type,
        timestamp: new Date().toISOString(),
        read: false,
        relatedModule
    };

    // 1. Salva localmente
    await dbPut('internal_messages', msg);

    // 2. Salva no Firestore se disponível
    if (auth.currentUser) {
        try {
            // Cria objeto limpo para o Firestore
            const payload: any = {
                senderId: msg.senderId,
                senderName: msg.senderName,
                recipientId: msg.recipientId,
                content: msg.content,
                type: msg.type,
                timestamp: msg.timestamp,
                read: msg.read,
                userId: auth.currentUser.uid,
                createdAt: Timestamp.now()
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
    const msgRef = collection(db, "internal_messages");
    
    const q = query(
        msgRef, 
        limit(50)
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
    }, (error) => {
        // Silenciar erro de permissão para usuários sem chat habilitado
        if (error.code !== 'permission-denied') {
            console.warn("[Chat] Erro no listener (snapshot):", error.message);
        }
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
