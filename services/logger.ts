import { dbPut, dbGetAll, initDB } from '../storage/db';
import { LogEntry, LogLevel } from '../types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeForFirestore } from '../utils/firestoreUtils';

const LOG_STORE = 'audit_log';

export const Logger = {
    async log(level: LogLevel, message: string, details?: any) {
        const uid = auth.currentUser?.uid || 'anonymous';
        
        // Detecção de plataforma robusta para auditoria Enterprise (Etapa 4)
        const ua = navigator.userAgent;
        let platform = 'Web-Generic';
        
        if (/android/i.test(ua)) platform = 'Mobile-Android';
        else if (/iphone|ipad|ipod/i.test(ua)) platform = 'Mobile-iOS';
        else if (/macintosh/i.test(ua)) platform = 'Desktop-Mac';
        else if (/windows/i.test(ua)) platform = 'Desktop-Windows';

        const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        const safeDetails = details ? sanitizeForFirestore(JSON.parse(JSON.stringify(details))) : null;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: {
                ...safeDetails,
                platform,
                isPWA,
                screen: `${window.innerWidth}x${window.innerHeight}`,
                appMode: localStorage.getItem('sys_last_mode') || 'unknown'
            },
            userAgent: ua.substring(0, 100)
        };

        try {
            // Persistência local (IDB)
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
                    userId: uid,
                    userName: auth.currentUser.displayName || 'System User',
                    browserInfo: platform,
                    deviceTime: new Date().toISOString(),
                    createdAt: serverTimestamp()
                });
            }

            if (process.env.NODE_ENV === 'development' || level === 'ERROR' || level === 'CRASH') {
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
