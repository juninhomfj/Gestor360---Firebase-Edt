import express from 'express';
import { sendMessageBaileys } from './adapters/baileysAdapter';
import { sendMessageOfficial } from './adapters/officialAdapter';
import { saveMessage } from './firestoreStore';

const app = express();
app.use(express.json());

app.post('/tasks/execute', async (req, res) => {
  const authKey = req.headers['x-wa-module-key'];
  if (authKey !== process.env.WA_MODULE_KEY) return res.status(401).end();

  const { sessionId, to, body, mediaUrl, campaignId, recipientId } = req.body;

  try {
    const useOfficial = process.env.USE_OFFICIAL_WABA === 'true';
    const result = useOfficial 
      ? await sendMessageOfficial(sessionId, to, body, mediaUrl)
      : await sendMessageBaileys(sessionId, to, body, mediaUrl);

    await saveMessage({
      id: result.messageId || `msg_${Date.now()}`,
      campaignId,
      recipientId,
      status: 'SENT',
      sentAt: new Date().toISOString()
    });

    res.status(200).json({ status: 'OK' });
  } catch (error: any) {
    console.error(`Task failed for ${to}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Worker Cloud Run listening on ${PORT}`));
