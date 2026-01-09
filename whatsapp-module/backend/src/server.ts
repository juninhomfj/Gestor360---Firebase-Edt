import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import formidable from 'formidable';
import fs from 'fs';
import cors from 'cors';
import { createSessionDoc, getSessionDoc, saveContactsBatch, createCampaign, getCampaignStatus } from './firestoreStore.js';
import * as baileysAdapter from './adapters/baileysAdapter.js';
import * as officialAdapter from './adapters/officialAdapter.js';
import { CloudTasksClient } from '@google-cloud/tasks';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhoneToE164 } from './utils/phoneUtils.js';
import whatsappRoutes from './routes/whatsapp.routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }) as any);

// Middleware de Log para Render.com (Monitoramento de Latência)
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
       console.warn(`[RenderMonitor] SLOW_REQUEST: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});

const PORT = process.env.PORT || 3333;
const WA_KEY = process.env.WA_MODULE_KEY || '';
const USE_OFFICIAL = process.env.USE_OFFICIAL_WABA === 'true';

// Health Check Avançado para monitoramento no Render
app.get('/api/v1/health', async (req, res) => {
  res.json({ 
    status: 'UP', 
    timestamp: new Date().toISOString(),
    // Fix: Cast process to any to access Node-specific method uptime
    uptime: (process as any).uptime(),
    // Fix: Cast process to any to access Node-specific method memoryUsage
    memory: (process as any).memoryUsage().rss
  });
});

app.use('/whatsapp', whatsappRoutes);

const adapter = USE_OFFICIAL ? officialAdapter : baileysAdapter;

// --- SESSÕES ---

app.post('/api/v1/sessions/create', async (req, res) => {
  try {
    const sessionId = (req.body as any).sessionId || `sess_${Date.now()}`;
    await createSessionDoc(sessionId, { status: 'STARTING' });
    const initRes = await adapter.initSession(sessionId);
    
    console.info(`[WA_SESSION] Session created: ${sessionId}`);
    
    return res.json({ 
      sessionId, 
      status: (initRes as any).status || 'STARTED', 
      qr: (initRes as any).qr || null 
    });
  } catch (e: any) {
    console.error('[API] sessions.create error:', e.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', detail: e.message });
  }
});

app.get('/api/v1/sessions/:sessionId/status', async (req, res) => {
  try {
    const s = await getSessionDoc(req.params.sessionId);
    if (!s) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ 
      sessionId: req.params.sessionId, 
      status: s.status, 
      phone: s.phone || null 
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ [WA_SERVER] Operational on port ${PORT}`);
  console.log(`🚀 [HealthMonitor] Registering heartbeat for Render.com`);
});

export default app;