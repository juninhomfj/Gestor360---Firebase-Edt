
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Configuração Firebase
 * Prioriza variáveis de ambiente (Produção/Vercel).
 * Fallback para Sandbox apenas se as variáveis de ambiente não estiverem definidas.
 */
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyAobQQZcZkTxhZO12nWje2ubfVQR7ewTI0",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "gestor360-6dd17.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "gestor360-6dd17",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "gestor360-6dd17.appspot.com",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "1031626472436",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:1031626472436:web:dca4ae8435e945412157a1",
};

// Singleton pattern robusto: impede inicializações duplicadas que quebram o Auth
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

console.info(`[Firebase] Inicializado com sucesso para o projeto: ${firebaseConfig.projectId}`);
