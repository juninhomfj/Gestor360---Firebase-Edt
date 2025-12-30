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
 * Carrega histórico local de mensagens, incluindo mensagens da nova coleção system_messages.
 */
export const getMessages = async (userId: string, isAdmin: boolean) => {
    const all = await dbGetAll('internal_messages');
    
    // Filtra mensagens de usuário protegidas por RLS
    let filtered = [];
    if (isAdmin) {
        filtered = all.filter(m => m.recipientId === 'ADMIN' || m.senderId === userId || m.recipientId === userId);
    } else {
        filtered = all.filter(m => m.senderId === userId || m.recipientId === userId || m.recipientId === 'BROADCAST');
    }

    // Busca mensagens da coleção system_messages (Globais, sem userId)
    try {
        const sysMsgSnap = await getDocs(query(collection(db, "system_messages"), orderBy("createdAt", "desc"), limit(20)));
        const sysMsgs = sysMsgSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                senderId: 'SYSTEM',
                senderName: 'Sistema Gestor360',
                recipientId: 'BROADCAST',
                content: data.body,
                title: data.title,
                type: data.type === 'broadcast' ? 'BROADCAST' : 'CHAT',
                timestamp: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                read: false
            } as any;
        });
        filtered = [...filtered, ...sysMsgs];
    } catch (e) {
        console.warn("[Chat] Falha ao carregar system_messages:", e);
    }

    return filtered.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

/**
 * Subscreve ao Firestore para mensagens novas, escutando também a coleção system_messages.
 */
export const subscribeToMessages = (
    userId: string, 
    isAdmin: boolean, 
    onNewMessage: (msg: InternalMessage) => void
) => {
    // 1. Listener para mensagens internas (User-to-User / User-to-Admin)
    const msgRef = collection(db, "internal_messages");
    const qInternal = query(msgRef, limit(50));

    const unsubInternal = onSnapshot(qInternal, (snapshot) => {
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
    });

    // 2. Listener para system_messages (Globais)
    const sysRef = collection(db, "system_messages");
    const unsubSystem = onSnapshot(query(sysRef, orderBy("createdAt", "desc"), limit(5)), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const sysMsg: any = {
                    id: change.doc.id,
                    senderId: 'SYSTEM',
                    senderName: 'Sistema Gestor360',
                    recipientId: 'BROADCAST',
                    content: data.body,
                    type: 'BROADCAST',
                    timestamp: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                    read: false
                };
                onNewMessage(sysMsg);
            }
        });
    });

    return { 
        unsubscribe: () => {
            unsubInternal();
            unsubSystem();
        } 
    };
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
