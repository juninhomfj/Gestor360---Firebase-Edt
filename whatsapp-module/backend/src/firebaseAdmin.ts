import * as admin from 'firebase-admin';
import { Buffer } from 'node:buffer';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let credential;

if (serviceAccountJson) {
  const json = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString());
  credential = admin.credential.cert(json);
} else {
  credential = admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
    storageBucket: process.env.SESSIONS_BUCKET
  });
}

export const db = admin.firestore();
export const storage = admin.storage();
export const auth = admin.auth();
