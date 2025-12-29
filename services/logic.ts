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
 * ============================================================
 * UTILIDADES INTERNAS
 * ============================================================
 */

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

export const DEFAULT_PRODUCT_LABELS = { basica: 'Cesta Básica', natal: 'Cesta de Natal', custom: 'Personalizado' };
export const DEFAULT_REPORT_CONFIG: ReportConfig = { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = { 
    theme: 'glass', 
    modules: { 
        sales: true, finance: true, crm: true, whatsapp: true, 
        reports: true, ai: true, dev: false, settings: true, 
        news: true, receivables: true, distribution: true, imports: true 
    } 
};

/**
 * ============================================================
 * PERMISSÕES E CONFIG
 * ============================================================
 */

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user) return false;
    if (user.role === 'DEV') return true; 
    if (!user.isActive) return false;
    return !!(user.permissions as any)[feature];
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    try {
        const ref = doc(db, "config", "system_config");
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() as SystemConfig : DEFAULT_SYSTEM_CONFIG;
    } catch (e) {
        return DEFAULT_SYSTEM_CONFIG;
    }
};

export const saveSystemConfig = async (c: SystemConfig) => {
    await setDoc(doc(db, "config", "system_config"), { ...c, updatedAt: serverTimestamp() }, { merge: true });
};

export const getReportConfig = async () => DEFAULT_REPORT_CONFIG;
export const saveReportConfig = async (c: any) => {
    const ref = doc(db, "config", "report_config");
    await setDoc(ref, { ...c, updatedAt: serverTimestamp() }, { merge: true });
};
export const getUserPlanLabel = (user: User) => user.role;

/**
 * ============================================================
 * BOOTSTRAP
 * ============================================================
 */

export async function bootstrapProductionData() {
  const uid = requireAuthUid();
  const configRef = collection(db, "config");
  const configQ = query(configRef, where("isSeed", "==", true), limit(1));
  const configSnap = await getDocs(configQ);

  if (configSnap.empty) {
    await addDoc(configRef, {
      isSeed: true,
      bootstrapVersion: 3,
      createdAt: serverTimestamp(),
      userId: "system"
    });
  }

  const accountsRef = collection(db, "accounts");
  const accountsQ = query(accountsRef, where("userId", "==", uid), where("isSeed", "==", true), limit(1));
  const accountsSnap = await getDocs(accountsQ);

  if (accountsSnap.empty) {
    await addDoc(accountsRef, {
      name: "Conta Principal",
      balance: 0,
      isActive: true,
      isSeed: true,
      isAccounting: true,
      includeInDistribution: true,
      type: 'CHECKING',
      deleted: false,
      userId: uid,
      createdAt: serverTimestamp()
    });
  }
}

/**
 * ============================================================
 * SALES & CLIENTS
 * ============================================================
 */

export async function saveSingleSale(payload: any) {
  const uid = requireAuthUid();
  const saleId = payload.id || crypto.randomUUID();
  const sale = {
    ...payload,
    id: saleId,
    userId: uid,
    valueProposed: ensureNumber(payload.valueProposed),
    valueSold: ensureNumber(payload.valueSold),
    marginPercent: ensureNumber(payload.marginPercent),
    commissionValueTotal: ensureNumber(payload.commissionValueTotal),
    date: payload.date ? new Date(payload.date).toISOString() : null,
    deleted: payload.deleted || false,
    updatedAt: serverTimestamp()
  };
  
  await dbPut('sales', sale);
  await setDoc(doc(db, "sales", saleId), sale, { merge: true });
  Logger.info(`Venda individual salva: ${saleId}`, { client: sale.client });
}

export async function getStoredSales(): Promise<Sale[]> {
  const uid = requireAuthUid();
  try {
      const q = query(
        collection(db, "sales"), 
        where("userId", "==", uid), 
        where("deleted", "==", false)
      );
      const snap = await getDocs(q);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      
      if (sales.length > 0) {
          await dbBulkPut('sales', sales);
      }
      
      return sales.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0).getTime();
          const dateB = new Date(b.date || b.createdAt || 0).getTime();
          return dateB - dateA;
      });
  } catch (e) {
      return await dbGetAll('sales', (s) => !s.deleted);
  }
}

export const saveSales = async (sales: Sale[]) => {
    const uid = requireAuthUid();
    
    // 1. Gravação local rápida
    await dbBulkPut('sales', sales);
    Logger.info(`Iniciando salvamento em massa: ${sales.length} itens.`);

    // 2. Gravação em lotes (Firestore limit: 500)
    const CHUNK_SIZE = 450; 
    for (let i = 0; i < sales.length; i += CHUNK_SIZE) {
        const chunk = sales.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(s => {
            const { id, ...data } = s;
            batch.set(doc(db, "sales", id), { ...data, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
        });

        try {
            await batch.commit();
            Logger.info(`Lote Firestore enviado: registros ${i} a ${i + chunk.length}`);
        } catch (e: any) {
            Logger.error("Falha ao commitar lote no Firestore", { error: e.message });
            throw e;
        }
    }
};

export const getClients = async (): Promise<Client[]> => {
    const uid = requireAuthUid();
    try {
        const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        const clients = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        if (clients.length > 0) await dbBulkPut('clients', clients);
        return clients;
    } catch (e) {
        return await dbGetAll('clients', (c) => !c.deleted);
    }
};

/**
 * ============================================================
 * ANALYTICS & CRM
 * ============================================================
 */

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();

    sales.forEach(sale => {
        if (sale.deleted) return;
        const name = sale.client;
        const saleDate = new Date(sale.date || sale.completionDate || '1970-01-01');
        
        if (!clientsMap.has(name)) {
            clientsMap.set(name, {
                name,
                totalOrders: 0,
                totalSpent: 0,
                lastPurchaseDate: saleDate,
                firstPurchaseDate: saleDate
            });
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

    return {
        totalClients: clients.length,
        activeClients: activeClientsCount,
        convertedThisMonth,
        conversionRate,
        productivityStatus
    };
};

/**
 * ============================================================
 * FINANCE
 * ============================================================
 */

export async function getFinanceData() {
  const uid = requireAuthUid();
  const colls = ["transactions", "accounts", "cards", "receivables", "categories", "goals", "challenges", "challenge_cells"];
  const result: any = {};

  for (const col of colls) {
    try {
        const q = query(collection(db, col), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (result[col].length > 0) await dbBulkPut(col as any, result[col]);
    } catch (e: any) {
        result[col] = await dbGetAll(col as any, (i:any) => !i.deleted);
    }
  }
  return result;
}

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextSalaryDay = salaryDays.find(d => d > today) || salaryDays[0] || 30;
    
    let daysRemaining = nextSalaryDay - today;
    if (daysRemaining <= 0) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, nextSalaryDay);
        daysRemaining = Math.floor((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    const currentMonth = now.toISOString().substring(0, 7);
    const pendingExpenses = transactions
        .filter(t => t.type === 'EXPENSE' && !t.isPaid && t.date.startsWith(currentMonth))
        .reduce((acc, t) => acc + t.amount, 0);

    const available = balance - pendingExpenses;
    const safeDailySpend = available > 0 ? available / (daysRemaining || 1) : 0;

    return {
        daysRemaining,
        safeDailySpend,
        pendingExpenses,
        nextIncomeDate: new Date(now.getFullYear(), now.getMonth(), nextSalaryDay)
    };
};

/**
 * ============================================================
 * IMPORTS & UTILS
 * ============================================================
 */

export const readExcelFile = async (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(json as any[][]);
            } catch (err) {
                Logger.error("Erro no processamento do Excel", err);
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
};

export const processSalesImport = (data: any[][], mapping: any): SaleFormData[] => {
    const result: SaleFormData[] = [];
    Logger.info("Iniciando conversão de linhas da planilha", { totalRows: data.length });
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const client = String(row[mapping.client] || '').trim();
        if (!client) continue;

        const parseDate = (val: any) => {
            if (val instanceof Date) return val.toISOString().split('T')[0];
            if (!val) return null;
            const s = String(val).trim();
            if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
            const pts = s.split('/');
            if (pts.length === 3) return `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
            return null;
        };

        try {
            const dateStr = parseDate(row[mapping.date]);
            const completionDate = parseDate(row[mapping.completionDate]) || new Date().toISOString().split('T')[0];

            const typeStr = String(row[mapping.type] || '').toUpperCase();
            let type = ProductType.BASICA;
            if (typeStr.includes('NATAL')) type = ProductType.NATAL;

            result.push({
                client,
                quantity: ensureNumber(row[mapping.quantity], 1),
                type,
                valueProposed: ensureNumber(row[mapping.valueProposed]),
                valueSold: ensureNumber(row[mapping.valueSold]),
                marginPercent: ensureNumber(row[mapping.margin]),
                date: dateStr || undefined,
                completionDate: completionDate,
                isBilled: !!dateStr,
                observations: String(row[mapping.obs] || '').trim()
            });
        } catch (err: any) {
            Logger.error(`Erro ao processar linha ${i}`, { client, error: err.message });
        }
    }
    return result;
};

export const processFinanceImport = (data: any[][], mapping: any): Transaction[] => {
  const result: Transaction[] = [];
  const uid = requireAuthUid();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const description = String(row[mapping.description] || '').trim();
    if (!description) continue;

    const amount = ensureNumber(row[mapping.amount]);
    const type = row[mapping.type] 
      ? (String(row[mapping.type]).toUpperCase().includes('RECEITA') ? 'INCOME' : 'EXPENSE')
      : (amount >= 0 ? 'INCOME' : 'EXPENSE');

    let dateStr = new Date().toISOString().split('T')[0];
    const dateVal = row[mapping.date];
    if (dateVal instanceof Date) dateStr = dateVal.toISOString().split('T')[0];
    else if (dateVal) {
      const s = String(dateVal).trim();
      const pts = s.split('/');
      if (pts.length === 3) dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
      else if (s.match(/^\d{4}-\d{2}-\d{2}$/)) dateStr = s;
    }

    result.push({
      id: crypto.randomUUID(),
      description,
      amount: Math.abs(amount),
      type: type as any,
      date: dateStr,
      accountId: '', 
      categoryId: 'uncategorized',
      isPaid: true,
      createdAt: new Date().toISOString(),
      userId: uid,
      deleted: false
    });
  }
  return result;
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

export const clearLocalCache = async () => {
    const dbInstance = await initDB();
    const stores = Array.from(dbInstance.objectStoreNames);
    const tx = dbInstance.transaction(stores as any, 'readwrite');
    for (const storeName of stores) {
        await tx.objectStore(storeName as any).clear();
    }
    await tx.done;
    Logger.info("Cache local limpo manualmente.");
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  const base = valueProposed * quantity;
  const sortedRules = [...rules].sort((a,b) => b.minPercent - a.minPercent);
  const rule = sortedRules.find(r => margin >= r.minPercent);
  const rate = rule ? rule.commissionRate : 0;
  return { commissionBase: base, commissionValue: base * rate, rateUsed: rate };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return new Date().toISOString().substring(0, 7);
  const day = date.getDate();
  const invoiceDate = new Date(date.getFullYear(), date.getMonth(), 1);
  if (day >= closingDay) invoiceDate.setMonth(invoiceDate.getMonth() + 1);
  return invoiceDate.toISOString().substring(0, 7);
};

export const exportEncryptedBackup = async (passphrase: string) => {
  const data = {
    sales: await dbGetAll('sales'),
    accounts: await dbGetAll('accounts'),
    cards: await dbGetAll('cards'),
    transactions: await dbGetAll('transactions'),
    categories: await dbGetAll('categories'),
    goals: await dbGetAll('goals'),
    challenges: await dbGetAll('challenges'),
    challenge_cells: await dbGetAll('challenge_cells'),
    receivables: await dbGetAll('receivables'),
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
  const text = await file.text();
  const decrypted = decryptData(text);
  if (!decrypted) throw new Error("Chave incorreta ou arquivo corrompido.");
  const data = JSON.parse(decrypted);
  for (const store of Object.keys(data)) {
    if (Array.isArray(data[store])) await dbBulkPut(store as any, data[store]);
  }
};

export const clearAllSales = async () => {
    const dbInstance = await initDB();
    const tx = dbInstance.transaction('sales', 'readwrite');
    await tx.store.clear();
    await tx.done;
};

export const generateChallengeCells = (challengeId: string, targetValue: number, count: number, model: ChallengeModel): ChallengeCell[] => {
  const cells: ChallengeCell[] = [];
  const uid = requireAuthUid();
  for (let i = 1; i <= count; i++) {
    let value = model === 'LINEAR' ? (i * (targetValue / ((count * (count + 1)) / 2))) : (targetValue / count);
    cells.push({
      id: crypto.randomUUID(), challengeId, number: i, value: parseFloat(value.toFixed(2)),
      status: 'PENDING', userId: uid, deleted: false
    });
  }
  return cells;
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

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colMap: Record<ProductType, string> = {
        [ProductType.BASICA]: 'commission_basic', [ProductType.NATAL]: 'commission_natal', [ProductType.CUSTOM]: 'commission_custom'
    };
    const colName = colMap[type];
    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
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
    await dbBulkPut('accounts', acc);
    await dbBulkPut('cards', cards);
    await dbBulkPut('transactions', trans);
    await dbBulkPut('categories', cats);
    acc.forEach(a => batch.set(doc(db, "accounts", a.id), { ...a, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    cards.forEach(c => batch.set(doc(db, "cards", c.id), { ...c, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    trans.forEach(t => batch.set(doc(db, "transactions", t.id), { ...t, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    cats.forEach(c => batch.set(doc(db, "categories", c.id), { ...c, updatedAt: serverTimestamp() }, { merge: true }));
    await batch.commit();
};

export const hardResetLocalData = () => { localStorage.clear(); window.location.reload(); };
export const findPotentialDuplicates = (sales: Sale[]): any[] => [];
export const smartMergeSales = (sales: Sale[]): Sale => sales[0];
