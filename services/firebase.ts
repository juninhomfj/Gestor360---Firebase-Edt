
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";

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

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Configura persistência robusta para evitar deslogues repentinos
setPersistence(auth, browserLocalPersistence);

// Ativa cache offline do Firestore para performance e resiliência
if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("[Firebase] Múltiplas abas abertas, persistência desativada nesta aba.");
        } else if (err.code === 'unimplemented') {
            console.warn("[Firebase] Navegador não suporta persistência offline.");
        }
    });
}

export const initMessaging = async (): Promise<Messaging | null> => {
    if (typeof window !== "undefined" && await isSupported()) {
        return getMessaging(app);
    }
    return null;
};
