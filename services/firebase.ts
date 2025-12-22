
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Detecta ambiente SANDBOX (Google AI Studio / runtime sem import.meta.env)
 */
const isSandboxRuntime =
  typeof (import.meta as any) === "undefined" ||
  !(import.meta as any).env ||
  !(import.meta as any).env.VITE_FIREBASE_API_KEY;

/**
 * Configuração Firebase
 * - SANDBOX: credenciais hardcoded (TEMPORÁRIO)
 * - PRODUÇÃO: variáveis de ambiente (Vercel)
 */
const firebaseConfig = isSandboxRuntime
  ? {
      apiKey: "AIzaSyAobQQZcZkTxhZO12nWje2ubfVQR7ewTI0",
      authDomain: "gestor360-6dd17.firebaseapp.com",
      projectId: "gestor360-6dd17",
      storageBucket: "gestor360-6dd17.appspot.com",
      messagingSenderId: "1031626472436",
      appId: "1:1031626472436:web:dca4ae8435e945412157a1",
    }
  : {
      apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
      authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
    };

/**
 * Fail-fast: Firebase não pode inicializar sem API Key válida
 */
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 10) {
  throw new Error(
    "[Firebase] Inicialização abortada: API Key ausente ou inválida."
  );
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
auth = getAuth(app);
db = getFirestore(app);

console.info(
  `[Firebase] Inicializado com sucesso (${isSandboxRuntime ? "SANDBOX" : "PRODUÇÃO"})`
);

export { auth, db };
