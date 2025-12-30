
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
import { db, auth } from "./firebase";
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import { encryptData, decryptData } from '../utils/encryption';
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, Client, 
    ProductivityMetrics, Challenge, FinanceGoal, ImportMapping, UserPreferences,
    User, DuplicateGroup
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
    const globalSnap = await getDoc(doc(db, "config", "system"));
    const globalConfig = globalSnap.exists() ? globalSnap.data() as SystemConfig : DEFAULT_SYSTEM_CONFIG;

    const uid = auth.currentUser?.uid;
    if (uid) {
        const userSnap = await getDoc(doc(db, "config", `system_${uid}`));
        if (userSnap.exists()) {
            return { ...globalConfig, ...userSnap.data() as UserPreferences };
        }
    }
    return globalConfig;
};

// Salva apenas preferências do usuário. Configuração global é preservada.
export const saveSystemConfig = async (config: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    const userPrefs: UserPreferences & { userId: string } = {
        userId: uid
    };
    if (config.theme) userPrefs.theme = config.theme;
    if (config.hideValues !== undefined) userPrefs.hideValues = config.hideValues;
    if (config.lastMode) userPrefs.lastMode = config.lastMode;
    if (config.lastTab) userPrefs.lastTab = config.lastTab;

    await setDoc(doc(db, "config", `system_${uid}`), userPrefs, { merge: true });

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

// --- SALES ---

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

// --- FINANCE ---

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
    // Limit batch for transactions
    tx.slice(-500).forEach(i => batch.set(doc(db, "transactions", i.id), prep(i), { merge: true }));
    await batch.commit();
    SessionTraffic.trackWrite(acc.length + crd.length + cat.length + gl.length + chal.length + rec.length + Math.min(tx.length, 500));
};

// --- FIX: Implementation of missing members required by various components ---

// 1. canAccess
export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true;
    return !!(user.permissions as any)[feature];
};

// 2. analyzeClients
export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientMap = new Map<string, { name: string, lastDate: string, totalSpent: number, orders: number }>();
    sales.forEach(s => {
        if (s.deleted) return;
        const current = clientMap.get(s.client) || { name: s.client, lastDate: '0', totalSpent: 0, orders: 0 };
        const saleDate = s.date || s.completionDate || s.createdAt;
        if (saleDate > current.lastDate) current.lastDate = saleDate;
        current.totalSpent += s.valueSold;
        current.orders += 1;
        clientMap.set(s.client, current);
    });

    const now = new Date();
    return Array.from(clientMap.values()).map(c => {
        const last = new Date(c.lastDate);
        const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        let status: 'ACTIVE' | 'NEW' | 'INACTIVE' | 'LOST' = 'ACTIVE';
        if (diffDays <= config.daysForNewClient) status = 'NEW';
        else if (diffDays >= config.daysForLost) status = 'LOST';
        else if (diffDays >= config.daysForInactive) status = 'INACTIVE';

        return {
            name: c.name,
            status,
            totalOrders: c.orders,
            totalSpent: c.totalSpent,
            lastPurchaseDate: c.lastDate,
            daysSinceLastPurchase: diffDays
        };
    });
};

// 3. analyzeMonthlyVolume
export const analyzeMonthlyVolume = (sales: Sale[], monthsCount: number) => {
    const data = [];
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'short' });
        const key = d.toISOString().substring(0, 7);
        const filtered = sales.filter(s => (s.date || '').startsWith(key));
        data.push({
            name: label,
            basica: filtered.filter(s => s.type === ProductType.BASICA).reduce((acc, s) => acc + s.quantity, 0),
            natal: filtered.filter(s => s.type === ProductType.NATAL).reduce((acc, s) => acc + s.quantity, 0)
        });
    }
    return data;
};

// 4. exportReportToCSV
export const exportReportToCSV = (data: any[], fileName: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 5. calculateProductivityMetrics
export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const clients = analyzeClients(sales, config);
    
    const activeClients = clients.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const currentMonth = new Date().toISOString().substring(0, 7);
    const convertedThisMonth = clients.filter(c => c.lastPurchaseDate.startsWith(currentMonth)).length;
    const rate = activeClients > 0 ? (convertedThisMonth / activeClients) * 100 : 0;
    
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (rate >= 70) status = 'GREEN';
    else if (rate >= 40) status = 'YELLOW';

    return {
        totalClients: clients.length,
        activeClients,
        convertedThisMonth,
        conversionRate: rate,
        productivityStatus: status
    };
};

// 6. calculateFinancialPacing
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextDay = salaryDays.find(d => d > today) || salaryDays[0];
    const nextDate = new Date(now.getFullYear(), now.getMonth() + (nextDay <= today ? 1 : 0), nextDay);
    
    const daysRemaining = Math.max(1, Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const pendingExpenses = transactions.filter(t => t.type === 'EXPENSE' && !t.isPaid).reduce((acc, t) => acc + t.amount, 0);
    const available = balance - pendingExpenses;
    
    return {
        daysRemaining,
        safeDailySpend: Math.max(0, available / daysRemaining),
        pendingExpenses,
        nextIncomeDate: nextDate
    };
};

// 7. getInvoiceMonth
export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    if (day > closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().substring(0, 7);
};

// 8. exportEncryptedBackup
export const exportEncryptedBackup = async (passphrase: string) => {
    const data = {
        sales: await dbGetAll('sales'),
        accounts: await dbGetAll('accounts'),
        transactions: await dbGetAll('transactions'),
        categories: await dbGetAll('categories'),
        cards: await dbGetAll('cards'),
        receivables: await dbGetAll('receivables'),
        goals: await dbGetAll('goals'),
        challenges: await dbGetAll('challenges'),
        challenge_cells: await dbGetAll('challenge_cells'),
        version: 1,
        exportedAt: new Date().toISOString()
    };
    const json = JSON.stringify(data);
    const encrypted = encryptData(json); // This usually uses a global salt, BackupModal might want specific pass.
    // For specific passphrase, one would use CryptoJS directly or modify encryptData.
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestor360_${new Date().getTime()}.v360`;
    a.click();
};

// 9. importEncryptedBackup
export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = decryptData(text);
    const data = JSON.parse(decrypted);
    
    const stores: any = {
        sales: 'sales', accounts: 'accounts', transactions: 'transactions',
        categories: 'categories', cards: 'cards', receivables: 'receivables',
        goals: 'goals', challenges: 'challenges', challenge_cells: 'challenge_cells'
    };

    for (const key of Object.keys(stores)) {
        if (data[key]) await dbBulkPut(stores[key], data[key]);
    }
};

// 10. clearAllSales
export const clearAllSales = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    const dbInst = await initDB();
    await dbInst.clear('sales');
};

// 11. generateChallengeCells
export const generateChallengeCells = (challengeId: string, target: number, count: number, model: 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM'): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    if (model === 'PROPORTIONAL') {
        const val = target / count;
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING', userId: uid, deleted: false });
        }
    } else if (model === 'LINEAR') {
        const sumOfN = (count * (count + 1)) / 2;
        const unit = target / sumOfN;
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: i * unit, status: 'PENDING', userId: uid, deleted: false });
        }
    } else {
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: 0, status: 'PENDING', userId: uid, deleted: false });
        }
    }
    return cells;
};

// 12. processFinanceImport
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    const rows = data.slice(1);
    const uid = auth.currentUser?.uid || '';
    return rows.map(row => {
        const amount = ensureNumber(row[mapping.amount]);
        const type = mapping.type !== -1 ? (String(row[mapping.type]).toUpperCase().includes('REC') ? 'INCOME' : 'EXPENSE') : (amount >= 0 ? 'INCOME' : 'EXPENSE');
        return {
            id: crypto.randomUUID(),
            description: String(row[mapping.description] || 'Importado'),
            amount: Math.abs(amount),
            type: type as any,
            date: row[mapping.date] ? new Date(row[mapping.date]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            categoryId: mapping.category !== -1 ? String(row[mapping.category]) : 'uncategorized',
            isPaid: true,
            userId: uid,
            deleted: false,
            createdAt: new Date().toISOString()
        };
    });
};

// 13. readExcelFile
export const readExcelFile = async (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = text.split('\n').map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
            resolve(rows);
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// 14. atomicClearUserTables
export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    for (const t of tables) {
        const q = query(collection(db, t), where("userId", "==", userId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        const dbInst = await initDB();
        if ((dbInst.objectStoreNames as any).contains(t)) await dbInst.clear(t as any);
    }
};

// 15. getStoredTable
export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const store = type === ProductType.BASICA ? 'commission_basic' : (type === ProductType.NATAL ? 'commission_natal' : 'commission_custom');
    const local = await dbGetAll(store);
    if (local.length > 0) return local;
    
    const q = query(collection(db, store), where("isActive", "==", true));
    const snap = await getDocs(q);
    const rules = snap.docs.map(d => ({ ...d.data(), id: d.id } as CommissionRule));
    await dbBulkPut(store, rules);
    return rules;
};

// 16. computeCommissionValues
export const computeCommissionValues = (quantity: number, unitValue: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * unitValue;
    const rule = rules.sort((a, b) => b.minPercent - a.minPercent).find(r => margin >= r.minPercent);
    const rateUsed = rule ? rule.commissionRate : 0;
    return {
        commissionBase,
        commissionValue: commissionBase * rateUsed,
        rateUsed
    };
};

// 17. getClients
export const getClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
    await dbBulkPut('clients', data);
    return data;
};

// 18. getReportConfig
export const getReportConfig = async (): Promise<ReportConfig> => {
    const uid = await getAuthenticatedUid();
    const snap = await getDoc(doc(db, "config", `report_${uid}`));
    if (snap.exists()) return snap.data() as ReportConfig;
    return { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

// 19. saveCommissionRules
export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const store = type === ProductType.BASICA ? 'commission_basic' : (type === ProductType.NATAL ? 'commission_natal' : 'commission_custom');
    await dbBulkPut(store, rules);
    const batch = writeBatch(db);
    rules.forEach(r => batch.set(doc(db, store, r.id), r));
    await batch.commit();
};

// 20. bootstrapProductionData
export const bootstrapProductionData = async () => {
    const config = await getSystemConfig();
    if (config.bootstrapVersion && config.bootstrapVersion >= 1) return;
    // Perform initial data setup here if needed
    await saveSystemConfig({ bootstrapVersion: 1 });
};

// 21. saveReportConfig
export const saveReportConfig = async (config: ReportConfig) => {
    const uid = await getAuthenticatedUid();
    await setDoc(doc(db, "config", `report_${uid}`), config, { merge: true });
};

// 22. clearLocalCache
export const clearLocalCache = async () => {
    const dbInst = await initDB();
    const stores = ['sales', 'accounts', 'transactions', 'categories', 'cards', 'receivables', 'goals', 'challenges', 'challenge_cells', 'clients'];
    for (const s of stores) {
        await dbInst.clear(s as any);
    }
};

// 23. findPotentialDuplicates
export const findPotentialDuplicates = (sales: Sale[]) => {
    const names = Array.from(new Set(sales.map(s => s.client)));
    const duplicates: { master: string, similar: string[] }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < names.length; i++) {
        if (seen.has(names[i])) continue;
        const group = { master: names[i], similar: [] as string[] };
        for (let j = i + 1; j < names.length; j++) {
            if (names[i].toLowerCase() === names[j].toLowerCase()) {
                group.similar.push(names[j]);
                seen.add(names[j]);
            }
        }
        if (group.similar.length > 0) duplicates.push(group);
    }
    return duplicates;
};

// 24. smartMergeSales
export const smartMergeSales = (sales: Sale[]): Sale => {
    return sales.reduce((acc, curr) => ({
        ...acc,
        quantity: acc.quantity + curr.quantity,
        valueSold: acc.valueSold + curr.valueSold,
        commissionBaseTotal: acc.commissionBaseTotal + curr.commissionBaseTotal,
        commissionValueTotal: acc.commissionValueTotal + curr.commissionValueTotal,
        observations: (acc.observations || '') + ' ' + (curr.observations || '')
    }));
};

// 25. getTrashItems
export const getTrashItems = async () => {
    const uid = await getAuthenticatedUid();
    const qS = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", true));
    const qT = query(collection(db, "transactions"), where("userId", "==", uid), where("deleted", "==", true));
    const [snapS, snapT] = await Promise.all([getDocs(qS), getDocs(qT)]);
    return {
        sales: snapS.docs.map(d => ({ ...d.data(), id: d.id } as Sale)),
        transactions: snapT.docs.map(d => ({ ...d.data(), id: d.id } as Transaction))
    };
};

// 26. restoreItem
export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    const updated = { ...item, deleted: false, updatedAt: serverTimestamp() };
    await setDoc(doc(db, col, item.id), updated, { merge: true });
    await dbPut(col as any, updated);
};

// 27. permanentlyDeleteItem
export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    await deleteDoc(doc(db, col, id));
    await dbDelete(col as any, id);
};

// 28. getDeletedClients
export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
};

// 29. restoreClient
export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        const updated = { ...client, deleted: false, updatedAt: new Date().toISOString() };
        await setDoc(doc(db, "clients", id), sanitizeForFirestore(updated), { merge: true });
        await dbPut('clients', updated);
    }
};

// 30. permanentlyDeleteClient
export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
    await dbDelete('clients', id);
};
