import { db } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const createSession = async (sessionId: string, data: any) => {
  const ref = db.collection('whatsapp_sessions').doc(sessionId);
  await ref.set({
    ...data,
    id: sessionId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
};

export const getSession = async (sessionId: string) => {
  const doc = await db.collection('whatsapp_sessions').doc(sessionId).get();
  return doc.exists ? doc.data() : null;
};

export const updateSessionStatus = async (sessionId: string, status: string, phone?: string) => {
  const ref = db.collection('whatsapp_sessions').doc(sessionId);
  await ref.update({
    status,
    ...(phone && { phone }),
    updatedAt: FieldValue.serverTimestamp()
  });
};

export const saveSessionAuthPath = async (sessionId: string, path: string) => {
  const ref = db.collection('whatsapp_sessions').doc(sessionId);
  await ref.update({
    auth_blob_path: path,
    updatedAt: FieldValue.serverTimestamp()
  });
};

export const saveContactsBatch = async (userId: string, contacts: any[]) => {
  const batch = db.batch();
  contacts.forEach(contact => {
    const id = contact.id || `wa_${contact.phone}`;
    const ref = db.collection('wa_contacts').doc(id);
    batch.set(ref, {
      ...contact,
      userId,
      id,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: contact.createdAt || FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
};

export const createCampaign = async (userId: string, campaign: any, recipients: any[]) => {
  const campaignId = campaign.id || `camp_${Date.now()}`;
  const batch = db.batch();

  // Create campaign doc
  const campRef = db.collection('wa_campaigns').doc(campaignId);
  batch.set(campRef, {
    ...campaign,
    id: campaignId,
    userId,
    status: 'ENQUEUED',
    totalContacts: recipients.length,
    sentCount: 0,
    createdAt: FieldValue.serverTimestamp()
  });

  // Add recipients to subcollection for scale
  recipients.forEach(rec => {
    const recId = rec.id || `rec_${rec.phone}`;
    const recRef = campRef.collection('recipients').doc(recId);
    batch.set(recRef, {
      ...rec,
      campaignId,
      status: 'PENDING',
      createdAt: FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  return campaignId;
};

export const saveMessage = async (msg: any) => {
  const id = msg.id || `msg_${Date.now()}`;
  await db.collection('wa_messages').doc(id).set({
    ...msg,
    createdAt: FieldValue.serverTimestamp()
  });
};

export const getCampaignStatus = async (campaignId: string) => {
  const doc = await db.collection('wa_campaigns').doc(campaignId).get();
  if (!doc.exists) return null;
  return doc.data();
};
