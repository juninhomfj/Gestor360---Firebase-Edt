import { dbPut, dbGetAll } from '../storage/db';
import { LogEntry, LogLevel } from '../types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const LOG_STORE = 'audit_log';

export const Logger = {
    async log(level: LogLevel, message: string, details?: any) {
        const uid = auth.currentUser?.uid || 'anonymous';
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: details ? JSON.parse(JSON.stringify(details)) : undefined, 
            userAgent: navigator.userAgent
        };

        try {
            // 1. Persistência Local
            await dbPut(LOG_STORE, entry);
            
            // 2. Espelhamento em Nuvem (Auditoria Ativa)
            if (auth.currentUser) {
                const cloudLogRef = doc(collection(db, "audit_log"));
                await setDoc(cloudLogRef, {
                    ...entry,
                    userId: uid,
                    userName: auth.currentUser.displayName || 'System User',
                    createdAt: serverTimestamp()
                });
            }

            if (process.env.NODE_ENV === 'development') {
                console.log(`[${level}] ${message}`, details);
            }
        } catch (e) {
            console.error("Critical Failure: Audit Log Error", e);
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

    async getLogs(limit = 200): Promise<LogEntry[]> {
        try {
            const allLogs = await dbGetAll(LOG_STORE);
            return allLogs.sort((a: LogEntry, b: LogEntry) => b.timestamp - a.timestamp).slice(0, limit);
        } catch (e) {
            return [];
        }
    },

    async downloadLogs() {
        try {
            const logs = await this.getLogs(500);
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gestor360_diag_${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            return false;
        }
    },

    async exportLogsToDrive() {
        return this.downloadLogs();
    }
};
