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

const PORT = process.env.PORT || 3333;
const WA_KEY = process.env.WA_MODULE_KEY || '';
const USE_OFFICIAL = process.env.USE_OFFICIAL_WABA === 'true';
const USE_CLOUD_TASKS = process.env.USE_CLOUD_TASKS === 'true';

// Middleware de Autenticação Legado para rotas v1
app.use((req: any, res: any, next: any) => {
  if (req.path.startsWith('/api/v1')) {
    const key = req.headers['x-wa-module-key'];
    if (!key || key !== WA_KEY) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
  }
  next();
});

// Novas rotas integradas com Evolution API
app.use('/whatsapp', whatsappRoutes);

const adapter = USE_OFFICIAL ? officialAdapter : baileysAdapter;
const tasksClient = USE_CLOUD_TASKS ? new CloudTasksClient() : null;

// --- SESSÕES ---

app.post('/api/v1/sessions/create', async (req, res) => {
  try {
    const sessionId = (req.body as any).sessionId || `sess_${Date.now()}`;
    await createSessionDoc(sessionId, { status: 'STARTING' });
    const initRes = await adapter.initSession(sessionId);
    
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

app.post('/api/v1/sessions/:sessionId/logout', async (req, res) => {
  try {
    await adapter.closeSession(req.params.sessionId);
    await createSessionDoc(req.params.sessionId, { status: 'CLOSED' });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[API] sessions.logout error:', e.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// --- CONTATOS ---

app.post('/api/v1/contacts/import', async (req, res) => {
  const form = formidable({ multiples: false });
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'BAD_REQUEST', detail: 'form_parse_error' });
    
    try {
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) return res.status(400).json({ error: 'BAD_REQUEST', detail: 'no_file' });
      
      const content = fs.readFileSync(file.filepath, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return res.status(400).json({ error: 'EMPTY_FILE' });

      const header = lines[0].split(/[,;]+/).map(h => h.trim().toLowerCase());
      const contacts: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]+/);
        const obj: any = {};
        header.forEach((h, idx) => obj[h] = cols[idx]?.trim());
        
        const rawPhone = obj.phone || obj.telefone || obj.number || '';
        const phone = normalizePhoneToE164(rawPhone);
        
        if (phone) {
          contacts.push({
            id: uuidv4(),
            name: obj.name || obj.nome || 'Sem Nome',
            phone,
            optIn: true,
            createdAt: new Date()
          });
        }
      }

      const max = Number(process.env.FRONTEND_MAX_IMPORT || '500');
      if (contacts.length > max) {
        return res.status(400).json({ error: 'LIMIT_EXCEEDED', detail: `Máximo ${max} contatos.` });
      }

      await saveContactsBatch(contacts);
      return res.json({ created: contacts.length });
    } catch (e: any) {
      console.error('[API] contacts.import error:', e.message);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });
});

// --- CAMPANHAS ---

app.post('/api/v1/campaigns', async (req, res) => {
  try {
    const { campaign, recipients } = req.body;
    if (!campaign || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'BAD_REQUEST', detail: 'invalid_payload' });
    }
    
    const campaignId = await createCampaign(campaign, recipients);
    
    return res.json({ campaignId, status: 'CREATED' });
  } catch (e: any) {
    console.error('[API] campaigns.create error:', e.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/v1/campaigns/:campaignId/status', async (req, res) => {
  try {
    const s = await getCampaignStatus(req.params.campaignId);
    if (!s) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(s);
  } catch (e: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ [WhatsApp Backend] Rodando na porta ${PORT}`);
  console.log(`🔗 Evolution API integrated at /whatsapp`);
});

export default app;