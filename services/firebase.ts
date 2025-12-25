// services/firebase.ts

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Firebase – Configuração ÚNICA e determinística
 * Ambiente: Vite (import.meta.env)
 *
 * Regras assumidas:
 * - NÃO existe pasta src
 * - services/ está na raiz
 * - Este arquivo é a ÚNICA origem de app, auth e db
 * - Sem fallback inseguro para produção
 */

/**
 * Validação explícita de variáveis obrigatórias.
 * Se faltar qualquer uma, o app NÃO sobe.
 */
const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

for (const key of requiredEnv) {
  if (!(import.meta as any).env?.[key]) {
    throw new Error(`[Firebase] Variável de ambiente ausente: ${key}`);
  }
}

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID
};

// Singleton REAL – sem risco de múltiplas instâncias
const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

console.info(
  `[Firebase] Inicializado | projectId=${firebaseConfig.projectId}`
);
