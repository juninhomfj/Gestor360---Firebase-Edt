
import { dbGet, dbPut, dbGetAll } from '../storage/db';
import { WAContact, WACampaign, WASpeed, WhatsAppErrorCode, ManualInteractionLog, CampaignStatistics, Sale } from '../types';
import { auth } from './firebase';

/**
 * Gerenciador central de logging para campanhas manuais
 */
export class WhatsAppManualLogger {
  
  /**
   * Inicia um novo log para uma interação
   */
  static async startInteraction(
    campaignId: string,
    contact: WAContact,
    campaignSpeed: WASpeed
  ): Promise<string> {
    const logId = crypto.randomUUID();
    
    // Fix: Included missing required property userId for ManualInteractionLog
    const log: ManualInteractionLog = {
      id: logId,
      campaignId,
      contactId: contact.id,
      phone: contact.phone,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      messageLength: 0, // Será atualizado
      tags: [...contact.tags],
      campaignSpeed,
      deviceInfo: this.getDeviceInfo(),
      userId: auth.currentUser?.uid || ''
    };
    
    await dbPut('wa_manual_logs', log);
    return logId;
  }
  
  /**
   * Registra uma etapa específica
   */
  static async logStep(
    logId: string,
    step: keyof ManualInteractionLog,
    data?: any
  ): Promise<void> {
    const log = await dbGet('wa_manual_logs', logId);
    if (!log) return;
    
    const timestamp = new Date().toISOString();
    const updates: Partial<ManualInteractionLog> = {};
    
    (updates as any)[step] = timestamp;
    
    // Fixed: Corrected timing calculations and property access
    if (step === 'whatsappOpenedAt' && log.messageCopiedAt) {
      const start = new Date(log.messageCopiedAt);
      const end = new Date(timestamp);
      updates.timeToOpenWhatsApp = end.getTime() - start.getTime();
    }
    
    if (step === 'messagePastedAt' && log.whatsappOpenedAt) {
      const start = new Date(log.whatsappOpenedAt);
      const end = new Date(timestamp);
      updates.timeToPaste = end.getTime() - start.getTime();
    }
    
    if (step === 'messageSentAt' && log.messagePastedAt) {
      const start = new Date(log.messagePastedAt);
      const end = new Date(timestamp);
      updates.timeToSend = end.getTime() - start.getTime();
    }
    
    if (step === 'completedAt' && log.startedAt) {
      const start = new Date(log.startedAt);
      const end = new Date(timestamp);
      updates.totalInteractionTime = end.getTime() - start.getTime();
      updates.status = 'COMPLETED';
    }
    
    await dbPut('wa_manual_logs', { ...log, ...updates });
  }
  
  /**
   * Marca uma interação como falha
   */
  static async logFailure(
    logId: string,
    errorType: WhatsAppErrorCode,
    description: string,
    screenshot?: string
  ): Promise<void> {
    const log = await dbGet('wa_manual_logs', logId);
    if (!log) return;
    
    await dbPut('wa_manual_logs', {
      ...log,
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      userReportedError: {
        type: errorType,
        description,
        screenshot
      }
    });
  }
  
  /**
   * Permite ao usuário adicionar notas
   */
  static async addUserNotes(
    logId: string,
    notes: string,
    rating?: 1 | 2 | 3 | 4 | 5
  ): Promise<void> {
    const log = await dbGet('wa_manual_logs', logId);
    if (!log) return;
    
    // Check if notes contain variant info to tag the log for analytics
    let variant: 'A' | 'B' | undefined = undefined;
    if (notes.includes('[Variante A]')) variant = 'A';
    if (notes.includes('[Variante B]')) variant = 'B';

    await dbPut('wa_manual_logs', {
      ...log,
      userNotes: notes,
      rating,
      variant
    });
  }

  /**
   * Calcula o ROI financeiro da campanha consultando vendas atribuídas
   */
  private static async getCampaignROI(campaignId: string): Promise<{ revenue: number, salesCount: number }> {
      try {
          const sales = await dbGetAll('sales');
          // Fixed: Access marketingCampaignId on Sale
          const campaignSales = sales.filter((s: Sale) => s.marketingCampaignId === campaignId);
          
          const revenue = campaignSales.reduce((acc, s) => acc + (s.valueSold * s.quantity), 0);
          return {
              revenue,
              salesCount: campaignSales.length
          };
      } catch (e) {
          return { revenue: 0, salesCount: 0 };
      }
  }
  
  /**
   * Gera estatísticas detalhadas de uma campanha
   */
  static async generateCampaignStatistics(
    campaignId: string
  ): Promise<CampaignStatistics> {
    const allLogs = await dbGetAll(
      'wa_manual_logs',
      log => log.campaignId === campaignId
    );
    
    const campaign = await dbGet('wa_campaigns', campaignId);
    
    const completedLogs = allLogs.filter(log => 
      log.status === 'COMPLETED' && log.totalInteractionTime
    );
    
    const failedLogs = allLogs.filter(log => log.status === 'FAILED');
    
    const times = completedLogs
      .map(log => log.totalInteractionTime!)
      .filter(Boolean);
    
    const avgTime = times.length > 0 
      ? times.reduce((a, b) => a + b, 0) / times.length / 1000
      : 0;
    
    const errorCounts: Record<string, number> = {};
    failedLogs.forEach(log => {
      if (log.userReportedError?.type) {
        errorCounts[log.userReportedError.type] = 
          (errorCounts[log.userReportedError.type] || 0) + 1;
      }
    });
    
    const mostCommonError = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    
    const stepTimes = {
      open: completedLogs.map(l => l.timeToOpenWhatsApp || 0).filter(t => t > 0),
      paste: completedLogs.map(l => l.timeToPaste || 0).filter(t => t > 0),
      send: completedLogs.map(l => l.timeToSend || 0).filter(t => t > 0)
    };
    
    const bottlenecks: string[] = [];
    const avgStepTimes = {
      open: stepTimes.open.length ? 
        stepTimes.open.reduce((a, b) => a + b, 0) / stepTimes.open.length : 0,
      paste: stepTimes.paste.length ? 
        stepTimes.paste.reduce((a, b) => a + b, 0) / stepTimes.paste.length : 0,
      send: stepTimes.send.length ? 
        stepTimes.send.reduce((a, b) => a + b, 0) / stepTimes.send.length : 0
    };
    
    if (avgStepTimes.open > 30000) bottlenecks.push('Abertura do WhatsApp Web');
    if (avgStepTimes.paste > 15000) bottlenecks.push('Colagem da mensagem');
    if (