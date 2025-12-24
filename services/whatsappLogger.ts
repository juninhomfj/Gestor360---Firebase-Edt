
import { dbGet, dbPut, dbGetAll } from '../storage/db';
import { WAContact, WACampaign, WASpeed, WhatsAppErrorCode, ManualInteractionLog, CampaignStatistics, Sale } from '../types';
import { auth } from './firebase';

export class WhatsAppManualLogger {
  
  static async startInteraction(
    campaignId: string,
    contact: WAContact,
    campaignSpeed: WASpeed
  ): Promise<string> {
    const logId = crypto.randomUUID();
    
    const log: ManualInteractionLog = {
      id: logId,
      campaignId,
      contactId: contact.id,
      phone: contact.phone,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      messageLength: 0,
      tags: [...contact.tags],
      campaignSpeed,
      deviceInfo: this.getDeviceInfo(),
      userId: auth.currentUser?.uid || ''
    };
    
    await dbPut('wa_manual_logs', log);
    return logId;
  }
  
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
    
    if (step === 'completedAt' && log.startedAt) {
      const start = new Date(log.startedAt);
      const end = new Date(timestamp);
      updates.totalInteractionTime = end.getTime() - start.getTime();
      updates.status = 'COMPLETED';
    }
    
    await dbPut('wa_manual_logs', { ...log, ...updates });
  }
  
  static async logFailure(
    logId: string,
    errorType: WhatsAppErrorCode,
    description: string
  ): Promise<void> {
    const log = await dbGet('wa_manual_logs', logId);
    if (!log) return;
    
    await dbPut('wa_manual_logs', {
      ...log,
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      userReportedError: {
        type: errorType,
        description
      }
    });
  }

  static async generateCampaignStatistics(
    campaignId: string
  ): Promise<CampaignStatistics> {
    const allLogs = await dbGetAll('wa_manual_logs', log => log.campaignId === campaignId);
    const completedLogs = allLogs.filter(log => log.status === 'COMPLETED');
    const failedLogs = allLogs.filter(log => log.status === 'FAILED');
    
    const times = completedLogs.map(log => log.totalInteractionTime || 0).filter(t => t > 0);
    const avgTime = times.length > 0 ? (times.reduce((a, b) => a + b, 0) / times.length / 1000) : 0;
    
    // Calculate Financial ROI
    const sales = await dbGetAll('sales');
    const campaignSales = sales.filter((s: Sale) => s.marketingCampaignId === campaignId && !s.deleted);
    const revenue = campaignSales.reduce((acc, s) => acc + (s.valueSold * s.quantity), 0);
    const conversionRate = completedLogs.length > 0 ? campaignSales.length / completedLogs.length : 0;

    return {
      campaignId,
      generatedAt: new Date().toISOString(),
      totalContacts: allLogs.length,
      attempted: allLogs.length,
      completed: completedLogs.length,
      skipped: 0,
      failed: failedLogs.length,
      averageTimePerContact: avgTime,
      fastestContactTime: times.length > 0 ? Math.min(...times) / 1000 : 0,
      slowestContactTime: times.length > 0 ? Math.max(...times) / 1000 : 0,
      totalCampaignTime: times.reduce((a,b) => a + b, 0) / 1000,
      stepAnalysis: {
          averageTimeToOpenWhatsApp: 0,
          averageTimeToPaste: 0,
          averageTimeToSend: 0
      },
      errorAnalysis: {
          errorRate: (failedLogs.length / (allLogs.length || 1)) * 100,
          mostCommonError: '',
          byType: {}
      },
      userRatings: { average: 5, distribution: {} },
      insights: [],
      performanceBySpeed: {},
      financialImpact: {
          revenue,
          salesCount: campaignSales.length,
          conversionRate
      }
    };
  }

  private static getDeviceInfo() {
    return {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    };
  }
}
