
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { initBaileys, sendMessageBaileys, closeBaileys } from './adapters/baileysAdapter';
import { initOfficial, sendMessageOfficial } from './adapters/officialAdapter';
import { getSession, saveContactsBatch, createCampaign, getCampaignStatus } from './firestoreStore';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth Middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-wa-module-key'];
  if (key !== process.env.WA_MODULE_KEY) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
};

app.use(authMiddleware);

// Sessions
app.post('/api/v1/sessions/create', async (req, res) => {
  const sessionId = req.body.sessionId || uuidv4();
  const useOfficial = process.env.USE_OFFICIAL_WABA === 'true';

  try {
    const result = useOfficial 
      ? await initOfficial(sessionId) 
      : await initBaileys(sessionId);
    
    // Fix: Added any cast to result to avoid spread type error with union types
    res.json({ sessionId, ...(result as any) });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', detail: error.message });
  }
});

app.get('/api/v1/sessions/:sessionId/status', async (req, res) => {
  const data = await getSession(req.params.sessionId);
  if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ sessionId: req.params.sessionId, status: data.status, phone: data.phone });
});

app.post('/api/v1/sessions/:sessionId/logout', async (req, res) => {
  await closeBaileys(req.params.sessionId);
  res.json({ status: 'OK' });
});

// Contacts
app.post('/api/v1/contacts/import', async (req, res) => {
  const { userId, contacts } = req.body;
  if (!userId || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'BAD_REQUEST' });
  }
  
  await saveContactsBatch(userId, contacts);
  res.json({ status: 'OK', count: contacts.length });
});

// Campaigns
app.post('/api/v1/campaigns', async (req, res) => {
  const { userId, campaign, recipients } = req.body;
  if (!userId || !campaign || !Array.isArray(recipients)) {
    return res.status(400).json({ error: 'BAD_REQUEST' });
  }

  const campaignId = await createCampaign(userId, campaign, recipients);
  
  // Here we would enqueue tasks for Cloud Tasks or BullMQ
  // ... enqueueing logic ...

  res.json({ campaignId, status: 'ENQUEUED' });
});

app.get('/api/v1/campaigns/:campaignId/status', async (req, res) => {
  const stats = await getCampaignStatus(req.params.campaignId);
  if (!stats) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(stats);
});

// Single Message
app.post('/api/v1/messages/send', async (req, res) => {
  const { sessionId, to, body, mediaUrl } = req.body;
  const useOfficial = process.env.USE_OFFICIAL_WABA === 'true';

  try {
    const result = useOfficial
      ? await sendMessageOfficial(sessionId, to, body, mediaUrl)
      : await sendMessageBaileys(sessionId, to, body, mediaUrl);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', detail: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[WhatsApp Backend] running on port ${PORT}`);
});
