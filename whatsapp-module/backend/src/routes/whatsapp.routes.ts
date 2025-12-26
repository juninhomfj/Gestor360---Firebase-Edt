import { Router } from 'express';
import { EvolutionService } from '../services/evolution.service.js';

const router = Router();
const WA_KEY = process.env.WA_MODULE_KEY;

// Middleware de proteção específico para estas rotas
const protect = (req: any, res: any, next: any) => {
  const key = req.headers['x-wa-module-key'];
  if (!key || key !== WA_KEY) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
};

router.post('/connect', protect, async (req, res) => {
  try {
    const { instanceName } = req.body;
    if (!instanceName) return res.status(400).json({ error: 'instanceName required' });

    const exists = await EvolutionService.instanceExists(instanceName);
    if (!exists) {
      await EvolutionService.createInstance(instanceName);
    }

    const connection = await EvolutionService.connectInstance(instanceName);
    return res.json(connection);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/qr', protect, async (req, res) => {
  try {
    const { instanceName } = req.body;
    const connection = await EvolutionService.connectInstance(instanceName);
    return res.json(connection);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/send', protect, async (req, res) => {
  try {
    const { instanceName, phone, message } = req.body;
    if (!instanceName || !phone || !message) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    const result = await EvolutionService.sendText(instanceName, phone, message);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;