import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import formidable from 'formidable';
import fs from 'fs';
import { createSessionDoc, getSessionDoc, saveContactsBatch, createCampaign, getCampaignStatus } from './firestoreStore';
import * as baileysAdapter from './adapters/baileysAdapter';
import * as officialAdapter from './adapters/officialAdapter';
import { CloudTasksClient } from '@google-cloud/tasks';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
const PORT = process.env.PORT || 3333;

const WA_KEY = process.env.WA_MODULE_KEY || '';
const USE_OFFICIAL = (process.env.USE_OFFICIAL_WABA || 'false') === 'true';
const USE_CLOUD_TASKS = (process.env.USE_CLOUD_TASKS || 'true') === 'true';

// Auth middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1')) {
    const key = req.headers['x-wa-module-key'];
    if (!key || key !== WA_KEY) return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
});

const adapter = USE_OFFICIAL ? officialAdapter : baileysAdapter;
const tasksClient = USE_CLOUD_TASKS ? new CloudTasksClient() : null;

app.post('/api/v1/sessions/create', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || `sess_${Date.now()}`;
    await createSessionDoc(sessionId, { status: 'STARTING' });
    const initRes = await adapter.initSession(sessionId);
    return res.json({ sessionId, status: initRes.status || 'STARTED', qr: (initRes as any).qr || null });
  } catch (e) {
    console.error('sessions.create', maskError(e));
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/v1/sessions/:sessionId/status', async (req, res) => {
  const s = await getSessionDoc(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'NOT_FOUND' });
  return res.json({ sessionId: req.params.sessionId, status: s.status, phone: s.phone || null });
});

app.post('/api/v1/sessions/:sessionId/logout', async (req, res) => {
  try {
    await adapter.closeSession(req.params.sessionId);
    await createSessionDoc(req.params.sessionId, { status: 'CLOSED' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('sessions.logout', maskError(e));
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/v1/contacts/import', async (req, res) => {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'BAD_REQUEST', detail: 'invalid_form' });
    try {
      const file = (files.file as any)[0] || files.file;
      if (!file) return res.status(400).json({ error: 'BAD_REQUEST', detail: 'no_file' });
      const text = fs.readFileSync(file.filepath, 'utf8');
      const rows = parseCSV(text);
      const ok: any[] = [];
      for (const [idx, r] of rows.entries()) {
        const phone = normalizePhone(r.phone || r.telefone || r.number || '');
        if (!phone) continue;
        ok.push({ id: uuidv4(), name: r.name || 'Sem Nome', phone, optIn: true });
      }
      await saveContactsBatch(ok);
      return res.json({ created: ok.length });
    } catch (e) {
      console.error('contacts.import', maskError(e));
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });
});

app.post('/api/v1/campaigns', async (req, res) => {
  try {
    const { campaign, recipients } = req.body;
    if (!campaign || !Array.isArray(recipients)) return res.status(400).json({ error: 'BAD_REQUEST' });
    const cid = await createCampaign(campaign, recipients);
    return res.json({ campaignId: cid });
  } catch (e) {
    console.error('campaigns.create', maskError(e));
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/v1/campaigns/:campaignId/status', async (req, res) => {
  const s = await getCampaignStatus(req.params.campaignId);
  if (!s) return res.status(404).json({ error: 'NOT_FOUND' });
  return res.json(s);
});

const normalizePhone = (input: string) => {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 11) return digits;
  return null;
};

const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const result: any[] = [];
  if (lines.length === 0) return result;
  const header = lines[0].split(/[,;]+/).map(h => h.trim().toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]+/);
    const obj: any = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j] ? cols[j].trim() : '';
    result.push(obj);
  }
  return result;
};

const maskError = (e: any) => {
  try {
    const m = e.message || JSON.stringify(e);
    return m.replace(/\d{6,}/g, '*****');
  } catch {
    return 'error';
  }
};

app.listen(PORT, () => console.log(`WA module backend listening on ${PORT}`));