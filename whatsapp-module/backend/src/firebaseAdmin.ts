/* Fix: Imported Buffer from 'buffer' to provide global access in Node ESM environment */
import { Buffer } from 'buffer';
import admin from 'firebase-admin';

const initFirebase = () => {
  if (admin.apps.length) return admin;
  // Prefer GOOGLE_APPLICATION_CREDENTIALS (path mounted in Cloud Run)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    return admin;
  }
  // Or accept base64 encoded service account JSON in env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    /* Fix: Used Buffer.from from explicit import */
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.SESSIONS_BUCKET
    });
    return admin;
  }
  // Fallback: attempt default credentials
  admin.initializeApp();
  return admin;
};

const app = initFirebase();
export const firestore = app.firestore();
export const storage = app.storage().bucket(process.env.SESSIONS_BUCKET || '');
export default app;