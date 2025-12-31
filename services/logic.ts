import {
  collection,
  query,
  where,
  getDocs,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
  writeBatch,
  deleteDoc,
  updateDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "./firebase";
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import { encryptData, decryptData } from '../utils/encryption';
import * as XLSX from 'xlsx';
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, Client, 
    ProductivityMetrics, Challenge, FinanceGoal, ImportMapping, UserPreferences,
    User, DuplicateGroup, NtfyPayload, ChallengeModel
} from '../types';
import { Logger } from './logger';
import { sendMessage } from './internalChat';

// --- SISTEMA DE LOGGING DETERMINÍSTICO (BUFFER CIRCULAR EM MEMÓRIA) ---
const MAX_LOG_BUFFER = 50;
const executionBuffer: Array<{ timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; module: string; action: string; details?: any }> = [];

/**
 * Registra um evento no buffer de memória para rastreabilidade de erros.
 */
const recordTrace = (level: 'INFO' | 'WARN' | 'ERROR', module: string, action: string, details?: any) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        module,
        action,
        details: details ? JSON.parse(JSON.stringify(details)) : null
    };
    executionBuffer.push(entry);
    if (executionBuffer.length > MAX_LOG_BUFFER) {
        executionBuffer.shift();
    }
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${level}] [${module}:${action}]`, details || '');
    }
};

/**
 * Reporta o estado atual do buffer de execução para administradores via internal_messages.
 * Garante que todos os usuários (incluindo DEV/ADMIN) possam emitir reportes.
 */
export const reportRuntimeError = async (context?: string) => {
    const user = auth.currentUser;
    if (!user) {
        recordTrace('WARN', 'SYSTEM', 'REPORT_ABORTED', { reason: 'Usuário não autenticado' });
        return;
    }

    recordTrace('INFO', 'SYSTEM', 'REPORT_MANUAL_TRIGGER', { context });

    const reportData = {
        meta: {
            uid: user.uid,
            email: user.email,
            timestamp: new Date().toISOString(),
            context: context || 'Reporte Manual',
            userAgent: navigator.userAgent
        },
        logs: [...executionBuffer]
    };

    const reportContent = `🚨 RELATÓRIO DE EXECUÇÃO DETERMINÍSTICO\n` +
        `Contexto: ${context || 'N/A'}\n` +
        `Usuário: ${user.email} (UID: ${user.uid})\n\n` +
        `Logs Detalhados:\n${JSON.stringify(reportData, null, 2)}`;

    try {
        await sendMessage(
            { id: user.uid, name: user.displayName || 'Usuário do Sistema' } as User,
            reportContent,
            'BUG_REPORT',
            'BROADCAST'
        );
        recordTrace('INFO', 'SYSTEM', 'REPORT_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'REPORT_FAILURE', { error: e.message });
        throw e;
    }
};

export const SessionTraffic = {
    reads: 0,
    writes: 0,
    lastActivity: null as Date | null,
    status: 'IDLE' as 'IDLE' | 'BUSY' | 'OFFLINE',
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    bootstrapVersion: 1,
    notificationSounds: { enabled: true, volume: 1, sound: '' },
    includeNonAccountingInTotal: false,
    notificationSound: '',
    alertSound: '',
    successSound: '',
    warningSound: ''
};

export const getSystemConfig = async (): Promise<SystemConfig & UserPreferences> => {
    recordTrace('INFO', 'CONFIG', 'LOAD_START');
    try {
        const globalSnap = await getDoc(doc(db, "config", "system"));
        const globalConfig = globalSnap.exists() ? { ...DEFAULT_SYSTEM_CONFIG, ...globalSnap.data() } as SystemConfig : DEFAULT_SYSTEM_CONFIG;
        SessionTraffic.trackRead();

        const uid = auth.currentUser?.uid;
        if (uid) {
            const userSnap = await getDoc(doc(db, "config", `system_${uid}`));
            SessionTraffic.trackRead();
            if (userSnap.exists()) {
                recordTrace('INFO', 'CONFIG', 'LOAD_USER_SUCCESS', { uid });
                return { ...globalConfig, ...userSnap.data() as UserPreferences };
            }
        }
        recordTrace('INFO', 'CONFIG', 'LOAD_GLOBAL_SUCCESS');
        return globalConfig;
    } catch (e: any) {
        recordTrace('ERROR', 'CONFIG', 'LOAD_FAIL', { error: e.message });
        throw e;
    }
};

export const saveSystemConfig = async (config: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        recordTrace('WARN', 'CONFIG', 'SAVE_ABORTED', { reason: 'Sem UID' });
        return;
    }
    
    recordTrace('INFO', 'CONFIG', 'SAVE_START', { uid });
    try {
        const userPrefs: UserPreferences & { userId: string } = { userId: uid };
        if (config.theme) userPrefs.theme = config.theme;
        if (config.hideValues !== undefined) userPrefs.hideValues = config.hideValues;
        if (config.lastMode) userPrefs.lastMode = config.lastMode;
        if (config.lastTab) userPrefs.lastTab = config.lastTab;

        await setDoc(doc(db, "config", `system_${uid}`), userPrefs, { merge: true });
        SessionTraffic.trackWrite();

        const globalFields = [
            'notificationSounds', 'fcmServerKey', 'ntfyTopic', 
            'notificationSound', 'alertSound', 'successSound', 'warningSound'
        ];

        const globalConfig: any = {};
        globalFields.forEach(field => {
            if (config[field] !== undefined) globalConfig[field] = config[field];
        });

        if (Object.keys(globalConfig).length > 0) {
            await setDoc(doc(db, "config", "system"), globalConfig, { merge: true });
            SessionTraffic.trackWrite();
        }
        recordTrace('INFO', 'CONFIG', 'SAVE_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'CONFIG', 'SAVE_FAIL', { error: e.message });
        throw e;
    }
};

export const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function ensureNumber(value: any, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  try {
    let str = String(value).trim().replace(/\s/g, ''); 
    if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.includes(',')) str = str.replace(',', '.');
    str = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    if (isNaN(num)) {
        recordTrace('WARN', 'PARSER', 'NAN_DETECTED', { input: value, fallback });
        return fallback;
    }
    return num;
  } catch (e: any) { 
      recordTrace('ERROR', 'PARSER', 'CRITICAL_ERROR', { input: value, error: e.message });
      throw e; // Proibido retorno silencioso em erro crítico
  }
}

export function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Timestamp) return obj;
    if (obj instanceof Date) return Timestamp.fromDate(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        let val = obj[key];
        cleaned[key] = val === undefined ? null : sanitizeForFirestore(val);
    });
    return cleaned;
}

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; 
    const allowed = !!(user.permissions as any)[feature];
    if (!allowed) recordTrace('WARN', 'AUTH', 'PERMISSION_DENIED', { user: user.uid, feature });
    return allowed;
};

// --- COMISSÕES GLOBAIS ---

const getColName = (type: ProductType): string => {
    return type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
};

const getLocalStoreName = (type: ProductType): string => {
    return type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colName = getColName(type);
    const storeName = getLocalStoreName(type);
    recordTrace('INFO', 'COMMISSIONS', 'SYNC_START', { type });

    try {
        const q = query(collection(db, colName), where("isActive", "==", true), limit(1));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);

        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const remoteVersion = docData.version;
            const localVersion = localStorage.getItem(`v_comm_${type}`);

            if (String(remoteVersion) !== localVersion) {
                recordTrace('INFO', 'COMMISSIONS', 'VERSION_MISMATCH_REPLACE', { remote: remoteVersion, local: localVersion });
                const rules: CommissionRule[] = (docData.tiers || []).map((t: any, idx: number) => ({
                    id: `${remoteVersion}_${idx}`,
                    minPercent: t.min,
                    maxPercent: t.max,
                    commissionRate: t.rate,
                    isActive: true
                }));

                const dbInst = await initDB();
                await dbInst.clear(storeName as any);
                await dbBulkPut(storeName as any, rules);
                localStorage.setItem(`v_comm_${type}`, String(remoteVersion));
                recordTrace('INFO', 'COMMISSIONS', 'SYNC_SUCCESS', { count: rules.length });
                return rules.sort((a, b) => a.minPercent - b.minPercent);
            }
        } else {
            recordTrace('WARN', 'COMMISSIONS', 'REMOTE_EMPTY', { type });
            const dbInst = await initDB();
            await dbInst.clear(storeName as any);
            localStorage.removeItem(`v_comm_${type}`);
            return [];
        }
    } catch (e: any) {
        recordTrace('ERROR', 'COMMISSIONS', 'SYNC_FAIL', { error: e.message });
        const localVersion = localStorage.getItem(`v_comm_${type}`);
        if (!localVersion) {
            throw new Error(`Módulo de Comissão [${type}] inacessível. Erro: ${e.message}`);
        }
    }
    
    const cached = await dbGetAll(storeName as any);
    recordTrace('INFO', 'COMMISSIONS', 'LOAD_FROM_CACHE', { count: cached.length });
    return (cached || []).sort((a: any, b: any) => a.minPercent - b.minPercent);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colName = getColName(type);
    const storeName = getLocalStoreName(type);
    const version = Date.now();
    recordTrace('INFO', 'COMMISSIONS', 'WRITE_FS_START', { type, version });

    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);

        snap.docs.forEach(d => {
            batch.update(d.ref, { isActive: false, inactivatedAt: serverTimestamp() });
        });

        const tiers = rules.map(r => ({
            min: r.minPercent,
            max: r.maxPercent,
            rate: r.commissionRate
        }));

        const newDocRef = doc(collection(db, colName));
        batch.set(newDocRef, {
            type: type === ProductType.NATAL ? "NATAL" : "BASICA",
            version,
            isActive: true,
            createdAt: serverTimestamp(),
            tiers
        });

        await batch.commit();
        SessionTraffic.trackWrite();
        
        const dbInst = await initDB();
        await dbInst.clear(storeName as any);
        await dbBulkPut(storeName as any, rules);
        localStorage.setItem(`v_comm_${type}`, String(version));
        recordTrace('INFO', 'COMMISSIONS', 'WRITE_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'COMMISSIONS', 'WRITE_FAIL', { error: e.message, type, code: e.code });
        throw e; // Garante que a UI trate o erro (ex: permission-denied)
    }
};

// --- SALES & CRM ---

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    recordTrace('INFO', 'SALES', 'LOAD_ALL', { uid });
    try {
        const sales = await dbGetAll('sales', (s) => s.userId === uid && !s.deleted);
        return sales;
    } catch (e: any) {
        recordTrace('ERROR', 'SALES', 'LOAD_FAIL', { error: e.message });
        throw e;
    }
};

export const saveSingleSale = async (sale: Sale) => {
    recordTrace('INFO', 'SALES', 'WRITE_FS_START', { id: sale.id });
    try {
        await dbPut('sales', sale);
        const syncRef = doc(db, 'sales', sale.id);
        await setDoc(syncRef, sanitizeForFirestore(sale), { merge: true });
        SessionTraffic.trackWrite();
        recordTrace('INFO', 'SALES', 'WRITE_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'SALES', 'WRITE_FAIL', { error: e.message, code: e.code });
        throw e;
    }
};

export const saveSales = async (sales: Sale[]) => {
    recordTrace('INFO', 'SALES', 'WRITE_BATCH_START', { count: sales.length });
    try {
        const batch = writeBatch(db);
        for (const sale of sales) {
            await dbPut('sales', sale);
            const ref = doc(db, 'sales', sale.id);
            batch.set(ref, sanitizeForFirestore(sale), { merge: true });
        }
        await batch.commit();
        SessionTraffic.trackWrite(sales.length);
        recordTrace('INFO', 'SALES', 'WRITE_BATCH_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'SALES', 'WRITE_BATCH_FAIL', { error: e.message, code: e.code });
        throw e;
    }
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const rule = rules.find(r => margin >= r.minPercent && (r.maxPercent === null || margin < r.maxPercent));
    const rateUsed = rule ? rule.commissionRate : 0;
    const commissionValue = commissionBase * rateUsed;
    if (!rule) recordTrace('WARN', 'SALES', 'NO_MATCHING_RULE', { margin });
    return { commissionBase, commissionValue, rateUsed };
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    recordTrace('INFO', 'CRM', 'DUPLICATE_CHECK_START', { count: sales.length });
    const names = Array.from(new Set(sales.map(s => s.client)));
    const groups: { master: string, similar: string[] }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < names.length; i++) {
        const nameA = names[i];
        if (seen.has(nameA)) continue;
        const group = { master: nameA, similar: [] as string[] };
        seen.add(nameA);

        for (let j = i + 1; j < names.length; j++) {
            const nameB = names[j];
            if (seen.has(nameB)) continue;
            
            const normA = nameA.toLowerCase().trim();
            const normB = nameB.toLowerCase().trim();
            if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
                group.similar.push(nameB);
                seen.add(nameB);
            }
        }
        if (group.similar.length > 0) groups.push(group);
    }
    return groups;
};

export const smartMergeSales = (duplicates: Sale[]): Sale => {
    recordTrace('INFO', 'CRM', 'MERGE_TRIGGERED', { count: duplicates.length });
    return duplicates.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
};

// --- ANALYTICS ---

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    recordTrace('INFO', 'CRM', 'CLIENT_ANALYTICS_START');
    const clientsMap = new Map<string, any>();
    const now = new Date().getTime();

    sales.forEach(s => {
        if (!clientsMap.has(s.client)) {
            clientsMap.set(s.client, { name: s.client, totalSpent: 0, totalOrders: 0, lastPurchaseDate: s.date || s.completionDate, status: 'ACTIVE' });
        }
        const c = clientsMap.get(s.client);
        const sDate = new Date(s.date || s.completionDate || 0).getTime();
        c.totalSpent += s.valueSold * s.quantity;
        c.totalOrders += 1;
        if (sDate > new Date(c.lastPurchaseDate).getTime()) c.lastPurchaseDate = s.date || s.completionDate;
    });

    const metrics = Array.from(clientsMap.values());
    metrics.forEach(m => {
        const lastDate = new Date(m.lastPurchaseDate).getTime();
        const days = (now - lastDate) / (1000 * 60 * 60 * 24);
        m.daysSinceLastPurchase = Math.floor(days);
        if (days > config.daysForLost) m.status = 'LOST';
        else if (days > config.daysForInactive) m.status = 'INACTIVE';
        else if (days <= config.daysForNewClient) m.status = 'NEW';
        else m.status = 'ACTIVE';
    });

    return metrics;
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const data: any[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const name = d.toLocaleDateString('pt-BR', { month: 'short' });
        data.push({ name, basica: 0, natal: 0, month: d.getMonth(), year: d.getFullYear() });
    }

    sales.forEach(s => {
        const d = new Date(s.date || s.completionDate || 0);
        const bin = data.find(b => b.month === d.getMonth() && b.year === d.getFullYear());
        if (bin) {
            if (s.type === ProductType.BASICA) bin.basica += s.quantity;
            else bin.natal += s.quantity;
        }
    });
    return data;
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    recordTrace('INFO', 'CRM', 'PRODUCTIVITY_METRICS_START', { userId });
    const sales = await getStoredSales();
    const metrics = analyzeClients(sales, { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 });
    const active = metrics.filter(m => m.status === 'ACTIVE' || m.status === 'NEW').length;
    const now = new Date();
    const convertedThisMonth = sales.filter(s => {
        const d = new Date(s.date || s.completionDate || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const rate = active > 0 ? (convertedThisMonth / active) * 100 : 0;
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (rate >= 70) status = 'GREEN';
    else if (rate >= 40) status = 'YELLOW';

    return {
        totalClients: metrics.length,
        activeClients: active,
        convertedThisMonth,
        conversionRate: rate,
        productivityStatus: status
    };
};

// --- FINANCE ---

export const getFinanceData = async () => {
    recordTrace('INFO', 'FINANCE', 'LOAD_LOCAL_ALL');
    const [accounts, cards, transactions, categories, goals, challenges, cells, receivables] = await Promise.all([
        dbGetAll('accounts'), dbGetAll('cards'), dbGetAll('transactions'), dbGetAll('categories'),
        dbGetAll('goals'), dbGetAll('challenges'), dbGetAll('challenge_cells'), dbGetAll('receivables')
    ]);
    return { accounts, cards, transactions, categories, goals, challenges, cells, receivables };
};

export const saveFinanceData = async (accounts: FinanceAccount[], cards: CreditCard[], transactions: Transaction[], categories: TransactionCategory[]) => {
    recordTrace('INFO', 'FINANCE', 'WRITE_BATCH_START', { txCount: transactions.length });
    try {
        await dbBulkPut('accounts', accounts);
        await dbBulkPut('cards', cards);
        await dbBulkPut('transactions', transactions);
        await dbBulkPut('categories', categories);
        
        const batch = writeBatch(db);
        accounts.forEach(a => batch.set(doc(db, 'accounts', a.id), sanitizeForFirestore(a), { merge: true }));
        transactions.forEach(t => batch.set(doc(db, 'transactions', t.id), sanitizeForFirestore(t), { merge: true }));
        await batch.commit();
        SessionTraffic.trackWrite(accounts.length + transactions.length);
        recordTrace('INFO', 'FINANCE', 'WRITE_BATCH_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'FINANCE', 'WRITE_BATCH_FAIL', { error: e.message, code: e.code });
        throw e;
    }
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    recordTrace('INFO', 'FINANCE', 'PACING_CALC_START', { balance });
    const now = new Date();
    const nextSalaryDay = salaryDays.find(d => d > now.getDate()) || salaryDays[0];
    const nextIncomeDate = new Date(now.getFullYear(), now.getMonth() + (nextSalaryDay <= now.getDate() ? 1 : 0), nextSalaryDay);
    const daysRemaining = Math.ceil((nextIncomeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const pendingExpenses = transactions
        .filter(t => !t.isPaid && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = (balance - pendingExpenses) / (daysRemaining || 1);
    recordTrace('INFO', 'FINANCE', 'PACING_CALC_RESULT', { safeDailySpend });
    return { daysRemaining, safeDailySpend, pendingExpenses, nextIncomeDate };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    if (d.getDate() > closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// --- DATA IMPORT/EXPORT ---

export const exportReportToCSV = (data: any[], filename: string) => {
    recordTrace('INFO', 'SYSTEM', 'EXPORT_CSV', { filename, rows: data.length });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${filename}.csv`);
};

export const readExcelFile = async (file: File): Promise<any[][]> => {
    recordTrace('INFO', 'SYSTEM', 'READ_EXCEL_START', { name: file.name });
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            recordTrace('INFO', 'SYSTEM', 'READ_EXCEL_SUCCESS', { rows: rows.length });
            resolve(rows);
        };
        reader.onerror = (e: any) => {
            recordTrace('ERROR', 'SYSTEM', 'READ_EXCEL_FAIL', { error: e.message });
            reject(e);
        };
        reader.readAsBinaryString(file);
    });
};

export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    recordTrace('INFO', 'FINANCE', 'IMPORT_PROCESS_START', { rows: data.length });
    const rows = data.slice(1);
    return rows.map(row => {
        const tx: any = { id: crypto.randomUUID(), deleted: false, createdAt: new Date().toISOString() };
        if (mapping.date !== -1) tx.date = new Date(row[mapping.date]).toISOString().split('T')[0];
        if (mapping.description !== -1) tx.description = String(row[mapping.description]);
        if (mapping.amount !== -1) {
            const val = ensureNumber(row[mapping.amount]);
            tx.amount = Math.abs(val);
            tx.type = val >= 0 ? 'INCOME' : 'EXPENSE';
        }
        if (mapping.type !== -1) {
            const t = String(row[mapping.type]).toUpperCase();
            if (t.includes('SAÍDA') || t.includes('EXPENSE')) tx.type = 'EXPENSE';
            else if (t.includes('ENTRADA') || t.includes('INCOME')) tx.type = 'INCOME';
        }
        tx.isPaid = true;
        return tx;
    });
};

export const downloadSalesTemplate = () => {
    const data = [{
        client: "Nome do Cliente",
        quantity: 10,
        type: "Cesta Básica",
        valueProposed: 150.00,
        valueSold: 1450.00,
        margin: 12.5,
        date: "2024-05-15",
        completionDate: "2024-05-10",
        obs: "Observação opcional"
    }];
    exportReportToCSV(data, "modelo_importacao_vendas");
};

// --- BACKUP ---

export const exportEncryptedBackup = async (passphrase: string) => {
    recordTrace('INFO', 'SYSTEM', 'BACKUP_EXPORT_START');
    try {
        const stores = ['sales', 'accounts', 'transactions', 'cards', 'categories', 'goals', 'challenges', 'challenge_cells', 'receivables', 'config', 'clients'];
        const data: any = {};
        for (const s of stores) {
            data[s] = await dbGetAll(s as any);
        }
        const json = JSON.stringify(data);
        const encrypted = encryptData(json);
        const blob = new Blob([encrypted], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gestor360_backup_${new Date().getTime()}.v360`;
        a.click();
        recordTrace('INFO', 'SYSTEM', 'BACKUP_EXPORT_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'BACKUP_EXPORT_FAIL', { error: e.message });
        throw e;
    }
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    recordTrace('INFO', 'SYSTEM', 'BACKUP_IMPORT_START', { name: file.name });
    try {
        const text = await file.text();
        const decrypted = decryptData(text);
        if (!decrypted) {
            recordTrace('ERROR', 'SYSTEM', 'BACKUP_IMPORT_DECRYPT_FAIL');
            throw new Error("Falha na descriptografia. Chave incorreta?");
        }
        const data = JSON.parse(decrypted);
        for (const store of Object.keys(data)) {
            await dbBulkPut(store as any, data[store]);
        }
        recordTrace('INFO', 'SYSTEM', 'BACKUP_IMPORT_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'BACKUP_IMPORT_FAIL', { error: e.message });
        throw e;
    }
};

export const clearAllSales = async () => {
    recordTrace('WARN', 'SALES', 'MASS_DELETE_START');
    const sales = await getStoredSales();
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const s of sales) {
        const updated = { ...s, deleted: true, deletedAt: now };
        await dbPut('sales', updated);
        batch.update(doc(db, 'sales', s.id), { deleted: true, deletedAt: now });
    }
    await batch.commit();
    recordTrace('INFO', 'SALES', 'MASS_DELETE_SUCCESS');
};

// --- OTHERS ---

export const generateChallengeCells = (challengeId: string, targetValue: number, depositCount: number, model: ChallengeModel): ChallengeCell[] => {
    recordTrace('INFO', 'FINANCE', 'CHALLENGE_GENERATE', { challengeId, model });
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    if (model === 'PROPORTIONAL') {
        const val = targetValue / depositCount;
        for (let i = 1; i <= depositCount; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING', userId: uid, deleted: false });
        }
    } else {
        const factor = targetValue / ((depositCount * (depositCount + 1)) / 2);
        for (let i = 1; i <= depositCount; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: i * factor, status: 'PENDING', userId: uid, deleted: false });
        }
    }
    return cells;
};

export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    recordTrace('WARN', 'ADMIN', 'REMOTE_RESET_TRIGGERED', { target: userId, tables });
    try {
        const fn = httpsCallable(functions, 'adminHardResetUserData');
        await fn({ targetUserId: userId, tables });
        recordTrace('INFO', 'ADMIN', 'REMOTE_RESET_SUCCESS');
    } catch (e: any) {
        recordTrace('ERROR', 'ADMIN', 'REMOTE_RESET_FAIL', { error: e.message });
        throw e;
    }
};

export const bootstrapProductionData = async () => {
    recordTrace('INFO', 'SYSTEM', 'BOOTSTRAP_START');
    try {
        const cfg = await getSystemConfig();
        if (cfg.bootstrapVersion < 1) {
            await saveSystemConfig({ ...cfg, bootstrapVersion: 1 });
            recordTrace('INFO', 'SYSTEM', 'BOOTSTRAP_UPGRADE_1');
        }
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'BOOTSTRAP_FAIL', { error: e.message });
    }
};

export const clearLocalCache = async () => {
    recordTrace('WARN', 'SYSTEM', 'LOCAL_CACHE_PURGE');
    localStorage.clear();
    const dbInst = await initDB();
    const stores = dbInst.objectStoreNames;
    for (const s of Array.from(stores)) {
        await dbInst.clear(s as any);
    }
    recordTrace('INFO', 'SYSTEM', 'LOCAL_CACHE_PURGE_COMPLETE');
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const snap = await dbGet('config', 'report_config');
    return (snap as any) || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    recordTrace('INFO', 'CONFIG', 'REPORT_CONFIG_SAVE');
    try {
        await dbPut('config', { id: 'report_config', ...config } as any);
        await setDoc(doc(db, 'config', 'report_config'), config, { merge: true });
    } catch (e: any) {
        recordTrace('ERROR', 'CONFIG', 'REPORT_CONFIG_FAIL', { error: e.message });
        throw e;
    }
};

export const getClients = async (): Promise<Client[]> => {
    return await dbGetAll('clients', c => !c.deleted);
};

// --- TRASH & RESTORE ---

export const getTrashItems = async () => {
    const [sales, transactions] = await Promise.all([
        dbGetAll('sales', s => s.deleted),
        dbGetAll('transactions', t => t.deleted)
    ]);
    return { sales, transactions };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    recordTrace('INFO', 'SYSTEM', 'RESTORE_ITEM', { type, id: item.id });
    try {
        const updated = { ...item, deleted: false, deletedAt: null };
        const store = type === 'SALE' ? 'sales' : 'transactions';
        await dbPut(store as any, updated);
        await updateDoc(doc(db, store, item.id), { deleted: false, deletedAt: null });
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'RESTORE_ITEM_FAIL', { error: e.message });
        throw e;
    }
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    recordTrace('WARN', 'SYSTEM', 'PERMANENT_DELETE', { type, id });
    try {
        const store = type === 'SALE' ? 'sales' : 'transactions';
        await dbDelete(store as any, id);
        await deleteDoc(doc(db, store, id));
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'PERMANENT_DELETE_FAIL', { error: e.message });
        throw e;
    }
};

export const getDeletedClients = async (): Promise<Client[]> => {
    return await dbGetAll('clients', c => c.deleted);
};

export const restoreClient = async (id: string) => {
    recordTrace('INFO', 'CRM', 'RESTORE_CLIENT', { id });
    try {
        const client = await dbGet('clients', id);
        if (client) {
            const updated = { ...client, deleted: false, deletedAt: null };
            await dbPut('clients', updated);
            await updateDoc(doc(db, 'clients', id), { deleted: false, deletedAt: null });
        }
    } catch (e: any) {
        recordTrace('ERROR', 'CRM', 'RESTORE_CLIENT_FAIL', { error: e.message });
        throw e;
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    recordTrace('WARN', 'CRM', 'PERMANENT_DELETE_CLIENT', { id });
    try {
        await dbDelete('clients', id);
        await deleteDoc(doc(db, 'clients', id));
    } catch (e: any) {
        recordTrace('ERROR', 'CRM', 'PERMANENT_DELETE_CLIENT_FAIL', { error: e.message });
        throw e;
    }
};
