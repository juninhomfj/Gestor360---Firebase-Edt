
import { WASyncConfig, WASyncPayload } from '../types';

export const DEFAULT_SYNC_CONFIG: WASyncConfig = {
  tablesToSync: ['wa_contacts', 'wa_campaigns', 'wa_manual_logs', 'wa_campaign_stats'],
  syncFrequency: 'DAILY',
  includeErrorDetails: true,
  compressLogsOlderThan: 30 
};

export const syncWhatsAppData = async (config: Partial<WASyncConfig> = {}, force: boolean = false): Promise<{ success: boolean; message: string }> => {
    return {
      success: true,
      message: 'Sincronização WhatsApp gerenciada pelo Firebase Firestore.'
    };
};

export const prepareWhatsAppSyncPayload = async (): Promise<WASyncPayload> => {
    return {
        contacts: [], campaigns: [], deliveryLogs: [], campaignStats: [],
        syncMetadata: { timestamp: '', deviceId: '', version: '', tablesIncluded: [], recordCounts: {} }
    };
};
