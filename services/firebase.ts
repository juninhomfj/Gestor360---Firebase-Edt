import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Detecta ambiente sandbox (Google AI Studio / runtime sem import.meta.env)
 */
const isSandboxRuntime =
  typeof import.meta === "undefined" ||
  !import.meta.env ||
  !import.meta.env.VITE_FIREBASE_API_KEY;

/**
 * CONFIGURAÇÃO FIREBASE
 * - Produção (Vercel): usa import.meta.env
 * - Sandbox (AI Studio): usa credenciais TEMPORÁRIAS
 */
const firebaseConfig = isSandboxRuntime
  ? {
      apiKey: "SUBSTITUA_API_KEY_SANDBOX",
      authDomain: "SUBSTITUA_PROJECT.firebaseapp.com",
      projectId: "SUBSTITUA_PROJECT_ID",
      storageBucket: "SUBSTITUA_PROJECT.appspot.com",
      messagingSenderId: "SUBSTITUA_SENDER_ID",
      appId: "SUBSTITUA_APP_ID",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

/**
 * FAIL RÁPIDO — não existe modo mock aqui
 */
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 10) {
  console.error("[Firebase] Configuração inválida:", firebaseConfig);
  throw new Error("Firebase não inicializado: API KEY ausente ou inválida");
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
