
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
  /* Fix: Added updateDoc to firestore imports */
  updateDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
/* Fix: Added missing encryptData and decryptData imports from encryption utility */
import { encryptData, decryptData } from '../utils/encryption';
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, Client, 
    ProductivityMetrics, Challenge, FinanceGoal, ImportMapping, UserPreferences
} from '../types';

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
    includeNonAccountingInTotal: false
};

// Carrega configuração mesclada: Global + Específica do Usuário
export const getSystemConfig = async (): Promise<SystemConfig & UserPreferences> => {
    // 1. Busca Configuração Global (Read-only para usuários normais)
    const globalSnap = await getDoc(doc(db, "config", "system"));
    const globalConfig = globalSnap.exists() ? globalSnap.data() as SystemConfig : DEFAULT_SYSTEM_CONFIG;

    // 2. Busca Preferências do Usuário (Isoladas por UID)
    const uid = auth.currentUser?.uid;
    if (uid) {
        const userSnap = await getDoc(doc(db, "config", `system_${uid}`));
        if (userSnap.exists()) {
            return { ...globalConfig, ...userSnap.data() as UserPreferences };
        }
    }

    return globalConfig;
};

/* Fix: Generalized saveSystemConfig to handle both UserPreferences and global SystemConfig updates */
export const saveSystemConfig = async (config: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    // Save user specific preferences
    const userPrefs: UserPreferences = {};
    if (config.theme) userPrefs.theme = config.theme;
    if (config.hideValues !== undefined) userPrefs.hideValues = config.hideValues;
    if (config.lastMode) userPrefs.lastMode = config.lastMode;
    if (config.lastTab) userPrefs.lastTab = config.lastTab;

    if (Object.keys(userPrefs).length > 0) {
        await setDoc(doc(db, "config", `system_${uid}`), userPrefs, { merge: true });
    }

    // Save global config if provided (typically only authorized for Admins)
    if (config.notificationSounds || config.fcmServerKey) {
        const globalConfig: any = {};
        if (config.notificationSounds) globalConfig.notificationSounds = config.notificationSounds;
        if (config.fcmServerKey) globalConfig.fcmServerKey = config.fcmServerKey;
        
        await setDoc(doc(db, "config", "system"), globalConfig, { merge: true });
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
    return isNaN(num) ? fallback : num;
  } catch (e) { return fallback; }
}

function sanitizeForFirestore(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Timestamp) return obj;
    if (obj instanceof Date) return Timestamp.fromDate(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        let val = obj[key];
        if (val === undefined) return;
        cleaned[key] = sanitizeForFirestore(val);
    });
    return cleaned;
}

async function getAuthenticatedUid(): Promise<string> {
    const user = auth.currentUser;
    if (user) return user.uid;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Auth Timeout")), 8000);
        const unsub = auth.onAuthStateChanged((u) => {
            if (u) { clearTimeout(timeout); unsub(); resolve(u.uid); }
        }, reject);
    });
}

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    SessionTraffic.trackRead(snap.size);
    const sales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
    await dbBulkPut('sales', sales);
    return sales;
};

export const saveSales = async (sales: Sale[]) => {
    const uid = await getAuthenticatedUid();
    const sanitized = sales.map(s => sanitizeForFirestore({ ...s, userId: uid, updatedAt: serverTimestamp() }));
    await dbBulkPut('sales', sanitized);
    const batch = writeBatch(db);
    sanitized.forEach(s => {
        const { id, ...data } = s;
        batch.set(doc(db, "sales", id), data, { merge: true });
        SessionTraffic.trackWrite();
    });
    await batch.commit();
};

export const saveSingleSale = async (payload: any) => {
  const uid = await getAuthenticatedUid();
  const saleId = payload.id || crypto.randomUUID();
  const saleData = sanitizeForFirestore({ ...payload, id: saleId, userId: uid, updatedAt: serverTimestamp() });
  await dbPut('sales', saleData);
  await setDoc(doc(db, "sales", saleId), saleData, { merge: true });
  SessionTraffic.trackWrite();
};

export const getFinanceData = async () => {
    const uid = await getAuthenticatedUid();
    const fetchSafe = async (col: string) => {
        const q = query(collection(db, col), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };
    const [acc, tx, crd, cat, gl, chal, cell, rec] = await Promise.all([
        fetchSafe("accounts"), fetchSafe("transactions"), fetchSafe("cards"), fetchSafe("categories"),
        fetchSafe("goals"), fetchSafe("challenges"), fetchSafe("challenge_cells"), fetchSafe("receivables")
    ]);
    return {
        accounts: acc as FinanceAccount[], transactions: tx as Transaction[], cards: crd as CreditCard[],
        categories: cat as TransactionCategory[], goals: gl as FinanceGoal[], 
        challenges: chal as Challenge[], cells: cell as ChallengeCell[], receivables: rec as Receivable[]
    };
};

export const saveFinanceData = async (acc: FinanceAccount[], crd: CreditCard[], tx: Transaction[], cat: TransactionCategory[], gl: FinanceGoal[] = [], chal: Challenge[] = [], rec: Receivable[] = []) => {
    const uid = await getAuthenticatedUid();
    const batch = writeBatch(db);
    const prep = (item: any) => sanitizeForFirestore({ ...item, userId: uid, updatedAt: serverTimestamp() });
    acc.forEach(i => batch.set(doc(db, "accounts", i.id), prep(i), { merge: true }));
    crd.forEach(i => batch.set(doc(db, "cards", i.id), prep(i), { merge: true }));
    cat.forEach(i => batch.set(doc(db, "categories", i.id), prep(i), { merge: true }));
    gl.forEach(i => batch.set(doc(db, "goals", i.id), prep(i), { merge: true }));
    chal.forEach(i => batch.set(doc(db, "challenges", i.id), prep(i), { merge: true }));
    rec.forEach(i => batch.set(doc(db, "receivables", i.id), prep(i), { merge: true }));
    tx.slice(-50).forEach(i => batch.set(doc(db, "transactions", i.id), prep(i), { merge: true }));
    await batch.commit();
    await Promise.all([dbBulkPut('accounts', acc), dbBulkPut('cards', crd), dbBulkPut('transactions', tx), dbBulkPut('categories', cat), dbBulkPut('goals', gl), dbBulkPut('challenges', chal), dbBulkPut('receivables', rec)]);
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const uid = await getAuthenticatedUid();
    const col = type === ProductType.BASICA ? 'commission_basic' : (type === ProductType.NATAL ? 'commission_natal' : 'commission_custom');
    const snap = await getDocs(query(collection(db, col), where("userId", "==", uid)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
};

export const computeCommissionValues = (qty: number, valProp: number, margin: number, rules: CommissionRule[]) => {
  const base = ensureNumber(valProp) * ensureNumber(qty);
  const rule = [...rules].sort((a,b) => b.minPercent - a.minPercent).find(r => ensureNumber(margin) >= r.minPercent);
  let rate = rule ? rule.commissionRate : 0;
  if (rate > 1) rate = rate / 100; 
  return { commissionBase: base, commissionValue: Math.round((base * rate + Number.EPSILON) * 100) / 100, rateUsed: rate };
};

export const saveReportConfig = async (cfg: ReportConfig) => {
    const uid = await getAuthenticatedUid();
    await setDoc(doc(db, "config", `report_${uid}`), cfg);
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const uid = await getAuthenticatedUid();
    const snap = await getDoc(doc(db, "config", `report_${uid}`));
    return snap.exists() ? snap.data() as ReportConfig : { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const getClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const snap = await getDocs(query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const uid = await getAuthenticatedUid();
    const col = type === ProductType.BASICA ? 'commission_basic' : (type === ProductType.NATAL ? 'commission_natal' : 'commission_custom');
    const batch = writeBatch(db);
    rules.forEach(r => batch.set(doc(db, col, r.id), { ...r, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    await batch.commit();
};

export const canAccess = (user: any, feature: string): boolean => {
    if (!user) return false;
    if (user.role === 'DEV' || user.role === 'ADMIN') return true; 
    return !!user.permissions?.[feature];
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
  const sales = await getStoredSales();
  const config = await getReportConfig();
  const now = new Date();
  const converted = sales.filter(s => {
    const d = new Date(s.date || s.completionDate || s.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  return { totalClients: 0, activeClients: 0, convertedThisMonth: converted, conversionRate: 0, productivityStatus: 'YELLOW' };
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
  const now = new Date();
  const today = now.getDate();
  let nextDay = salaryDays.find(d => d > today) || salaryDays[0];
  const nextDate = new Date(now.getFullYear(), now.getMonth() + (nextDay <= today ? 1 : 0), nextDay);
  const daysRem = Math.max(1, Math.ceil((nextDate.getTime() - now.getTime()) / 86400000));
  const pending = transactions.filter(t => t.type === 'EXPENSE' && !t.isPaid).reduce((acc, t) => acc + t.amount, 0);
  return { daysRemaining: daysRem, safeDailySpend: (balance - pending) / daysRem, pendingExpenses: pending, nextIncomeDate: nextDate };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
  const d = new Date(dateStr);
  if (d.getDate() >= closingDay) d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const exportEncryptedBackup = async (pass: string) => {
    const all = { sales: await dbGetAll('sales'), accounts: await dbGetAll('accounts'), transactions: await dbGetAll('transactions') };
    const blob = new Blob([encryptData(JSON.stringify(all))], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gestor360_backup.v360'; a.click();
};

export const importEncryptedBackup = async (file: File, pass: string) => {
    const text = await file.text();
    const data = JSON.parse(decryptData(text));
    if (data.sales) await dbBulkPut('sales', data.sales);
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: string): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const val = target / count;
    for (let i = 1; i <= count; i++) {
        cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING', userId: auth.currentUser?.uid || '', deleted: false });
    }
    return cells;
};

export const getTrashItems = async () => {
    const [sales, tx] = await Promise.all([dbGetAll('sales', s => !!s.deleted), dbGetAll('transactions', t => !!t.deleted)]);
    return { sales, transactions: tx };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const col = type === 'SALE' ? "sales" : "transactions";
    await updateDoc(doc(db, col, item.id), { deleted: false, updatedAt: serverTimestamp() });
    await dbPut(col as any, { ...item, deleted: false });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const col = type === 'SALE' ? "sales" : "transactions";
    await deleteDoc(doc(db, col, id));
    await dbDelete(col as any, id);
};

export const atomicClearUserTables = async (uid: string, tables: string[]) => {
    for (const table of tables) {
        const q = query(collection(db, table), where("userId", "==", uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    }
};

/* Fix: Implemented clearAllSales for BackupModal compatibility */
export const clearAllSales = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    // Clear local IndexedDB
    const dbInst = await initDB();
    await dbInst.clear('sales');
};

/* Fix: Implemented clearLocalCache for App compatibility */
export const clearLocalCache = async () => {
    const dbInst = await initDB();
    const stores = ['sales', 'accounts', 'transactions', 'categories', 'goals', 'challenges', 'challenge_cells', 'receivables', 'clients'];
    for (const s of stores) {
        await dbInst.clear(s as any);
    }
};

export const bootstrapProductionData = async () => {};
export const findPotentialDuplicates = (s: Sale[]) => [];
export const smartMergeSales = (d: Sale[]): Sale => d[0];
export const getDeletedClients = async (): Promise<Client[]> => [];
export const restoreClient = async (id: string) => {};
export const permanentlyDeleteClient = async (id: string) => {};
export const analyzeClients = (s: Sale[], c: ReportConfig) => [];
export const analyzeMonthlyVolume = (s: Sale[], m: number) => [];
export const exportReportToCSV = (d: any[], f: string) => {};
export const readExcelFile = (f: File): Promise<any[][]> => Promise.resolve([]);
export const processFinanceImport = (d: any[][], m: ImportMapping): Transaction[] => [];
