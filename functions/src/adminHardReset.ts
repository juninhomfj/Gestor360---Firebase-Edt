import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * TIPO: HTTPS Callable (onCall)
 * JUSTIFICATIVA: Gerenciamento automático de serialização e contexto de autenticação (JWT). 
 * Fornece o objeto 'context.auth' validado pelo Firebase Auth, essencial para checagem de privilégios.
 */

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Whitelist de coleções permitidas para deleção administrativa
const ALLOWED_TABLES = ["sales", "transactions", "accounts", "clients", "receivables", "goals", "cards"];

export const adminHardResetUserData = functions.https.onCall(async (data, context) => {
    // 1. Validação de Autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const callerUid = context.auth.uid;

    // 2. Validação de Role no Servidor (Single Source of Truth)
    const profileSnap = await db.collection('profiles').doc(callerUid).get();
    const profileData = profileSnap.data();
    
    if (!profileSnap.exists || (profileData?.role !== 'DEV' && profileData?.role !== 'ADMIN')) {
        console.warn(`[SECURITY ALERT] Tentativa de reset não autorizada por UID: ${callerUid}`);
        throw new functions.https.HttpsError('permission-denied', 'Privilégios insuficientes.');
    }

    // 3. Validação do Payload
    const { targetUserId, tables, confirmationHash } = data;

    if (!targetUserId || !Array.isArray(tables) || !confirmationHash) {
        throw new functions.https.HttpsError('invalid-argument', 'Payload incompleto.');
    }

    // 4. Filtragem por Whitelist
    const validTables = tables.filter(t => ALLOWED_TABLES.includes(t));
    if (validTables.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Nenhuma tabela válida selecionada.');
    }

    console.log(`[ADMIN RESET] Iniciado por ${callerUid} para o alvo ${targetUserId}. Tabelas: ${validTables.join(',')}`);

    try {
        const deletedStats: string[] = [];

        // 5. Execução Atômica por Tabela
        for (const tableName of validTables) {
            const collectionRef = db.collection(tableName);
            const query = collectionRef.where('userId', '==', targetUserId);
            
            // Limitado a 500 para atomicidade do Batch do Firestore
            const snapshot = await query.limit(500).get();

            if (snapshot.empty) continue;

            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            
            await batch.commit();
            deletedStats.push(tableName);
            console.log(`[ADMIN RESET] Sucesso na tabela ${tableName}: ${snapshot.size} docs removidos.`);
        }

        return {
            success: true,
            deletedTables: deletedStats
        };

    } catch (error: any) {
        console.error(`[ADMIN RESET ERROR]`, error);
        throw new functions.https.HttpsError('internal', 'Erro interno na deleção atômica.', error.message);
    }
});