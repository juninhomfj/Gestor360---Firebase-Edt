
import { dbPut, dbGetAll, initDB } from '../storage/db';
import { LogEntry, LogLevel } from '../types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeForFirestore } from '../utils/firestoreUtils';

const LOG_STORE = 'audit_log';

export const Logger = {
    async log(level: LogLevel, message: string, details?: any) {
        const uid = auth.currentUser?.uid || 'anonymous';
        
        // Detecção de navegador simplificada
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const browser = isIOS ? 'Safari/iOS' : 'Generic/Mobile';

        const safeDetails = details ? sanitizeForFirestore(JSON.parse(JSON.stringify(details))) : null;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: safeDetails,
            userAgent: navigator.userAgent
        };

        try {
            // Persistência local (IDB) - Pode falhar em Safari Private
            try {
                await dbPut(LOG_STORE, entry);
            } catch (idbErr) {
                console.warn("[Logger] Falha ao gravar localmente:", idbErr);
            }
            
            // Persistência Cloud (Principal)
            if (auth.currentUser) {
                const cloudLogRef = doc(collection(db, "audit_log"));
                await setDoc(cloudLogRef, {
                    ...entry,
                    details: safeDetails,
                    userId: uid,
                    userName: auth.currentUser.displayName || 'System User',
                    browserInfo: browser,
                    deviceTime: new Date().toISOString(),
                    createdAt: serverTimestamp()
                });
            }

            // Console output em ambiente dev ou para erros críticos
            if (process.env.NODE_ENV === 'development' || level === 'ERROR' || level === 'CRASH') {
                console.log(`[${level}] ${message}`, details);
            }
        } catch (e) {
            // Em último caso, tenta pelo menos o console
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

    async getLogs(limitVal = 200): Promise<LogEntry[]> {
        try {
            const allLogs = await dbGetAll(LOG_STORE);
            return allLogs.sort((a: LogEntry, b: LogEntry) => b.timestamp - a.timestamp).slice(0, limitVal);
        } catch (e) {
            return [];
        }
    },

    async clearLogs() {
        try {
            const dbInst = await initDB();
            await dbInst.clear(LOG_STORE);
            this.info("Auditoria: Logs locais limpos pelo usuário.");
            return true;
        } catch (e) {
            return false;
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
