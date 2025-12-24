
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Configuração Firebase - Novo Projeto: gestor360-app
 * As variáveis são injetadas via .env
 */
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyAoHj36s8WBZlzjC1ekCa0evr4N7Eb8jhY",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "gestor360-app.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "gestor360-app",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "gestor360-app.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "461678740958",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:461678740958:web:ecb53b055eddd70413494f",
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || "G-LMLPQN2PHQ"
};

// Singleton: impede múltiplas instâncias
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

console.info(`[Firebase] Conectado ao projeto: ${firebaseConfig.projectId}`);
