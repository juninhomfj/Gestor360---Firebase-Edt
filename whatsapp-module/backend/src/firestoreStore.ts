import { firestore } from './firebaseAdmin';
import { WriteBatch } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const now = () => new Date();

export const createSessionDoc = async (sessionId: string, data: any = {}) => {
  const ref = firestore.collection('whatsapp_sessions').doc(sessionId);
  await ref.set({
    sessionId,
    status: data.status || 'CREATED',
    phone: data.phone || null,
    auth_blob_path: data.auth_blob_path || null,
    createdAt: now(),
    updatedAt: now()
  }, { merge: true });
  return ref;
};

export const getSessionDoc = async (sessionId: string) => {
  const snap = await firestore.collection('whatsapp_sessions').doc(sessionId).get();
  return snap.exists ? snap.data() : null;
};

export const saveSessionAuthPath = async (sessionId: string, path: string) => {
  await firestore.collection('whatsapp_sessions').doc(sessionId).set({
    auth_blob_path: path,
    updatedAt: now()
  }, { merge: true });
};

export const saveContact = async (contact: any) => {
  const id = contact.id || uuidv4();
  const ref = firestore.collection('wa_contacts').doc(id);
  await ref.set({
    id,
    ...contact,
    createdAt: contact.createdAt ? contact.createdAt : now(),
    updatedAt: now()
  }, { merge: true });
  return id;
};

export const saveContactsBatch = async (contacts: any[]) => {
  const batch = firestore.batch();
  contacts.forEach(c => {
    const id = c.id || uuidv4();
    const ref = firestore.collection('wa_contacts').doc(id);
    batch.set(ref, { id, ...c, createdAt: c.createdAt ? c.createdAt : now(), updatedAt: now() }, { merge: true });
  });
  await batch.commit();
};

export const createCampaign = async (campaign: any, recipients: any[]) => {
  const campaignId = campaign.id || uuidv4();
  const campRef = firestore.collection('wa_campaigns').doc(campaignId);
  const batch: WriteBatch = firestore.batch();
  batch.set(campRef, {
    id: campaignId,
    ...campaign,
    status: 'CREATED',
    createdAt: now(),
    updatedAt: now()
  });
  recipients.forEach(r => {
    const rid = r.id || uuidv4();
    const rRef = campRef.collection('recipients').doc(rid);
    batch.set(rRef, {
      id: rid,
      campaignId,
      contactId: r.contactId,
      phone: r.phone,
      status: 'PENDING',
      createdAt: now()
    });
  });
  await batch.commit();
  return campaignId;
};

export const markRecipientSent = async (campaignId: string, recipientId: string, result: any) => {
  const rRef = firestore.collection('wa_campaigns').doc(campaignId).collection('recipients').doc(recipientId);
  await rRef.set({ status: 'SENT', sentAt: now(), result }, { merge: true });
};

export const saveMessage = async (message: any) => {
  const id = message.id || uuidv4();
  const ref = firestore.collection('wa_messages').doc(id);
  await ref.set({
    id,
    ...message,
    createdAt: message.createdAt ? message.createdAt : now()
  }, { merge: true });
  return id;
};

export const getCampaignStatus = async (campaignId: string) => {
  const campRef = firestore.collection('wa_campaigns').doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) return null;
  const recipientsSnap = await campRef.collection('recipients').get();
  const total = recipientsSnap.size;
  const sent = recipientsSnap.docs.filter(d => d.data().status === 'SENT').length;
  const pending = recipientsSnap.docs.filter(d => d.data().status === 'PENDING').length;
  return { campaign: campSnap.data(), totals: { total, sent, pending } };
};