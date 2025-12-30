
import { getToken, Messaging } from "firebase/messaging";
import { initMessaging } from "./firebase";
import { getSystemConfig } from "./logic";
/* Fix: Corrected updateUser import source from auth service */
import { updateUser } from "./auth";
import { User } from "../types";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

const VAPID_KEY = "BPEW_REPLACE_WITH_YOUR_ACTUAL_PUBLIC_VAPID_KEY_FROM_FIREBASE_CONSOLE";

/**
 * Solicita permissão e retorna o Token FCM do dispositivo atual
 */
export const requestAndSaveToken = async (userId: string): Promise<string | null> => {
    try {
        const messaging = await initMessaging();
        if (!messaging) return null;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return null;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
            // Salva o token no perfil do usuário para que outros possam enviar push para ele
            await updateUser(userId, { fcmToken: token });
            console.log("[Push] Token registrado:", token);
            return token;
        }
        return null;
    } catch (error) {
        console.error("[Push] Erro ao registrar token:", error);
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

    if (!serverKey) {
        console.warn("[Push] Envio cancelado: Server Key não configurada em Configurações > Sistema.");
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

    if (tokens.length === 0) return;

    // Envio via API REST Legada do FCM (compatível com a Server Key que o usuário possui)
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
            console.error("[Push] Falha no disparo para token:", token, e);
        }
    }
};
