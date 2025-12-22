
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Fixed: Switched from import.meta.env to process.env to satisfy compiler and follow environmental variable guidelines
const firebaseConfig = {
  apiKey: (process.env as any).VITE_FIREBASE_API_KEY,
  authDomain: (process.env as any).VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (process.env as any).VITE_FIREBASE_PROJECT_ID,
  storageBucket: (process.env as any).VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (process.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (process.env as any).VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);

  console.info("[Firebase] Gestor360 conectado com sucesso.");
} catch (error) {
  console.error("[Firebase] Falha ao inicializar Firebase. Modo mock ativado.", error);

  // MOCK SEGURO
  // @ts-ignore
  authInstance = {
    onAuthStateChanged: (cb: any) => {
      cb(null);
      return () => {};
    },
    currentUser: null,
    signOut: async () => {},
    type: "mock",
  };

  // @ts-ignore
  dbInstance = { type: "mock" };
}

export const auth = authInstance;
export const db = dbInstance;
