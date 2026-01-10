
import { getToken } from "firebase/messaging";
import { initMessaging } from "./firebase";
import { getSystemConfig } from "./logic";
import { updateUser } from "./auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Chave VAPID para notificações push
const VAPID_KEY = "BPEW_REPLACE_WITH_YOUR_ACTUAL_PUBLIC_VAPID_KEY_FROM_FIREBASE_CONSOLE";

const isValidVapid = (key: string): boolean => {
    return !!key && 
           key.trim() !== "" && 
           !key.includes("REPLACE_WITH") && 
           !key.includes("PLACEHOLDER");
};

/**
 * Solicita permissão e retorna o Token FCM do dispositivo atual
 */
export const requestAndSaveToken = async (userId: string): Promise<string | null> => {
    try {
        if (!isValidVapid(VAPID_KEY)) {
            console.warn("⚠️ [Push] Registro cancelado: Chave VAPID inválida ou placeholder.");
            return null;
        }

        const messaging = await initMessaging();
        if (!messaging) return null;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.info("[Push] Permissão negada pelo usuário.");
            return null;
        }

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
            // Salva o token no perfil do usuário
            await updateUser(userId, { fcmToken: token });
            console.log("[Push] Token registrado com sucesso:", token);
            return token;
        }
        return null;
    } catch (error) {
        console.error("[Push] Erro crítico ao registrar token:", error);
        return null;
    }
};

/**
 * Envia uma notificação para um usuário específico ou para todos os Admins
 */
export const sendPushNotification = async (
    targetUserId: string | 'ADMIN_GROUP', 
    title: string, 
    body: string,
    data: any = {}
) => {
    const config = await getSystemConfig();
    const serverKey = (config as any).fcmServerKey;

    if (!serverKey || serverKey.trim() === "" || serverKey.includes("REPLACE_WITH")) {
        console.warn("[Push] Envio abortado: Server Key do Firebase (FCM) ausente ou inválida.");
        return;
    }

    let tokens: string[] = [];

    if (targetUserId === 'ADMIN_GROUP') {
        const q = query(collection(db, "profiles"), where("role", "==", "ADMIN"));
        const snap = await getDocs(q);
        tokens = snap.docs.map(d => d.data().fcmToken).filter(t => !!t);
    } else {
        const userSnap = await getDoc(doc(db, "profiles", targetUserId));
        if (userSnap.exists()) {
            const t = userSnap.data().fcmToken;
            if (t) tokens.push(t);
        }
    }

    if (tokens.length === 0) {
        console.info("[Push] Nenhum dispositivo com token válido encontrado para o alvo:", targetUserId);
        return;
    }

    // Envio via API REST Legada do FCM
    for (const token of tokens) {
        try {
            await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${serverKey}`
                },
                body: JSON.stringify({
                    to: token,
                    notification: {
                        title,
                        body,
                        sound: "default",
                        click_action: window.location.origin
                    },
                    data: {
                        ...data,
                        url: window.location.origin
                    }
                })
            });
        } catch (e) {
            console.error("[Push] Falha no disparo individual:", e);
        }
    }
};
