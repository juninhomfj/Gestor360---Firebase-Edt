
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAobQQZcZkTxhZO12nWje2ubfVQR7ewTI0",
  authDomain: "gestor360-6dd17.firebaseapp.com",
  projectId: "gestor360-6dd17",
  storageBucket: "gestor360-6dd17.firebasestorage.app",
  messagingSenderId: "1031626472436",
  appId: "1:1031626472436:web:7f15c633b5ad520e2157a1",
  measurementId: "G-CKCL3PTNV0"
};

let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  console.log("[Firebase] Infraestrutura Cloud Gestor360 conectada.");
} catch (error) {
  console.error("[Firebase] Erro ao inicializar Firebase. Operando em modo local.", error);
  // Fallback mock cases handled by code checks for dbInstance.type !== 'mock'
  // @ts-ignore
  authInstance = { onAuthStateChanged: (cb: any) => { cb(null); return () => {}; }, currentUser: null, signOut: async () => {}, type: 'mock' };
  // @ts-ignore
  dbInstance = { type: 'mock' };
}

export const auth = authInstance;
export const db = dbInstance;
