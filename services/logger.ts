
import { dbPut, dbGetAll } from '../storage/db';
import { LogEntry, LogLevel } from '../types';

const LOG_STORE = 'audit_log';

export const Logger = {
    async log(level: LogLevel, message: string, details?: any) {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: details ? JSON.parse(JSON.stringify(details)) : undefined, // Safe copy
            userAgent: navigator.userAgent
        };

        try {
            // Keep logs locally in IndexedDB
            await dbPut(LOG_STORE, entry);
            
            if (process.env.NODE_ENV === 'development') {
                console.log(`[${level}] ${message}`, details);
            }
        } catch (e) {
            console.error("Falha ao salvar log", e);
        }
    },

    info(message: string, details?: any) {
        this.log('INFO', message, details);
    },

    warn(message: string, details?: any) {
        this.log('WARN', message, details);
    },

    error(message: string, details?: any) {
        this.log('ERROR', message, details);
    },

    crash(error: Error, componentStack?: string) {
        this.log('CRASH', error.message, { stack: error.stack, componentStack });
    },

    async getLogs(limit = 100): Promise<LogEntry[]> {
        try {
            const allLogs = await dbGetAll(LOG_STORE);
            // Sort desc by timestamp
            return allLogs.sort((a: LogEntry, b: LogEntry) => b.timestamp - a.timestamp).slice(0, limit);
        } catch (e) {
            return [];
        }
    },

    async exportLogsToDrive(): Promise<boolean> {
        try {
            const logs = await this.getLogs(500); // Last 500 logs
            // Safe timestamp without colons for filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `crash_report_${timestamp}.json`;
            const content = JSON.stringify(logs, null, 2);
            
            // Download file locally
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            return true;
        } catch (e) {
            console.error("Erro ao exportar logs", e);
            return false;
        }
    }
};
