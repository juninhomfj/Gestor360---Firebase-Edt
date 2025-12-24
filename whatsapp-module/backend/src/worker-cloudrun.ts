import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import * as adapterBaileys from './adapters/baileysAdapter';
import * as adapterOfficial from './adapters/officialAdapter';
import { saveMessage, markRecipientSent } from './firestoreStore';

dotenv.config();
const app = express();
/* Fix: Used express.json instead of bodyParser to resolve middleware overload mismatch and ensured correct typing */
app.use(express.json({ limit: '10mb' }) as any);
const WA_KEY = process.env.WA_MODULE_KEY || '';
const USE_OFFICIAL = (process.env.USE_OFFICIAL_WABA || 'false') === 'true';
const adapter = USE_OFFICIAL ? adapterOfficial : adapterBaileys;

app.post('/tasks/execute', async (req, res) => {
  const key = req.headers['x-wa-module-key'];
  if (!key || key !== WA_KEY) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const job = req.body;
    const result = await adapter.sendMessage(job.sessionId, job.to, job.body, job.mediaUrl);
    await saveMessage({
      contactId: job.recipientId || null,
      fromMe: true,
      body: job.body,
      status: 'SENT',
      providerResult: result
    });
    if (job.campaignId && job.recipientId) {
      await markRecipientSent(job.campaignId, job.recipientId, { ok: true, provider: result });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('task.execute error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default app;