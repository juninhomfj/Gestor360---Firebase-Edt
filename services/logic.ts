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
    DuplicateGroup, ProductivityMetrics, SaleFormData, SaleStatus
} from '../types';

/**
 * MONITOR DE TRÁFEGO DE SESSÃO
 */
export const SessionTraffic = {
    reads: 0,
    writes: 0,
    lastActivity: null as Date | null,
    status: 'IDLE' as 'IDLE' | 'BUSY' | 'OFFLINE',
    
    trackRead(count = 1) {
        this.reads += count;
        this.lastActivity = new Date();
    },
    trackWrite(count = 1) {
        this.writes += count;
        this.lastActivity = new Date();
    }
};

function requireAuthUid(): string {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Usuário não autenticado");
  }
  return uid;
}

function ensureNumber(value: any, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (!value) return fallback;
  const clean = String(value).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return !isNaN(num) ? num : fallback;
}

function sanitizeForFirestore(obj: any): any {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            cleaned[key] = obj[key];
        }
    });
    return cleaned;
}

// Added missing canAccess function
/**
 * Controle de Acesso Centralizado
 */
export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; 
    return !!(user.permissions as any)[feature];
};

// Added missing getUserPlanLabel function
export const getUserPlanLabel = (user: User): string => {
    if (user.role === 'DEV') return 'Developer Plan';
    if (user.role === 'ADMIN') return 'Business Plan';
    return 'User Plan';
};

// Added missing calculateFinancialPacing function
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Encontra o próximo dia de salário
    let nextSalaryDay = salaryDays.find(d => d > currentDay);
    let nextIncomeDate: Date;

    if (nextSalaryDay) {
        nextIncomeDate = new Date(currentYear, currentMonth, nextSalaryDay);
    } else {
        // Se não houver dia maior no mês atual, pega o primeiro do próximo mês
        const sortedDays = [...salaryDays].sort((a, b) => a - b);
        nextIncomeDate = new Date(currentYear, currentMonth + 1, sortedDays[0] || 1);
    }

    const diffTime = nextIncomeDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Despesas pendentes até o próximo recebimento
    const pendingExpenses = transactions
        .filter(t => t.type === 'EXPENSE' && !t.isPaid && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = (balance - pendingExpenses) / daysRemaining;

    return {
        daysRemaining,
        safeDailySpend: Math.max(0, safeDailySpend),
        pendingExpenses,
        nextIncomeDate
    };
};

// Added missing getInvoiceMonth function
export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    // Se o dia for após o fechamento, cai no próximo mês
    if (day >= closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().substring(0, 7); // YYYY-MM
};

// Added missing exportEncryptedBackup function
export const exportEncryptedBackup = async (passphrase: string) => {
    const uid = requireAuthUid();
    const sales = await dbGetAll('sales');
    const transactions = await dbGetAll('transactions');
    const accounts = await dbGetAll('accounts');
    const cards = await dbGetAll('cards');
    const categories = await dbGetAll('categories');
    const clients = await dbGetAll('clients');

    const data = {
        version: '2.5.0',
        exportedAt: new Date().toISOString(),
        uid,
        payload: { sales, transactions, accounts, cards, categories, clients }
    };

    const json = JSON.stringify(data);
    const encrypted = encryptData(json);
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `backup_gestor360_${new Date().getTime()}.v360`);
    link.click();
};

// Added missing importEncryptedBackup function
export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = decryptData(text);
    if (!decrypted) throw new Error("Falha na descriptografia");
    
    const data = JSON.parse(decrypted);
    if (data.payload.sales) await dbBulkPut('sales', data.payload.sales);
    if (data.payload.transactions) await dbBulkPut('transactions', data.payload.transactions);
    if (data.payload.accounts) await dbBulkPut('accounts', data.payload.accounts);
    if (data.payload.cards) await dbBulkPut('cards', data.payload.cards);
    if (data.payload.categories) await dbBulkPut('categories', data.payload.categories);
    if (data.payload.clients) await dbBulkPut('clients', data.payload.clients);
};

// Added missing clearAllSales function
export const clearAllSales = async () => {
    const dbInstance = await initDB();
    const tx = dbInstance.transaction('sales', 'readwrite');
    await tx.store.clear();
    await tx.done;
};

// Added missing saveSystemConfig function
export const saveSystemConfig = async (cfg: SystemConfig) => {
    const ref = doc(db, "config", "system_config");
    await setDoc(ref, cfg, { merge: true });
};

// Added missing DEFAULT_SYSTEM_CONFIG constant
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    theme: 'glass',
    includeNonAccountingInTotal: false,
    productLabels: { basica: 'Cesta Básica', natal: 'Natal', custom: 'Custom' }
};

// Added missing generateChallengeCells function
export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = requireAuthUid();
    
    for (let i = 1; i <= count; i++) {
        let value = 0;
        if (model === 'LINEAR') {
            const sumIndices = (count * (count + 1)) / 2;
            value = (target / sumIndices) * i;
        } else if (model === 'PROPORTIONAL') {
            value = target / count;
        }
        
        cells.push({
            id: crypto.randomUUID(),
            challengeId,
            number: i,
            value,
            status: 'PENDING',
            userId: uid,
            deleted: false
        });
    }
    return cells;
};

// Added missing processFinanceImport function
export const processFinanceImport = (rows: any[][], mapping: ImportMapping): Transaction[] => {
    const uid = requireAuthUid();
    return rows.slice(1).map(row => {
        const amount = ensureNumber(row[mapping.amount]);
        const type = row[mapping.type] 
            ? (String(row[mapping.type]).toLowerCase().includes('receita') || String(row[mapping.type]).toLowerCase().includes('entrada') ? 'INCOME' : 'EXPENSE')
            : (amount >= 0 ? 'INCOME' : 'EXPENSE');

        return {
            id: crypto.randomUUID(),
            description: String(row[mapping.description] || 'Importado'),
            amount: Math.abs(amount),
            type,
            date: String(row[mapping.date] || new Date().toISOString().split('T')[0]),
            categoryId: 'uncategorized',
            accountId: '', 
            isPaid: true,
            deleted: false,
            createdAt: new Date().toISOString(),
            userId: uid
        } as Transaction;
    });
};

// Added missing readExcelFile function
export const readExcelFile = async (file: File): Promise<any[][]> => {
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

// Added missing DEFAULT_PRODUCT_LABELS constant
export const DEFAULT_PRODUCT_LABELS = { basica: 'Básica', natal: 'Natal', custom: 'Custom' };

// Added missing processSalesImport function
export const processSalesImport = (rows: any[][], mapping: ImportMapping): SaleFormData[] => {
    return rows.slice(1).map(row => ({
        client: String(row[mapping.client] || ''),
        quantity: ensureNumber(row[mapping.quantity], 1),
        type: String(row[mapping.type]).toUpperCase().includes('NATAL') ? ProductType.NATAL : ProductType.BASICA,
        valueProposed: ensureNumber(row[mapping.valueProposed]),
        valueSold: ensureNumber(row[mapping.valueSold]),
        marginPercent: ensureNumber(row[mapping.margin]),
        completionDate: String(row[mapping.completionDate] || new Date().toISOString().split('T')[0]),
        date: row[mapping.date] ? String(row[mapping.date]) : undefined,
        isBilled: !!row[mapping.date],
        observations: String(row[mapping.obs] || '')
    }));
};

// Added missing formatCurrency function
export const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

/**
 * MOTOR DE CÁLCULO CORE (Governança Estrita)
 * REVISADO: Não muda a base, apenas garante que o percentual seja aplicado corretamente.
 */
export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  const base = valueProposed * quantity;
  const sortedRules = [...rules].sort((a,b) => b.minPercent - a.minPercent);
  const rule = sortedRules.find(r => margin >= r.minPercent);
  
  let rate = rule ? rule.commissionRate : 0;
  // AUTO-NORMALIZAÇÃO: Garante que 5% seja sempre 0.05 no cálculo, independente de como foi salvo.
  if (rate > 1) rate = rate / 100; 

  const rawCommission = base * rate;
  const commissionValue = Math.round((rawCommission + Number.EPSILON) * 100) / 100;

  return { 
      commissionBase: base, 
      commissionValue: commissionValue, 
      rateUsed: rate 
  };
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    try {
        const ref = doc(db, "config", "system_config");
        const snap = await getDoc(ref);
        SessionTraffic.trackRead();
        return snap.exists() ? snap.data() as SystemConfig : { theme: 'glass' };
    } catch (e) {
        return { theme: 'glass' };
    }
};

export const getReportConfig = async () => ({ daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 });

export async function saveSingleSale(payload: any) {
  const uid = requireAuthUid();
  const saleId = payload.id || crypto.randomUUID();
  const sale = sanitizeForFirestore({
    ...payload,
    id: saleId,
    userId: uid,
    updatedAt: serverTimestamp()
  });
  
  await dbPut('sales', sale);
  await setDoc(doc(db, "sales", saleId), sale, { merge: true });
  SessionTraffic.trackWrite();
}

export async function getStoredSales(): Promise<Sale[]> {
  const uid = requireAuthUid();
  try {
      const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
      const snap = await getDocs(q);
      SessionTraffic.trackRead(snap.size);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      if (sales.length > 0) await dbBulkPut('sales', sales);
      return sales;
  } catch (e) {
      return await dbGetAll('sales', (s) => !s.deleted);
  }
}

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
        SessionTraffic.trackWrite(chunk.length);
    }
};

export const getClients = async (): Promise<Client[]> => {
    const uid = requireAuthUid();
    try {
        const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const clients = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        if (clients.length > 0) await dbBulkPut('clients', clients);
        return clients;
    } catch (e) {
        return await dbGetAll('clients', (c) => !c.deleted);
    }
};

export async function getFinanceData() {
  const uid = requireAuthUid();
  const colls = ["transactions", "accounts", "cards", "receivables", "categories", "goals", "challenges", "challenge_cells"];
  const result: any = {};
  for (const col of colls) {
    try {
        const q = query(collection(db, col), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (result[col].length > 0) await dbBulkPut(col as any, result[col]);
    } catch (e: any) {
        result[col] = await dbGetAll(col as any, (i:any) => !i.deleted);
    }
  }
  return result;
}

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colMap: Record<ProductType, string> = {
        [ProductType.BASICA]: 'commission_basic', [ProductType.NATAL]: 'commission_natal', [ProductType.CUSTOM]: 'commission_custom'
    };
    const colName = colMap[type];
    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
    } catch (e) { return []; }
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colMap: Record<ProductType, string> = {
        [ProductType.BASICA]: 'commission_basic', [ProductType.NATAL]: 'commission_natal', [ProductType.CUSTOM]: 'commission_custom'
    };
    const colName = colMap[type];
    const batch = writeBatch(db);
    const currentSnap = await getDocs(collection(db, colName));
    currentSnap.forEach(oldDoc => batch.update(oldDoc.ref, { isActive: false, updatedAt: serverTimestamp() }));
    rules.forEach(rule => {
        const ref = doc(db, colName, rule.id || crypto.randomUUID());
        batch.set(ref, { ...rule, isActive: true, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
};

export const saveFinanceData = async (acc: FinanceAccount[], cards: CreditCard[], trans: Transaction[], cats: TransactionCategory[]) => {
    const uid = requireAuthUid();
    const batch = writeBatch(db);
    acc.forEach(a => batch.set(doc(db, "accounts", a.id), { ...a, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    cards.forEach(c => batch.set(doc(db, "cards", c.id), { ...c, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    trans.forEach(t => batch.set(doc(db, "transactions", t.id), { ...t, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    cats.forEach(c => batch.set(doc(db, "categories", c.id), { ...c, updatedAt: serverTimestamp() }, { merge: true }));
    await batch.commit();
};

export async function bootstrapProductionData() {
  const uid = requireAuthUid();
  const configRef = collection(db, "config");
  const configQ = query(configRef, where("isSeed", "==", true), limit(1));
  const configSnap = await getDocs(configQ);
  if (configSnap.empty) {
    await addDoc(configRef, { isSeed: true, bootstrapVersion: 3, createdAt: serverTimestamp(), userId: "system" });
  }
}

export const clearLocalCache = async () => {
    const dbInstance = await initDB();
    const stores = Array.from(dbInstance.objectStoreNames);
    const tx = dbInstance.transaction(stores as any, 'readwrite');
    for (const storeName of stores) { await tx.objectStore(storeName as any).clear(); }
    await tx.done;
};

export const exportReportToCSV = (data: any[], fileName: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const csvContent = "\uFEFF" + headers + "\n" + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();
    sales.forEach(sale => {
        if (sale.deleted) return;
        const name = sale.client;
        const saleDate = new Date(sale.date || sale.completionDate || '1970-01-01');
        if (!clientsMap.has(name)) {
            clientsMap.set(name, { name, totalOrders: 0, totalSpent: 0, lastPurchaseDate: saleDate, firstPurchaseDate: saleDate });
        }
        const c = clientsMap.get(name);
        c.totalOrders += 1;
        c.totalSpent += sale.valueSold * sale.quantity;
        if (saleDate > c.lastPurchaseDate) c.lastPurchaseDate = saleDate;
        if (saleDate < c.firstPurchaseDate) c.firstPurchaseDate = saleDate;
    });
    return Array.from(clientsMap.values()).map(c => {
        const daysSinceLast = Math.floor((now.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceFirst = Math.floor((now.getTime() - c.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        let status = 'ACTIVE';
        if (daysSinceLast > config.daysForLost) status = 'LOST';
        else if (daysSinceLast > config.daysForInactive) status = 'INACTIVE';
        else if (daysSinceFirst <= config.daysForNewClient) status = 'NEW';
        return { ...c, status, daysSinceLastPurchase: daysSinceLast };
    });
};

export const analyzeMonthlyVolume = (sales: Sale[], monthsCount: number) => {
    const result = [];
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7);
        const name = d.toLocaleDateString('pt-BR', { month: 'short' });
        const monthSales = sales.filter(s => (s.date || '').startsWith(key));
        result.push({
            name,
            basica: monthSales.filter(s => s.type === ProductType.BASICA).reduce((acc, s) => acc + s.quantity, 0),
            natal: monthSales.filter(s => s.type === ProductType.NATAL).reduce((acc, s) => acc + s.quantity, 0)
        });
    }
    return result;
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const clients = await getClients();
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const convertedThisMonth = new Set(sales.filter(s => (s.date || '').startsWith(currentMonth)).map(s => s.client)).size;
    const activeClientsCount = clients.length || 1;
    const conversionRate = (convertedThisMonth / activeClientsCount) * 100;
    let productivityStatus: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (conversionRate >= 70) productivityStatus = 'GREEN';
    else if (conversionRate >= 40) productivityStatus = 'YELLOW';
    return { totalClients: clients.length, activeClients: activeClientsCount, convertedThisMonth, conversionRate, productivityStatus };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
  const col = type === 'SALE' ? "sales" : "transactions";
  const updated = { ...item, deleted: false, updatedAt: new Date().toISOString() };
  await dbPut(col as any, updated);
  await updateDoc(doc(db, col, item.id), { deleted: false, updatedAt: serverTimestamp() });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
  const col = type === 'SALE' ? "sales" : "transactions";
  await dbDelete(col as any, id);
  await deleteDoc(doc(db, col, id));
};

export const getTrashItems = async () => {
  const sales = await dbGetAll('sales', (s) => !!s.deleted);
  const transactions = await dbGetAll('transactions', (t) => !!t.deleted);
  return { sales, transactions };
};

export const getDeletedClients = async (): Promise<Client[]> => dbGetAll('clients', (c) => !!c.deleted);

export const restoreClient = async (id: string) => {
  const client = await dbGet('clients', id);
  if (client) {
    const updated = { ...client, deleted: false, updatedAt: new Date().toISOString() };
    await dbPut('clients', updated);
    await setDoc(doc(db, "clients", id), { ...updated, updatedAt: serverTimestamp() }, { merge: true });
  }
};

export const permanentlyDeleteClient = async (id: string) => {
  await dbDelete('clients', id);
  await deleteDoc(doc(db, "clients", id));
};

export const saveReportConfig = async (c: any) => {
    const ref = doc(db, "config", "report_config");
    await setDoc(ref, { ...c, updatedAt: serverTimestamp() }, { merge: true });
};

export const canUserSeeClient = (client: Client, userId: string): boolean => client.userId === userId;
export const findPotentialDuplicates = (sales: Sale[]): any[] => [];
export const smartMergeSales = (sales: Sale[]): Sale => sales[0];
export const toSnakeCase = (obj: any): any => obj;
