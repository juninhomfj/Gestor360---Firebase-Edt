
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

export const saveSystemConfig = async (config: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    const userPrefs: UserPreferences & { userId: string } = { userId: uid };
    if (config.theme) userPrefs.theme = config.theme;
    if (config.hideValues !== undefined) userPrefs.hideValues = config.hideValues;
    if (config.lastMode) userPrefs.lastMode = config.lastMode;
    if (config.lastTab) userPrefs.lastTab = config.lastTab;

    await setDoc(doc(db, "config", `system_${uid}`), userPrefs, { merge: true });

    if (config.notificationSounds || config.fcmServerKey || config.ntfyTopic) {
        const globalConfig: any = {};
        if (config.notificationSounds) globalConfig.notificationSounds = config.notificationSounds;
        if (config.fcmServerKey) globalConfig.fcmServerKey = config.fcmServerKey;
        if (config.ntfyTopic) globalConfig.ntfyTopic = config.ntfyTopic;
        await setDoc(doc(db, "config", "system"), globalConfig, { merge: true });
    }
    Logger.info("Auditoria: Configurações de sistema salvas.");
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

// --- COMISSÕES ---

const getCommissionDocId = (type: ProductType): string => {
    if (type === ProductType.BASICA) return 'basic';
    if (type === ProductType.NATAL) return 'natal';
    return type.toLowerCase();
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    const docId = getCommissionDocId(type);

    try {
        const docRef = doc(db, "commissions", docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const rules = (snap.data().rules || []) as CommissionRule[];
            await dbBulkPut(storeName as any, rules);
            SessionTraffic.trackRead();
            return rules;
        }
    } catch (e) {
        Logger.error(`Erro ao sincronizar tabela [${docId}]`, e);
    }
    
    const cached = await dbGetAll(storeName as any);
    return cached || [];
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    const docId = getCommissionDocId(type);
    
    Logger.info(`Auditoria: Gravando regras para [${docId}]`);
    
    try {
        const dbInst = await initDB();
        await dbInst.clear(storeName as any);
        await dbBulkPut(storeName as any, rules);
        
        await setDoc(doc(db, "commissions", docId), { 
            id: docId,
            rules: sanitizeForFirestore(rules), 
            updatedAt: serverTimestamp() 
        }, { merge: true });
        
        SessionTraffic.trackWrite();
    } catch (e) {
        Logger.error(`Erro fatal ao salvar regras [${docId}]`, e);
        throw e;
    }
};

// --- SALES ---

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = await getAuthenticatedUid();
    try {
        const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const sales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
        await dbBulkPut('sales', sales);
        return sales;
    } catch (e) {
        return await dbGetAll('sales');
    }
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
    Logger.info(`Auditoria: Lote de ${sales.length} vendas salvo.`);
};

export const saveSingleSale = async (payload: any) => {
  const uid = await getAuthenticatedUid();
  const saleId = payload.id || crypto.randomUUID();
  const saleData = sanitizeForFirestore({ ...payload, id: saleId, userId: uid, updatedAt: serverTimestamp() });
  
  try {
      await dbPut('sales', saleData);
      await setDoc(doc(db, "sales", saleId), saleData, { merge: true });
      SessionTraffic.trackWrite();
      Logger.info(`Auditoria: Venda [${saleId}] salva.`);
  } catch (e) {
      throw e;
  }
};

// --- FINANCE ---

export const getFinanceData = async () => {
    const uid = await getAuthenticatedUid();
    const fetchSafe = async (col: string) => {
        const q = query(collection(db, col), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        await dbBulkPut(col as any, items);
        return items;
    };
    try {
        const [acc, tx, crd, cat, gl, chal, cell, rec] = await Promise.all([
            fetchSafe("accounts"), fetchSafe("transactions"), fetchSafe("cards"), fetchSafe("categories"),
            fetchSafe("goals"), fetchSafe("challenges"), fetchSafe("challenge_cells"), fetchSafe("receivables")
        ]);
        return {
            accounts: acc as FinanceAccount[], 
            transactions: tx as Transaction[], 
            cards: crd as CreditCard[],
            categories: cat as TransactionCategory[], 
            goals: gl as FinanceGoal[], 
            challenges: chal as Challenge[], 
            cells: cell as ChallengeCell[], 
            receivables: rec as Receivable[]
        };
    } catch (e) {
        throw e;
    }
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
    tx.slice(-500).forEach(i => batch.set(doc(db, "transactions", i.id), prep(i), { merge: true }));
    
    await batch.commit();
    SessionTraffic.trackWrite();
    Logger.info("Auditoria: Base financeira sincronizada.");
};

// --- UTILS ---

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true;
    return !!(user.permissions as any)[feature];
};

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
        return { name: c.name, status, totalOrders: c.orders, totalSpent: c.totalSpent, lastPurchaseDate: c.lastDate, daysSinceLastPurchase: diffDays };
    });
};

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

export const exportReportToCSV = (data: any[], fileName: string) => {
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    Logger.info(`Auditoria: Exportado relatório [${fileName}]`);
};

export const readExcelFile = async (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(json as any[][]);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

export const downloadSalesTemplate = () => {
    const headers = [
        "Data Faturamento", "Data Pedido", "Tipo (Cesta Básica ou Cesta de Natal)", 
        "Cliente", "Qtd", "Unitário Proposto", "Valor Total Venda", "Margem %", "Observações"
    ];
    const sample = [
        new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0],
        "Cesta Básica", "Exemplo Ltda", "10", "150.00", "1500.00", "15", "Venda de teste"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_importacao_vendas.xlsx");
    Logger.info("Auditoria: Baixado modelo de importação.");
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const rule = rules.find(r => margin >= r.minPercent && (r.maxPercent === null || margin < r.maxPercent));
    const rateUsed = rule ? rule.commissionRate : 0;
    return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    const factor = model === 'LINEAR' ? target / ((count * (count + 1)) / 2) : target / count;
    for (let i = 1; i <= count; i++) {
        cells.push({
            id: crypto.randomUUID(), challengeId, number: i, 
            value: model === 'LINEAR' ? i * factor : (model === 'PROPORTIONAL' ? factor : 0),
            status: 'PENDING', userId: uid, deleted: false
        });
    }
    return cells;
};

export const bootstrapProductionData = async () => {
    const config = await getSystemConfig();
    if (config.bootstrapVersion >= 1) return;
    Logger.info("Auditoria: Executando bootstrap inicial.");
    const basicRef = doc(db, "commissions", "basic");
    if (!(await getDoc(basicRef)).exists()) {
        await setDoc(basicRef, {
            id: "basic",
            rules: [
                { id: crypto.randomUUID(), minPercent: 0, maxPercent: 10, commissionRate: 0.04, isActive: true },
                { id: crypto.randomUUID(), minPercent: 10, maxPercent: 20, commissionRate: 0.05, isActive: true },
                { id: crypto.randomUUID(), minPercent: 20, maxPercent: null, commissionRate: 0.06, isActive: true }
            ],
            updatedAt: serverTimestamp()
        });
    }
    await saveSystemConfig({ bootstrapVersion: 1 });
};

export const clearLocalCache = async () => {
    const dbInst = await initDB();
    const stores = ['sales', 'accounts', 'transactions', 'categories', 'cards', 'receivables', 'goals', 'challenges', 'challenge_cells', 'clients'];
    for (const s of stores) await dbInst.clear(s as any);
    Logger.warn("Auditoria: Cache local limpo pelo usuário.");
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    const updated = { ...item, deleted: false, updatedAt: serverTimestamp() };
    await setDoc(doc(db, col, item.id), updated, { merge: true });
    await dbPut(col as any, updated);
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    await deleteDoc(doc(db, col, id));
    await dbDelete(col as any, id);
};

// Fix: Added calculateProductivityMetrics implementation
export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const clientAnalysis = analyzeClients(sales, config);
    
    const activeClients = clientAnalysis.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const now = new Date();
    const monthKey = now.toISOString().substring(0, 7);
    const convertedThisMonth = sales.filter(s => s.date?.startsWith(monthKey)).length;
    
    const rate = activeClients > 0 ? (convertedThisMonth / activeClients) * 100 : 0;
    
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (rate >= 70) status = 'GREEN';
    else if (rate >= 40) status = 'YELLOW';
    
    return {
        totalClients: clientAnalysis.length,
        activeClients,
        convertedThisMonth,
        conversionRate: rate,
        productivityStatus: status
    };
};

// Fix: Added calculateFinancialPacing implementation
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const nextDay = salaryDays.sort((a, b) => a - b).find(d => d > currentDay) || salaryDays[0];
    const nextIncomeDate = new Date(currentYear, nextDay > currentDay ? currentMonth : currentMonth + 1, nextDay);
    
    const diffTime = nextIncomeDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const pendingExpenses = transactions
        .filter(t => !t.isPaid && t.type === 'EXPENSE')
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = (balance - pendingExpenses) / daysRemaining;

    return {
        daysRemaining,
        safeDailySpend: Math.max(0, safeDailySpend),
        pendingExpenses,
        nextIncomeDate
    };
};

// Fix: Added getInvoiceMonth implementation
export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    let month = d.getMonth();
    let year = d.getFullYear();

    if (day >= closingDay) {
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
    }
    
    return `${year}-${String(month + 1).padStart(2, '0')}`;
};

// Fix: Added getClients implementation
export const getClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    try {
        const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        const clients = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
        await dbBulkPut('clients', clients);
        return clients;
    } catch (e) {
        return await dbGetAll('clients');
    }
};

// Fix: Added getReportConfig implementation
export const getReportConfig = async (): Promise<ReportConfig> => {
    const uid = await getAuthenticatedUid();
    const docRef = doc(db, "config", `report_${uid}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as ReportConfig;
    return { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

// Fix: Added saveReportConfig implementation
export const saveReportConfig = async (config: ReportConfig) => {
    const uid = await getAuthenticatedUid();
    await setDoc(doc(db, "config", `report_${uid}`), config, { merge: true });
};

// Fix: Added findPotentialDuplicates implementation
export const findPotentialDuplicates = (sales: Sale[]): { master: string, similar: string[] }[] => {
    const names = Array.from(new Set(sales.filter(s => !s.deleted).map(s => s.client)));
    const groups: { master: string, similar: string[] }[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < names.length; i++) {
        const nameA = names[i];
        if (processed.has(nameA)) continue;

        const similar = names.slice(i + 1).filter(nameB => {
            if (processed.has(nameB)) return false;
            const normA = nameA.toLowerCase().trim();
            const normB = nameB.toLowerCase().trim();
            return normA === normB || normA.includes(normB) || normB.includes(normA);
        });

        if (similar.length > 0) {
            groups.push({ master: nameA, similar });
            processed.add(nameA);
            similar.forEach(n => processed.add(n));
        }
    }
    return groups;
};

// Fix: Added smartMergeSales implementation
export const smartMergeSales = (sales: Sale[]): Sale => {
    if (sales.length === 0) throw new Error("No sales to merge");
    // Simple implementation: take the first as base and merge observations
    const base = { ...sales[0] };
    base.observations = sales.map(s => s.observations).filter(Boolean).join(" | ");
    return base;
};

// Fix: Added getTrashItems implementation
export const getTrashItems = async () => {
    const uid = await getAuthenticatedUid();
    const qSales = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", true));
    const qTxs = query(collection(db, "transactions"), where("userId", "==", uid), where("deleted", "==", true));
    
    const [sSnap, tSnap] = await Promise.all([getDocs(qSales), getDocs(qTxs)]);
    return {
        sales: sSnap.docs.map(d => ({ ...d.data(), id: d.id } as Sale)),
        transactions: tSnap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction))
    };
};

// Fix: Added getDeletedClients implementation
export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
};

// Fix: Added restoreClient implementation
export const restoreClient = async (clientId: string) => {
    await updateDoc(doc(db, "clients", clientId), { deleted: false, updatedAt: serverTimestamp() });
};

// Fix: Added permanentlyDeleteClient implementation
export const permanentlyDeleteClient = async (clientId: string) => {
    await deleteDoc(doc(db, "clients", clientId));
    await dbDelete('clients', clientId);
};

// Fix: Added clearAllSales implementation
export const clearAllSales = async () => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await clearLocalCache();
};

// Fix: Added exportEncryptedBackup implementation
export const exportEncryptedBackup = async (passphrase: string) => {
    const stores = [
        'sales', 'accounts', 'transactions', 'clients', 'cards', 
        'categories', 'goals', 'challenges', 'challenge_cells', 'receivables'
    ];
    const data: any = {};
    for (const store of stores) {
        data[store] = await dbGetAll(store as any);
    }
    const encrypted = encryptData(JSON.stringify(data));
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().getTime()}.v360`;
    a.click();
};

// Fix: Added importEncryptedBackup implementation
export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = decryptData(text);
    if (!decrypted) throw new Error("Invalid decryption");
    const data = JSON.parse(decrypted);
    for (const store of Object.keys(data)) {
        await dbBulkPut(store as any, data[store]);
    }
};

// Fix: Added processFinanceImport implementation
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    return data.slice(1).map(row => {
        const amount = ensureNumber(row[mapping.amount]);
        const type = amount >= 0 ? 'INCOME' : 'EXPENSE';
        return {
            id: crypto.randomUUID(),
            description: String(row[mapping.description] || ''),
            amount: Math.abs(amount),
            type: type as any,
            date: row[mapping.date] ? new Date(row[mapping.date]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isPaid: true,
            deleted: false
        };
    });
};

// Fix: Added atomicClearUserTables implementation
export const atomicClearUserTables = async (targetUserId: string, tables: string[]) => {
    const clearFunc = httpsCallable(functions, 'adminHardResetUserData');
    await clearFunc({ targetUserId, tables });
};
