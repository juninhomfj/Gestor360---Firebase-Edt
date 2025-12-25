
import {
  LogEntry,
  LogLevel,
  WAContact,
  ManualInteractionLog
} from '../types';

import { auth, db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const maskPhone = (phone?: string) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 4
    ? `*******${digits.slice(-4)}`
    : '****';
};

const requireAuth = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Usuário não autenticado. Logger bloqueado.');
  }
  return uid;
};

export const WhatsAppManualLogger = {
  async log(level: LogLevel, message: string, details?: any) {
    const uid = requireAuth();

    const safeDetails = details
      ? JSON.parse(JSON.stringify(details))
      : {};

    if (safeDetails.phone) safeDetails.phone = maskPhone(safeDetails.phone);
    if (safeDetails.to) safeDetails.to = maskPhone(safeDetails.to);

    const id = crypto.randomUUID();

    /* Fix: Added missing timestamp to LogEntry */
    const entry: LogEntry & { userId: string } = {
      timestamp: Date.now(),
      level,
      message,
      details: safeDetails,
      userAgent: navigator.userAgent,
      userId: uid
    };

    try {
      // Firestore é a fonte de verdade (somente CREATE)
      await setDoc(
        doc(db, 'audit_log', id),
        {
          ...entry,
          createdAt: serverTimestamp()
        }
      );

      /* Fix: Replaced import.meta.env with process.env.NODE_ENV for more robust check in various environments */
      if (process.env.NODE_ENV === 'development') {
        console.log(`[WA-LOG][${level}] ${message}`, safeDetails);
      }
    } catch (e) {
      console.error('CRITICAL LOGGER FAILURE', e);
    }
  },

  info(message: string, details?: any) {
    return this.log('INFO', message, details);
  },

  warn(message: string, details?: any) {
    return this.log('WARN', message, details);
  },

  error(message: string, details?: any) {
    return this.log('ERROR', message, details);
  },

  async startInteraction(
    campaignId: string,
    contact: WAContact,
    speed: string
  ): Promise<string> {
    const logId = crypto.randomUUID();

    await this.info(
      `Iniciando interação manual para ${contact.name}`,
      {
        campaignId,
        logId,
        phone: contact.phone,
        speed
      }
    );

    return logId;
  },

  async logStep(
    logId: string,
    step: keyof ManualInteractionLog
  ) {
    await this.info(
      `Passo da interação: ${String(step)}`,
      { logId }
    );
  },

  /**
   * Stub controlado.
   * Estatísticas reais devem ser calculadas a partir de dados persistidos.
   */
  async generateCampaignStatistics(
    campaignId: string
  ): Promise<any> {
    requireAuth();

    return {
      campaignId,
      generatedAt: new Date().toISOString(),
      totalContacts: 0,
      attempted: 0,
      completed: 0,
      skipped: 0,
      failed: 0
    };
  }
};
