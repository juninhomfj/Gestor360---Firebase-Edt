import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  limit,
  orderBy,
  getDoc,
  setDoc,
  writeBatch,
  deleteDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import * as XLSX from 'xlsx';
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import { Logger } from './logger';
import { encryptData, decryptData } from '../utils/encryption';
import { 
    User, Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, ChallengeModel, Client, 
    ProductivityMetrics, SaleFormData, SaleStatus, Challenge, FinanceGoal, ImportMapping
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
    theme: 'glass',
    modules: {
        sales: true, finance: true, whatsapp: false, crm: true,
        ai: true, dev: false, reports: true, news: true,
        receivables: true, distribution: true, imports: true, settings: true,
    },
    includeNonAccountingInTotal: false,
    bootstrapVersion: 1
};

export const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function ensureNumber(value: any, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  
  try {
    let str = String(value).trim();
    str = str.replace(/\s/g, ''); 

    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    
    str = str.replace(/[^\d.-]/g, '');
    
    const num = parseFloat(str);
    return isNaN(num) ? fallback : num;
  } catch (e) {
    return fallback;
  }
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
        const timeout = setTimeout(() => {
            reject(new Error("Timeout: Firebase não respondeu a autenticação."));
        }, 8000);

        const unsubscribe = auth.onAuthStateChanged((u) => {
            if (u) {
                clearTimeout(timeout);
                unsubscribe();
                resolve(u.uid);
            }
        }, (error) => {
            clearTimeout(timeout);
            unsubscribe();
            reject(error);
        });
    });
}

export const getStoredSales = async (): Promise<Sale[]> => {
  try {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    SessionTraffic.trackRead(snap.size);
    
    const sales = snap.docs.map(d => {
        const data = d.data();
        return { 
            ...data,
            id: d.id,
            quantity: ensureNumber(data.quantity, 1),
            valueProposed: ensureNumber(data.valueProposed),
            valueSold: ensureNumber(data.valueSold),
            marginPercent: ensureNumber(data.marginPercent),
            commissionBaseTotal: ensureNumber(data.commissionBaseTotal),
            commissionValueTotal: ensureNumber(data.commissionValueTotal),
            commissionRateUsed: ensureNumber(data.commissionRateUsed)
        } as Sale;
    });

    if (sales.length > 0) await dbBulkPut('sales', sales);
    return sales;
  } catch (e) {
    console.error("Erro ao buscar vendas do Cloud", e);
    return [];
  }
};

export const saveSales = async (sales: Sale[]) => {
    const uid = await getAuthenticatedUid();
    const sanitized = sales.map(s => sanitizeForFirestore({ ...s, userId: uid, updatedAt: serverTimestamp() }));
    await dbBulkPut('sales', sanitized);
    
    const CHUNK_SIZE = 400; 
    for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
        const chunk = sanitized.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(s => {
            const { id, ...data } = s;
            batch.set(doc(db, "sales", id), data, { merge: true });
            SessionTraffic.trackWrite();
        });
        await batch.commit();
    }
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
    
    const fetchSafeCollection = async (colName: string) => {
        try {
            const q = query(collection(db, colName), where("userId", "==", uid), where("deleted", "==", false));
            const snap = await getDocs(q);
            SessionTraffic.trackRead(snap.size);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn(`[Firestore] Sem permissão ou erro na coleção '${colName}':`, e);
            return []; 
        }
    };

    const [
        rawAccounts, rawTransactions, rawCards, rawCategories, 
        rawGoals, rawChallenges, rawCells, rawReceivables
    ] = await Promise.all([
        fetchSafeCollection("accounts"),
        fetchSafeCollection("transactions"),
        fetchSafeCollection("cards"),
        fetchSafeCollection("categories"),
        fetchSafeCollection("goals"),
        fetchSafeCollection("challenges"),
        fetchSafeCollection("challenge_cells"),
        fetchSafeCollection("receivables"),
    ]);

    return {
        accounts: rawAccounts.map(d => ({ ...d, balance: ensureNumber(d.balance) } as FinanceAccount)),
        transactions: rawTransactions.map(d => ({ ...d, amount: ensureNumber(d.amount) } as Transaction)),
        cards: rawCards.map(d => ({ ...d, limit: ensureNumber(d.limit), currentInvoice: ensureNumber(d.currentInvoice) } as CreditCard)),
        categories: rawCategories as TransactionCategory[],
        goals: rawGoals.map(d => ({ ...d, targetValue: ensureNumber(d.targetValue), currentValue: ensureNumber(d.currentValue) } as FinanceGoal)),
        challenges: rawChallenges.map(d => ({ ...d, targetValue: ensureNumber(d.targetValue) } as Challenge)),
        cells: rawCells.map(d => ({ ...d, value: ensureNumber(d.value) } as ChallengeCell)),
        receivables: rawReceivables.map(d => ({ ...d, value: ensureNumber(d.value) } as Receivable)),
    };
};

export const saveFinanceData = async (
    accounts: FinanceAccount[], 
    cards: CreditCard[], 
    transactions: Transaction[], 
    categories: TransactionCategory[],
    goals: FinanceGoal[] = [],
    challenges: Challenge[] = [],
    receivables: Receivable[] = []
) => {
    const uid = await getAuthenticatedUid();
    const batch = writeBatch(db);
    
    const prep = (item: any) => sanitizeForFirestore({ ...item, userId: uid, updatedAt: serverTimestamp() });

    accounts.forEach(acc => batch.set(doc(db, "accounts", acc.id), prep(acc), { merge: true }));
    cards.forEach(card => batch.set(doc(db, "cards", card.id), prep(card), { merge: true }));
    categories.forEach(cat => batch.set(doc(db, "categories", cat.id), prep(cat), { merge: true }));
    goals.forEach(goal => batch.set(doc(db, "goals", goal.id), prep(goal), { merge: true }));
    challenges.forEach(chal => batch.set(doc(db, "challenges", chal.id), prep(chal), { merge: true }));
    receivables.forEach(rec => batch.set(doc(db, "receivables", rec.id), prep(rec), { merge: true }));
    
    transactions.slice(-100).forEach(tx => batch.set(doc(db, "transactions", tx.id), prep(tx), { merge: true }));

    await batch.commit();
    
    await Promise.all([
        dbBulkPut('accounts', accounts),
        dbBulkPut('cards', cards),
        dbBulkPut('transactions', transactions),
        dbBulkPut('categories', categories),
        dbBulkPut('goals', goals),
        dbBulkPut('challenges', challenges),
        dbBulkPut('receivables', receivables)
    ]);
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    try {
        const uid = await getAuthenticatedUid();
        const colMap: Record<ProductType, string> = { 
            [ProductType.BASICA]: 'commission_basic', 
            [ProductType.NATAL]: 'commission_natal', 
            [ProductType.CUSTOM]: 'commission_custom' 
        };
        
        const q = query(
            collection(db, colMap[type]),
            where("userId", "==", uid)
        );
        
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
    } catch (e) {
        console.warn(`[Firestore] Falha ao ler tabela ${type}:`, e);
        return [];
    }
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  const base = ensureNumber(valueProposed) * ensureNumber(quantity);
  const sortedRules = [...rules].sort((a,b) => b.minPercent - a.minPercent);
  const rule = sortedRules.find(r => ensureNumber(margin) >= r.minPercent);
  
  let rate = rule ? rule.commissionRate : 0;
  if (rate > 1) rate = rate / 100; 

  const rawCommission = base * rate;
  return { 
      commissionBase: base, 
      commissionValue: Math.round((rawCommission + Number.EPSILON) * 100) / 100, 
      rateUsed: rate 
  };
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    // Carregamento global via config/system sem dependência de userId
    const snap = await getDoc(doc(db, "config", "system"));
    return snap.exists() ? snap.data() as SystemConfig : DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
    // Persistência global em config/system usando merge: true para evitar overwrites
    await setDoc(doc(db, "config", "system"), sanitizeForFirestore(config), { merge: true });
};

export const getClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const uid = await getAuthenticatedUid();
    const colMap: Record<ProductType, string> = { 
        [ProductType.BASICA]: 'commission_basic', 
        [ProductType.NATAL]: 'commission_natal', 
        [ProductType.CUSTOM]: 'commission_custom' 
    };
    const batch = writeBatch(db);
    rules.forEach(r => {
        batch.set(doc(db, colMap[type], r.id), { ...r, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
};

export const saveReportConfig = async (config: ReportConfig) => {
    const uid = await getAuthenticatedUid();
    await setDoc(doc(db, "config", `report_${uid}`), config);
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const uid = await getAuthenticatedUid();
    const snap = await getDoc(doc(db, "config", `report_${uid}`));
    return snap.exists() ? snap.data() as ReportConfig : { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user) return false;
    if (user.role === 'DEV' || user.role === 'ADMIN') return true; 
    return !!(user.permissions as any)?.[feature];
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
  const sales = await getStoredSales();
  const config = await getReportConfig();
  const clients = analyzeClients(sales, config);
  const active = clients.filter(c => c.status === 'ACTIVE').length;
  const now = new Date();
  const converted = sales.filter(s => {
    const d = new Date(s.date || s.completionDate || s.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const rate = active > 0 ? (converted / active) * 100 : 0;
  return {
      totalClients: clients.length,
      activeClients: active,
      convertedThisMonth: converted,
      conversionRate: rate,
      productivityStatus: rate >= 70 ? 'GREEN' : (rate >= 40 ? 'YELLOW' : 'RED')
  };
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
  const now = new Date();
  const today = now.getDate();
  let nextDay = salaryDays.find(d => d > today) || salaryDays[0];
  const nextDate = new Date(now.getFullYear(), now.getMonth() + (nextDay <= today ? 1 : 0), nextDay);
  const daysRem = Math.max(1, Math.ceil((nextDate.getTime() - now.getTime()) / 86400000));
  const pendingExp = transactions.filter(t => t.type === 'EXPENSE' && !t.isPaid).reduce((acc, t) => acc + t.amount, 0);
  return { daysRemaining: daysRem, safeDailySpend: (balance - pendingExp) / daysRem, pendingExpenses: pendingExp, nextIncomeDate: nextDate };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
  const d = new Date(dateStr);
  if (d.getDate() >= closingDay) d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const all = { 
        sales: await dbGetAll('sales'), 
        accounts: await dbGetAll('accounts'), 
        transactions: await dbGetAll('transactions'),
        receivables: await dbGetAll('receivables'),
        goals: await dbGetAll('goals')
    };
    const blob = new Blob([encryptData(JSON.stringify(all))], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gestor360_backup.v360'; a.click();
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const data = JSON.parse(decryptData(text));
    if (data.sales) await dbBulkPut('sales', data.sales);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const val = target / count;
    for (let i = 1; i <= count; i++) {
        cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING', userId: auth.currentUser?.uid || '', deleted: false });
    }
    return cells;
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const map = new Map<string, any>();
    const now = new Date();
    sales.forEach(s => {
        const d = new Date(s.date || s.completionDate || s.createdAt);
        const diff = Math.ceil((now.getTime() - d.getTime()) / 86400000);
        const ex = map.get(s.client) || { name: s.client, totalSpent: 0, lastDate: d, diffDays: diff };
        ex.totalSpent += s.valueSold;
        if (d > ex.lastDate) { ex.lastDate = d; ex.diffDays = diff; }
        map.set(s.client, ex);
    });
    return Array.from(map.values()).map(c => {
        let status = 'ACTIVE';
        if (c.diffDays >= config.daysForLost) status = 'LOST';
        else if (c.diffDays >= config.daysForInactive) status = 'INACTIVE';
        else if (c.diffDays <= config.daysForNewClient) status = 'NEW';
        return { ...c, status, lastPurchaseDate: c.lastDate, daysSinceLastPurchase: c.diffDays };
    });
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const res: any[] = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const m = d.getMonth(), y = d.getFullYear();
        const items = sales.filter(s => { const sd = new Date(s.date || s.completionDate || s.createdAt); return sd.getMonth() === m && sd.getFullYear() === y; });
        res.push({
            name: d.toLocaleDateString('pt-BR', { month: 'short' }),
            basica: items.filter(s => s.type === ProductType.BASICA).reduce((acc, s) => acc + s.commissionValueTotal, 0),
            natal: items.filter(s => s.type === ProductType.NATAL).reduce((acc, s) => acc + s.commissionValueTotal, 0)
        });
    }
    return res;
};

export const exportReportToCSV = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const readExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const results = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(results as any[][]);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const processFinanceImport = (data: any[][], mapping: ImportMapping): Transaction[] => {
    const rows = data.slice(1); 
    const transactions: Transaction[] = [];

    rows.forEach(row => {
        const dateVal = row[mapping['date']];
        const descVal = row[mapping['description']];
        const amountVal = row[mapping['amount']];
        const typeVal = mapping['type'] !== -1 ? row[mapping['type']] : null;
        const personVal = mapping['person'] !== -1 ? row[mapping['person']] : null;

        if (!dateVal || !descVal || amountVal === undefined) return;

        const rawAmount = ensureNumber(amountVal);
        let type: 'INCOME' | 'EXPENSE' | 'TRANSFER' = rawAmount >= 0 ? 'INCOME' : 'EXPENSE';
        
        if (typeVal) {
            const t = String(typeVal).toUpperCase();
            if (t.includes('REC') || t.includes('ENT')) type = 'INCOME';
            else if (t.includes('DESP') || t.includes('SAI')) type = 'EXPENSE';
        }

        const tx: Transaction = {
            id: crypto.randomUUID(),
            description: String(descVal),
            amount: Math.abs(rawAmount),
            type,
            date: String(dateVal),
            categoryId: 'uncategorized',
            accountId: '', 
            isPaid: true,
            personType: (personVal && String(personVal).toUpperCase().includes('PJ')) ? 'PJ' : 'PF',
            deleted: false,
            createdAt: new Date().toISOString(),
            userId: auth.currentUser?.uid || ''
        };

        transactions.push(tx);
    });

    return transactions;
};

export const getTrashItems = async () => {
    const [sales, transactions] = await Promise.all([
        dbGetAll('sales', s => !!s.deleted),
        dbGetAll('transactions', t => !!t.deleted)
    ]);
    return { sales, transactions };
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

export const clearLocalCache = async () => {
    try {
        const dbInstance = await initDB();
        const storeNames = Array.from(dbInstance.objectStoreNames);
        const tx = dbInstance.transaction(storeNames as any, 'readwrite');
        for (const storeName of storeNames) {
            await tx.objectStore(storeName as any).clear();
        }
        await tx.done;
    } catch (e) {
        console.error("Erro ao limpar IndexedDB:", e);
    }
    localStorage.clear();
    sessionStorage.clear();
};

export const clearAllSales = async () => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }

    const dbInstance = await initDB();
    await dbInstance.clear('sales');
};

export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    for (const table of tables) {
        try {
            const q = query(collection(db, table), where("userId", "==", userId));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            
            if (userId === auth.currentUser?.uid) {
                const dbInstance = await initDB();
                if (dbInstance.objectStoreNames.contains(table as any)) {
                    await dbInstance.clear(table as any);
                }
            }
        } catch (e) {
            console.error(`[Firestore] Erro ao limpar tabela ${table}:`, e);
            throw e;
        }
    }
};

export const bootstrapProductionData = async () => {};
export const findPotentialDuplicates = (sales: Sale[]) => [];
export const smartMergeSales = (duplicates: Sale[]): Sale => duplicates[0];
export const getDeletedClients = async (): Promise<Client[]> => [];
export const restoreClient = async (id: string) => {};
export const permanentlyDeleteClient = async (id: string) => {};
