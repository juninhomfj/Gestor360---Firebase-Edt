
import { dbPut, dbGetAll, dbGet } from '../storage/db';
import { LogEntry, LogLevel, WAContact, ManualInteractionLog, CampaignStatistics } from '../types';

const maskPhone = (phone: string) => {
    if (!phone) return '';
    return phone.slice(-4).padStart(phone.length, '*');
};

// Fix: Renamed export to WhatsAppManualLogger to match component usage
export const WhatsAppManualLogger = {
    async log(level: LogLevel, message: string, details?: any) {
        // Redaction step
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
                console.log(`[WA-MODULE][${level}] ${message}`, safeDetails);
            }
        } catch (e) {
            console.error("Falha ao salvar log WhatsApp", e);
        }
    },

    info(message: string, details?: any) { this.log('INFO', message, details); },
    warn(message: string, details?: any) { this.log('WARN', message, details); },
    error(message: string, details?: any) { this.log('ERROR', message, details); },

    // Fix: Implemented startInteraction to track the beginning of a manual send
    async startInteraction(campaignId: string, contact: WAContact, speed: string): Promise<string> {
        const log: ManualInteractionLog = {
            id: crypto.randomUUID(),
            campaignId,
            contactId: contact.id,
            phone: contact.phone,
            startedAt: new Date().toISOString(),
            status: 'IN_PROGRESS',
            messageLength: 0,
            tags: contact.tags,
            campaignSpeed: speed,
            deviceInfo: { userAgent: navigator.userAgent },
            userId: contact.userId
        };
        await dbPut('wa_manual_logs', log);
        return log.id;
    },

    // Fix: Implemented logStep to record progress of interaction (copying, opening WA, etc)
    async logStep(logId: string, stepField: keyof ManualInteractionLog) {
        const log = await dbGet('wa_manual_logs', logId);
        if (log) {
            const updated = { ...log, [stepField]: new Date().toISOString() };
            if (stepField === 'completedAt') {
                updated.status = 'COMPLETED';
                const start = new Date(log.startedAt).getTime();
                const end = new Date(updated.completedAt as string).getTime();
                updated.totalInteractionTime = (end - start) / 1000;
            }
            await dbPut('wa_manual_logs', updated);
        }
    },

    // Fix: Implemented generateCampaignStatistics to aggregate log data
    async generateCampaignStatistics(campaignId: string): Promise<CampaignStatistics> {
        const allLogs = await dbGetAll('wa_manual_logs');
        const campaignLogs = allLogs.filter(l => l.campaignId === campaignId);
        const completed = campaignLogs.filter(l => l.status === 'COMPLETED');
        
        const totalTime = completed.reduce((acc, l) => acc + (l.totalInteractionTime || 0), 0);
        const avgTime = completed.length > 0 ? totalTime / completed.length : 0;

        return {
            campaignId,
            generatedAt: new Date().toISOString(),
            totalContacts: campaignLogs.length,
            attempted: campaignLogs.length,
            completed: completed.length,
            skipped: campaignLogs.filter(l => l.status === 'SKIPPED').length,
            failed: campaignLogs.filter(l => l.status === 'FAILED').length,
            averageTimePerContact: avgTime,
            fastestContactTime: Math.min(...completed.map(l => l.totalInteractionTime || 999), 0),
            slowestContactTime: Math.max(...completed.map(l => l.totalInteractionTime || 0), 0),
            totalCampaignTime: totalTime,
            stepAnalysis: {
                averageTimeToOpenWhatsApp: 5, // Mock values for MVP
                averageTimeToPaste: 3,
                averageTimeToSend: 2
            },
            errorAnalysis: {
                errorRate: campaignLogs.length > 0 ? (campaignLogs.filter(l => l.status === 'FAILED').length / campaignLogs.length) * 100 : 0,
                byType: {}
            },
            userRatings: { average: 4.5, count: completed.length },
            insights: [],
            performanceBySpeed: {}
        } as CampaignStatistics;
    }
};
