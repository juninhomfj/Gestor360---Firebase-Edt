
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

/**
 * sendNtfyNotification
 * HTTPS Callable para envio de notificações via ntfy.sh
 * 
 * Exemplos de Uso (Documentação Interna):
 * 1. Venda concluída: { topic: 'vendas', title: 'Venda Realizada', message: 'Cliente X comprou 50 cestas', tags: ['shopping_cart'] }
 * 2. Meta atingida: { topic: 'metas', title: 'Meta Batida!', message: 'Equipe atingiu 100% do objetivo', priority: 'high', tags: ['tada'] }
 * 3. Reset administrativo: { topic: 'logs', title: 'Security Alert', message: 'Hard reset executado no UID: xxx', priority: 'urgent', tags: ['warning'] }
 * 4. Mensagem global: { topic: 'broadcast', title: 'Aviso de Sistema', message: 'Manutenção agendada para 22h', tags: ['loudspeaker'] }
 */
export const sendNtfyNotification = functions.https.onCall(async (data, context) => {
    // 1. Validação de Autenticação Básica
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Autenticação obrigatória.");
    }

    // 2. Validação de Autoridade (Role-Based Access Control)
    const db = admin.firestore();
    const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
    const userData = profileSnap.data();

    if (!profileSnap.exists || (userData?.role !== 'DEV' && userData?.role !== 'ADMIN')) {
        throw new functions.https.HttpsError("permission-denied", "Acesso restrito a administradores.");
    }

    // 3. Validação do Payload
    const { topic, title, message, priority = "default", tags = [] } = data;

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'topic' é obrigatório.");
    }
    if (!title || typeof title !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'title' é obrigatório.");
    }
    if (!message || typeof message !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'message' é obrigatório.");
    }

    // 4. Envio para ntfy.sh
    const url = `https://ntfy.sh/${topic}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Title': title,
                'Priority': priority,
                'Tags': Array.isArray(tags) ? tags.join(',') : ''
            },
            body: message // Envio em texto puro conforme requisito
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return { success: true, timestamp: Date.now() };

    } catch (error: any) {
        console.error("[NTFY ERROR]", error);
        throw new functions.https.HttpsError("internal", "Falha ao processar envio para o serviço ntfy.sh");
    }
});
