import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

/**
 * interface NtfyPayload
 * Contrato de entrada para a função de notificação.
 */
interface NtfyPayload {
  topic: string;
  message: string;
  title?: string;
  priority?: "min" | "low" | "default" | "high" | "urgent";
  tags?: string[];
}

/**
 * sendNtfyNotification
 * HTTPS Callable para envio de notificações via ntfy.sh.
 * Valida se o usuário possui permissões administrativas antes de processar o envio.
 * 
 * Exemplos de eventos documentados:
 * - Reset administrativo executado
 * - Novo relatório financeiro gerado
 * - Alerta de inconsistência crítica
 * - Broadcast manual do sistema
 */
export const sendNtfyNotification = functions.https.onCall(async (data: NtfyPayload, context) => {
    // 1. Validação de Autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated", 
            "A solicitação deve estar autenticada."
        );
    }

    // 2. Validação de Autoridade (Role-Based Access Control)
    const db = admin.firestore();
    const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
    const userData = profileSnap.data();

    if (!profileSnap.exists || (userData?.role !== 'DEV' && userData?.role !== 'ADMIN')) {
        console.warn(`[SECURITY] Tentativa de disparo NTfy negada para UID: ${context.auth.uid}`);
        throw new functions.https.HttpsError(
            "permission-denied", 
            "Privilégios insuficientes para disparar notificações globais."
        );
    }

    // 3. Validação do Payload
    const { topic, message, title, priority, tags } = data;

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'topic' é obrigatório.");
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'message' é obrigatório.");
    }

    // 4. Preparação do Envio HTTP (ntfy.sh)
    const url = `https://ntfy.sh/${topic}`;
    const headers: Record<string, string> = {
        'Content-Type': 'text/plain'
    };

    if (title) headers['Title'] = title;
    if (priority) headers['Priority'] = priority;
    if (tags && Array.isArray(tags)) headers['Tags'] = tags.join(',');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: message
        });

        if (!response.ok) {
            throw new Error(`NTfy Service Error: ${response.status} ${response.statusText}`);
        }

        return { success: true };

    } catch (error: any) {
        console.error("[NTFY_FUNCTION_ERROR]", error);
        throw new functions.https.HttpsError(
            "internal", 
            "Falha ao processar o envio para o serviço NTfy externo.",
            error.message
        );
    }
});