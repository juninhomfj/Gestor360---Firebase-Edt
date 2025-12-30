
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
  deleteDoc,
  query as firestoreQuery
} from "firebase/firestore";
import { db } from "./firebase";
import { getAuth } from "firebase/auth";
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

function requireAuthUid(): string {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado");
  return uid;
}

function ensureNumber(value: any, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  let str = String(value).replace(/[R$\s]/g, '');
  if (str.includes(',') && !str.includes('.')) { str = str.replace(',', '.'); } 
  else if (str.includes(',') && str.includes('.')) { str = str.replace(/\./g, '').replace(',', '.'); }
  const num = parseFloat(str);
  return !isNaN(num) ? num : fallback;
}

function sanitizeForFirestore(obj: any): any {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) cleaned[key] = obj[key];
    });
    return cleaned;
}

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; 
    return !!(user.permissions as any)[feature];
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    const uid = requireAuthUid();
    const snap = await getDoc(doc(db, "config", `system_${uid}`));
    return snap.exists() ? snap.data() as SystemConfig : DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
    const uid = requireAuthUid();
    await setDoc(doc(db, "config", `system_${uid}`), config, { merge: true });
};

export const getClients = async (): Promise<Client[]> => {
    const uid = requireAuthUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    const clients = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
    if (clients.length > 0) await dbBulkPut('clients', clients);
    return clients;
};

export const getFinanceData = async () => {
    const uid = requireAuthUid();
    const results = await Promise.all([
        getDocs(query(collection(db, "accounts"), where("userId", "==", uid), where("deleted", "==", false))),
        getDocs(query(collection(db, "transactions"), where("userId", "==", uid), where("deleted", "==", false))),
        getDocs(query(collection(db, "cards"), where("userId", "==", uid), where("deleted", "==", false))),
        getDocs(query(collection(db, "categories"), where("deleted", "==", false))),
        getDocs(query(collection(db, "goals"), where("userId", "==", uid), where("deleted", "==", false))),
        getDocs(query(collection(db, "challenges"), where("userId", "==", uid), where("deleted", "==", false))),
        getDocs(query(collection(db, "challenge_cells"), where("userId", "==", uid), where("deleted", "==", false))),
        getDocs(query(collection(db, "receivables"), where("userId", "==", uid), where("deleted", "==", false))),
    ]);

    return {
        accounts: results[0].docs.map(d => ({ id: d.id, ...d.data() } as FinanceAccount)),
        transactions: results[1].docs.map(d => ({ id: d.id, ...d.data() } as Transaction)),
        cards: results[2].docs.map(d => ({ id: d.id, ...d.data() } as CreditCard)),
        categories: results[3].docs.map(d => ({ id: d.id, ...d.data() } as TransactionCategory)),
        goals: results[4].docs.map(d => ({ id: d.id, ...d.data() } as FinanceGoal)),
        challenges: results[5].docs.map(d => ({ id: d.id, ...d.data() } as Challenge)),
        cells: results[6].docs.map(d => ({ id: d.id, ...d.data() } as ChallengeCell)),
        receivables: results[7].docs.map(d => ({ id: d.id, ...d.data() } as Receivable)),
    };
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colMap: Record<ProductType, string> = { 
        [ProductType.BASICA]: 'commission_basic', 
        [ProductType.NATAL]: 'commission_natal', 
        [ProductType.CUSTOM]: 'commission_custom' 
    };
    const snap = await getDocs(collection(db, colMap[type]));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const clients = analyzeClients(sales, config);
    
    const active = clients.filter(c => c.status === 'ACTIVE').length;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const converted = sales.filter(s => {
        const d = new Date(s.date || s.completionDate || s.createdAt);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
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
    const currentDay = now.getDate();
    let nextIncomeDay = salaryDays.find(d => d > currentDay) || salaryDays[0];
    
    const nextIncomeDate = new Date(now.getFullYear(), now.getMonth() + (nextIncomeDay <= currentDay ? 1 : 0), nextIncomeDay);
    const diffTime = Math.abs(nextIncomeDate.getTime() - now.getTime());
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const pendingExpenses = transactions
        .filter(t => t.type === 'EXPENSE' && !t.isPaid && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = (balance - pendingExpenses) / (daysRemaining || 1);

    return {
        daysRemaining,
        safeDailySpend: Math.max(0, safeDailySpend),
        pendingExpenses,
        nextIncomeDate
    };
};

export const getInvoiceMonth = (date: string, closingDay: number): string => {
    const d = new Date(date);
    if (d.getDate() >= closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const data = {
        sales: await dbGetAll('sales'),
        accounts: await dbGetAll('accounts'),
        transactions: await dbGetAll('transactions'),
        clients: await dbGetAll('clients'),
        config: await dbGetAll('config')
    };
    const json = JSON.stringify(data);
    const encrypted = encryptData(json); 
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestor360_backup_${new Date().getTime()}.v360`;
    a.click();
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = decryptData(text);
    const data = JSON.parse(decrypted);
    if (data.sales) await dbBulkPut('sales', data.sales);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
    if (data.clients) await dbBulkPut('clients', data.clients);
};

export const clearAllSales = async () => {
    const uid = requireAuthUid();
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    const dbInstance = await initDB();
    const tx = dbInstance.transaction('sales', 'readwrite');
    await tx.store.clear();
    await tx.done;
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = requireAuthUid();

    for (let i = 1; i <= count; i++) {
        let val = 0;
        if (model === 'LINEAR') {
            const sum = (count * (count + 1)) / 2;
            const factor = target / sum;
            val = i * factor;
        } else if (model === 'PROPORTIONAL') {
            val = target / count;
        }
        
        cells.push({
            id: crypto.randomUUID(),
            challengeId,
            number: i,
            value: val,
            status: 'PENDING',
            userId: uid,
            deleted: false
        });
    }
    return cells;
};

export const readExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            resolve(rows);
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
};

export const processFinanceImport = (data: any[][], mapping: ImportMapping): Transaction[] => {
    const uid = requireAuthUid();
    const rows = data.slice(1);
    return rows.map(row => {
        const amount = ensureNumber(row[mapping.amount]);
        return {
            id: crypto.randomUUID(),
            description: String(row[mapping.description] || 'Sem descrição'),
            amount: Math.abs(amount),
            type: amount >= 0 ? 'INCOME' : 'EXPENSE',
            date: String(row[mapping.date] || new Date().toISOString()),
            categoryId: 'uncategorized',
            accountId: '', 
            isPaid: true,
            deleted: false,
            createdAt: new Date().toISOString(),
            userId: uid
        } as Transaction;
    });
};

export const bootstrapProductionData = async () => {
    const uid = requireAuthUid();
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set(sales.map(s => s.client)));
    const duplicates: { master: string, similar: string[] }[] = [];
    return duplicates;
};

export const smartMergeSales = (duplicates: Sale[]): Sale => {
    return duplicates[0];
};

export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = requireAuthUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
};

export const restoreClient = async (id: string) => {
    await updateDoc(doc(db, "clients", id), { deleted: false, updatedAt: serverTimestamp() });
};

export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
};

export const permanentlyClearAllSalesFirestore = async (targetUserId?: string) => {
    const currentUid = requireAuthUid();
    const uidToDelete = targetUserId || currentUid;
    const q = query(collection(db, "sales"), where("userId", "==", uidToDelete));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (uidToDelete === currentUid) {
        const dbInstance = await initDB();
        if (dbInstance) {
            const tx = dbInstance.transaction('sales', 'readwrite');
            await tx.store.clear();
            await tx.done;
        }
    }
    Logger.log('CRASH', `LIMPEZA ATÔMICA. Alvo: ${uidToDelete}. Executor: ${currentUid}`);
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  const base = valueProposed * quantity;
  const sortedRules = [...rules].sort((a,b) => b.minPercent - a.minPercent);
  const rule = sortedRules.find(r => margin >= r.minPercent);
  let rate = rule ? rule.commissionRate : 0;
  if (rate > 1) rate = rate / 100; 
  const rawCommission = base * rate;
  return { 
      commissionBase: base, 
      commissionValue: Math.round((rawCommission + Number.EPSILON) * 100) / 100, 
      rateUsed: rate 
  };
};

export const getStoredSales = async (): Promise<Sale[]> => {
  const uid = requireAuthUid();
  const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
  const snap = await getDocs(q);
  const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
  if (sales.length > 0) await dbBulkPut('sales', sales);
  return sales;
};

export const saveSales = async (sales: Sale[]) => {
    const uid = requireAuthUid();
    await dbBulkPut('sales', sales);
    const CHUNK_SIZE = 450; 
    for (let i = 0; i < sales.length; i += CHUNK_SIZE) {
        const chunk = sales.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(s => {
            const { id, ...data } = s;
            batch.set(doc(db, "sales", id), sanitizeForFirestore({ ...data, userId: uid, updatedAt: serverTimestamp() }), { merge: true });
        });
        await batch.commit();
    }
};

export const saveSingleSale = async (payload: any) => {
  const uid = requireAuthUid();
  const saleId = payload.id || crypto.randomUUID();
  const sale = sanitizeForFirestore({ ...payload, id: saleId, userId: uid, updatedAt: serverTimestamp() });
  await dbPut('sales', sale);
  await setDoc(doc(db, "sales", saleId), sale, { merge: true });
};

// --- FINANCE ENGINE (REAL IMPLEMENTATION) ---

export const saveFinanceData = async (accounts: FinanceAccount[], cards: CreditCard[], transactions: Transaction[], categories: TransactionCategory[]) => {
    const uid = requireAuthUid();
    const batch = writeBatch(db);
    
    // Sincroniza Contas
    for (const acc of accounts) {
        batch.set(doc(db, "accounts", acc.id), sanitizeForFirestore({ ...acc, userId: uid, updatedAt: serverTimestamp() }), { merge: true });
    }
    
    // Sincroniza Transações (Apenas as novas ou alteradas recentemente para evitar estouro de batch)
    const recentTx = transactions.slice(-100); 
    for (const tx of recentTx) {
        batch.set(doc(db, "transactions", tx.id), sanitizeForFirestore({ ...tx, userId: uid, updatedAt: serverTimestamp() }), { merge: true });
    }

    // Sincroniza Categorias (Opcional se precisar de backup na nuvem)
    for (const cat of categories) {
       batch.set(doc(db, "categories", cat.id), sanitizeForFirestore({ ...cat, updatedAt: serverTimestamp() }), { merge: true });
    }

    await batch.commit();
    await Promise.all([
        dbBulkPut('accounts', accounts),
        dbBulkPut('cards', cards),
        dbBulkPut('transactions', transactions),
        dbBulkPut('categories', categories)
    ]);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colMap: Record<ProductType, string> = { [ProductType.BASICA]: 'commission_basic', [ProductType.NATAL]: 'commission_natal', [ProductType.CUSTOM]: 'commission_custom' };
    const batch = writeBatch(db);
    rules.forEach(r => {
        batch.set(doc(db, colMap[type], r.id), { ...r, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
    await dbBulkPut(colMap[type] as any, rules);
};

export const saveReportConfig = async (config: ReportConfig) => {
    const uid = requireAuthUid();
    await setDoc(doc(db, "config", `report_${uid}`), config);
    localStorage.setItem(`sys_report_cfg_${uid}`, JSON.stringify(config));
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const uid = requireAuthUid();
    const snap = await getDoc(doc(db, "config", `report_${uid}`));
    return snap.exists() ? snap.data() as ReportConfig : { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const clearLocalCache = async () => {
    const dbInstance = await initDB();
    const stores = ['sales', 'accounts', 'transactions', 'clients'];
    for (const store of stores) {
        const tx = dbInstance.transaction(store as any, 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
    localStorage.removeItem('sys_session_v1');
};

// --- AUXILIARES ---
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

export const getUserPlanLabel = (user: User) => {
    if (user.role === 'DEV') return 'Developer Full';
    if (user.role === 'ADMIN') return 'Administrador';
    return 'Plano Standard';
};

export const formatCurrencyValue = (val: number): string => formatCurrency(val);

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();
    sales.forEach(s => {
        const date = new Date(s.date || s.completionDate || s.createdAt);
        const diffDays = Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const existing = clientsMap.get(s.client) || { name: s.client, totalSpent: 0, lastPurchaseDate: date, daysSinceLastPurchase: diffDays };
        existing.totalSpent += s.valueSold;
        if (date > existing.lastPurchaseDate) { existing.lastPurchaseDate = date; existing.daysSinceLastPurchase = diffDays; }
        clientsMap.set(s.client, existing);
    });
    return Array.from(clientsMap.values()).map(c => {
        let status = 'ACTIVE';
        if (c.daysSinceLastPurchase <= config.daysForNewClient) status = 'NEW';
        else if (c.daysSinceLastPurchase >= config.daysForLost) status = 'LOST';
        else if (c.daysSinceLastPurchase >= config.daysForInactive) status = 'INACTIVE';
        return { ...c, status };
    });
};

export const analyzeMonthlyVolume = (sales: Sale[], monthsCount: number) => {
    const result: any[] = [];
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthSales = sales.filter(s => {
            const sd = new Date(s.date || s.completionDate || s.createdAt);
            return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        });
        result.push({
            name: d.toLocaleDateString('pt-BR', { month: 'short' }),
            basica: monthSales.filter(s => s.type === ProductType.BASICA).reduce((acc, s) => acc + s.commissionValueTotal, 0),
            natal: monthSales.filter(s => s.type === ProductType.NATAL).reduce((acc, s) => acc + s.commissionValueTotal, 0)
        });
    }
    return result;
};

export const exportReportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + headers + "\n" + rows);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
