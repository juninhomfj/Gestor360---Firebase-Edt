
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from "firebase/firestore";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getFunctions, Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const getEnv = (key: string): string => {
  return (import.meta as any).env?.[key] || (process as any).env?.[key] || "";
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || "AIzaSyAoHj36s8WBZlzjC1ekCa0evr4N7Eb8jhY",
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || "gestor360-app.firebaseapp.com",
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || "gestor360-app",
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || "gestor360-app.firebasestorage.app",
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || "461678740958",
  appId: getEnv('VITE_FIREBASE_APP_ID') || "1:461678740958:web:ecb53b055eddd70413494f",
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || "G-LMLPQN2PHQ"
};

const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// Ativação robusta do App Check (Proteção contra bots e acessos não autorizados)
if (typeof window !== "undefined") {
    // Nota: Em produção, VITE_RECAPTCHA_SITE_KEY deve estar no Render.com
    const recaptchaKey = getEnv('VITE_RECAPTCHA_SITE_KEY') || "6LcN_REPLACE_WITH_ACTUAL_KEY";
    
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true
    });
    console.info("[Security] Firebase App Check Shield Active.");
}

export const auth: Auth = getAuth(app);

export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const functions: Functions = getFunctions(app, 'us-central1');

setPersistence(auth, browserLocalPersistence);

export const initMessaging = async (): Promise<Messaging | null> => {
    if (typeof window !== "undefined" && await isSupported()) {
        return getMessaging(app);
    }
    return null;
};
