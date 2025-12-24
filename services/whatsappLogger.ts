import { dbPut } from '../storage/db';
import { LogEntry, LogLevel, WAContact, ManualInteractionLog } from '../types';

const maskPhone = (phone: string) => {
    if (!phone) return '';
    return phone.length > 4 ? `*******${phone.slice(-4)}` : '****';
};

export const WhatsAppManualLogger = {
    async log(level: LogLevel, message: string, details?: any) {
        // Mask PII in details
        const safeDetails = details ? JSON.parse(JSON.stringify(details)) : {};
        if (safeDetails.phone) safeDetails.phone = maskPhone(safeDetails.phone);
        if (safeDetails.to) safeDetails.to = maskPhone(safeDetails.to);

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: safeDetails,
            userAgent: navigator.userAgent
        };

        try {
            await dbPut('audit_log', entry as any);
            if (process.env.NODE_ENV === 'development') {
                console.log(`[WA-LOG][${level}] ${message}`, safeDetails);
            }
        } catch (e) {
            console.error("Critical logger failure", e);
        }
    },

    info(message: string, details?: any) { this.log('INFO', message, details); },
    warn(message: string, details?: any) { this.log('WARN', message, details); },
    error(message: string, details?: any) { this.log('ERROR', message, details); },

    async startInteraction(campaignId: string, contact: WAContact, speed: string): Promise<string> {
        const logId = crypto.randomUUID();
        await this.info(`Iniciando interação manual para ${contact.name}`, { campaignId, logId, phone: contact.phone, speed });
        return logId;
    },

    async logStep(logId: string, step: keyof ManualInteractionLog) {
        await this.info(`Passo da interação: ${String(step)}`, { logId });
    },

    async generateCampaignStatistics(campaignId: string): Promise<any> {
        // Basic stub as per requirement
        return { campaignId, generatedAt: new Date().toISOString(), totalContacts: 0, attempted: 0, completed: 0, skipped: 0, failed: 0 };
    }
};
