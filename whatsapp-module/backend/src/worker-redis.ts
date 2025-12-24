
import { Worker, Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import * as baileysAdapter from './adapters/baileysAdapter.js';
import * as officialAdapter from './adapters/officialAdapter.js';
import { saveMessage, markRecipientSent } from './firestoreStore.js';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const USE_OFFICIAL = process.env.USE_OFFICIAL_WABA === 'true';
const adapter = USE_OFFICIAL ? officialAdapter : baileysAdapter;

console.log('👷 Worker Redis iniciado. Aguardando jobs...');

const worker = new Worker(
  'whatsapp-messages',
  async (job: Job) => {
    const { sessionId, to, body, mediaUrl, campaignId, recipientId } = job.data;
    
    console.log(`[Worker] Processando job ${job.id} para ${to}`);

    try {
      const result = await adapter.sendMessage(sessionId, to, body, mediaUrl);
      
      // Persistir resultado no Firestore
      await saveMessage({
        contactId: recipientId || null,
        fromMe: true,
        body,
        status: 'SENT',
        providerResult: result,
        createdAt: new Date()
      });

      if (campaignId && recipientId) {
        await markRecipientSent(campaignId, recipientId, { ok: true, provider: result });
      }

      return { status: 'SENT', result };
    } catch (error: any) {
      console.error(`[Worker] Erro no job ${job.id}:`, error.message);
      throw error; // BullMQ tentará novamente baseado na política de retry
    }
  },
  { 
    connection,
    limiter: {
      max: Number(process.env.DEFAULT_RATE_LIMIT || '30'),
      duration: 60000, // Por minuto
    }
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} concluído com sucesso.`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} falhou:`, err.message);
});

export const messageQueue = new Queue('whatsapp-messages', { connection });
