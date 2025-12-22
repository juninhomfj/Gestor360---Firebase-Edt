
import { dbGet, dbPut, dbGetAll } from '../storage/db';
import { WAContact, WACampaign, WASpeed, WhatsAppErrorCode, ManualInteractionLog, CampaignStatistics, Sale } from '../types';

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
    
    // Fixed: Updated log creation with all required properties for ManualInteractionLog
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
      deviceInfo: this.getDeviceInfo()
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
    if (avgStepTimes.send > 10000) bottlenecks.push('Confirmação do envio');
    
    const insights = this.generateInsights(
      allLogs,
      completedLogs.length,
      failedLogs.length,
      bottlenecks
    );
    
    const ratings = allLogs
      .map(log => log.rating)
      .filter((rating): rating is 1 | 2 | 3 | 4 | 5 => rating !== undefined);
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    ratings.forEach(rating => ratingDistribution[rating]++);
    
    const performanceBySpeed = {} as Record<string, any>;
    const speeds: WASpeed[] = ['FAST', 'SAFE', 'SLOW'];
    
    speeds.forEach(speed => {
      const speedLogs = completedLogs.filter(l => l.campaignSpeed === speed);
      if (speedLogs.length > 0) {
        const avgTime = speedLogs
          .map(l => l.totalInteractionTime!)
          .reduce((a, b) => a + b, 0) / speedLogs.length / 1000;
        
        performanceBySpeed[speed] = {
          count: speedLogs.length,
          successRate: speedLogs.length / allLogs.filter(l => l.campaignSpeed === speed).length,
          averageTime: avgTime
        };
      }
    });

    // Financial ROI
    const roi = await this.getCampaignROI(campaignId);

    // A/B Test Analysis
    let abTestAnalysis = undefined;
    if (campaign?.abTest?.enabled) {
        const variantALogs = allLogs.filter(l => l.variant === 'A' || l.userNotes?.includes('[Variante A]'));
        const variantBLogs = allLogs.filter(l => l.variant === 'B' || l.userNotes?.includes('[Variante B]'));
        
        const successA = variantALogs.filter(l => l.status === 'COMPLETED').length;
        const successB = variantBLogs.filter(l => l.status === 'COMPLETED').length;
        
        const rateA = variantALogs.length > 0 ? successA / variantALogs.length : 0;
        const rateB = variantBLogs.length > 0 ? successB / variantBLogs.length : 0;
        
        let winner: 'A' | 'B' | 'TIE' | 'INCONCLUSIVE' = 'INCONCLUSIVE';
        if (variantALogs.length > 5 && variantBLogs.length > 5) {
            if (rateA > rateB + 0.05) winner = 'A';
            else if (rateB > rateA + 0.05) winner = 'B';
            else winner = 'TIE';
        }

        abTestAnalysis = {
            variantA: { count: variantALogs.length, success: successA, rate: rateA },
            variantB: { count: variantBLogs.length, success: successB, rate: rateB },
            winner
        } as any;
    }
    
    return {
      campaignId,
      generatedAt: new Date().toISOString(),
      
      // Métricas básicas
      totalContacts: campaign?.totalContacts || 0,
      attempted: allLogs.length,
      completed: completedLogs.length,
      skipped: allLogs.filter(l => l.status === 'SKIPPED').length,
      failed: failedLogs.length,
      
      // Métricas de tempo
      averageTimePerContact: avgTime,
      fastestContactTime: times.length > 0 ? Math.min(...times) / 1000 : 0,
      slowestContactTime: times.length > 0 ? Math.max(...times) / 1000 : 0,
      totalCampaignTime: times.reduce((a, b) => a + b, 0) / 1000,
      
      // Análise detalhada
      stepAnalysis: {
        averageTimeToOpenWhatsApp: avgStepTimes.open / 1000,
        averageTimeToPaste: avgStepTimes.paste / 1000,
        averageTimeToSend: avgStepTimes.send / 1000,
        bottlenecks
      },
      
      errorAnalysis: {
        totalErrors: failedLogs.length,
        byType: errorCounts,
        mostCommonError,
        errorRate: allLogs.length > 0 ? failedLogs.length / allLogs.length : 0
      },
      
      userRatings: {
        average: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        distribution: ratingDistribution
      },
      
      insights,
      performanceBySpeed,

      // ROI Data
      financialImpact: {
          revenue: roi.revenue,
          salesCount: roi.salesCount,
          conversionRate: completedLogs.length > 0 ? (roi.salesCount / completedLogs.length) : 0
      },

      // AB Test
      abTestAnalysis
    } as any;
  }
  
  private static generateInsights(
    logs: ManualInteractionLog[],
    completed: number,
    failed: number,
    bottlenecks: string[]
  ): Array<{type: 'SUGGESTION' | 'WARNING' | 'RECOMMENDATION'; message: string; priority: 'LOW' | 'MEDIUM' | 'HIGH'}> {
    const insights: Array<{type: 'SUGGESTION' | 'WARNING' | 'RECOMMENDATION'; message: string; priority: 'LOW' | 'MEDIUM' | 'HIGH'}> = [];
    
    if (bottlenecks.length > 0) {
      insights.push({
        type: 'WARNING',
        message: `Gargalos identificados: ${bottlenecks.join(', ')}. Considere otimizar esses passos.`,
        priority: 'MEDIUM'
      });
    }
    
    if (failed > 0) {
      const errorRate = failed / logs.length;
      if (errorRate > 0.3) {
        insights.push({
          type: 'WARNING',
          message: `Taxa de erro alta (${Math.round(errorRate * 100)}%). Revise os números de telefone e a mensagem.`,
          priority: 'HIGH'
        });
      }
    }
    
    if (completed > 10) {
      const avgTime = logs
        .filter(l => l.totalInteractionTime)
        .map(l => l.totalInteractionTime!)
        .reduce((a, b) => a + b, 0) / completed / 1000;
      
      if (avgTime > 120) { 
        insights.push({
          type: 'SUGGESTION',
          message: `Tempo médio por contato (${Math.round(avgTime)}s) está alto. Considere simplificar o processo.`,
          priority: 'MEDIUM'
        });
      }
    }
    
    const lowRatings = logs.filter(l => l.rating && l.rating <= 2).length;
    if (lowRatings > completed * 0.2) {
      insights.push({
        type: 'RECOMMENDATION',
        message: `${Math.round((lowRatings / completed) * 100)}% dos envios foram classificados como difíceis. Melhore as instruções.`,
        priority: 'HIGH'
      });
    }
    
    return insights;
  }
  
  private static getDeviceInfo(): ManualInteractionLog['deviceInfo'] {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    
    return {
      userAgent: ua,
      platform: navigator.platform,
      isMobile
    };
  }
  
  static async exportLogsToCSV(campaignId: string): Promise<string> {
    const logs = await dbGetAll(
      'wa_manual_logs',
      log => log.campaignId === campaignId
    );
    
    const headers = [
      'ID', 'Contato', 'Telefone', 'Status', 'Início', 'Término',
      'Tempo Total (s)', 'Tags', 'Erro', 'Notas', 'Avaliação', 'Variante'
    ];
    
    const rows = logs.map(log => [
      log.id,
      log.contactId,
      log.phone,
      log.status,
      log.startedAt,
      log.completedAt || '',
      log.totalInteractionTime ? (log.totalInteractionTime / 1000).toFixed(2) : '',
      log.tags.join(';'),
      log.userReportedError?.type || '',
      log.userNotes?.replace(/[,"\n]/g, ' ') || '',
      log.rating || '',
      log.variant || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }
}
