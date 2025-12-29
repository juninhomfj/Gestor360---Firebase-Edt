
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
import { dbPut, dbBulkPut, dbGetAll, initDB } from '../storage/db';
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
  const clean = String(value).replace(/[R$\s.]/g, '').replace(',', '.');
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
 * BOOTSTRAP — IDEMPOTENTE
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
    valueSold: ensureNumber(payload.valueSold),
    marginPercent: ensureNumber(payload.marginPercent),
    commissionValueTotal: ensureNumber(payload.commissionValueTotal),
    date: payload.date ? new Date(payload.date).toISOString() : null,
    deleted: payload.deleted || false,
    updatedAt: serverTimestamp()
  };
  
  // Dupla escrita síncrona
  await dbPut('sales', sale);
  await setDoc(doc(db, "sales", saleId), sale, { merge: true });
}

export async function getStoredSales(): Promise<Sale[]> {
  const uid = requireAuthUid();
  try {
      // Prioridade: Nuvem para sincronizar estados de importação
      const q = query(
        collection(db, "sales"), 
        where("userId", "==", uid), 
        where("deleted", "==", false)
      );
      const snap = await getDocs(q);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      
      // Atualiza o banco local com os dados da nuvem
      if (sales.length > 0) {
          await dbBulkPut('sales', sales);
      }
      
      return sales.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0).getTime();
          const dateB = new Date(b.date || b.createdAt || 0).getTime();
          return dateB - dateA;
      });
  } catch (e) {
      // Fallback para banco local se offline
      return await dbGetAll('sales', (s) => !s.deleted);
  }
}

export const saveSales = async (sales: Sale[]) => {
    const uid = requireAuthUid();
    const batch = writeBatch(db);
    
    // Atualiza cache local instantaneamente
    await dbBulkPut('sales', sales);

    sales.forEach(s => {
        batch.set(doc(db, "sales", s.id), { ...s, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
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

        return {
            ...c,
            status,
            daysSinceLastPurchase: daysSinceLast
        };
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

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = requireAuthUid();
    
    if (model === 'PROPORTIONAL') {
        const value = target / count;
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value, status: 'PENDING', userId: uid, deleted: false });
        }
    } else if (model === 'LINEAR') {
        const factor = target / (count * (count + 1) / 2);
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: i * factor, status: 'PENDING', userId: uid, deleted: false });
        }
    } else {
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: 0, status: 'PENDING', userId: uid, deleted: false });
        }
    }
    return cells;
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
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
};

export const processSalesImport = (data: any[][], mapping: any): SaleFormData[] => {
    const result: SaleFormData[] = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const client = String(row[mapping.client] || '').trim();
        if (!client) continue;

        const rawDate = row[mapping.date];
        let dateStr = '';
        if (rawDate instanceof Date) dateStr = rawDate.toISOString().split('T')[0];
        else if (rawDate) dateStr = String(rawDate).trim();

        const rawCompletion = row[mapping.completionDate];
        let completionDate = dateStr;
        if (rawCompletion instanceof Date) completionDate = rawCompletion.toISOString().split('T')[0];
        else if (rawCompletion) completionDate = String(rawCompletion).trim();

        const typeStr = String(row[mapping.type] || '').toUpperCase();
        let type = ProductType.BASICA;
        if (typeStr.includes('NATAL')) type = ProductType.NATAL;
        else if (typeStr.includes('CUSTOM') || typeStr.includes('PERSONALIZADO')) type = ProductType.CUSTOM;

        result.push({
            client,
            quantity: ensureNumber(row[mapping.quantity], 1),
            type,
            valueProposed: ensureNumber(row[mapping.valueProposed]),
            valueSold: ensureNumber(row[mapping.valueSold]),
            marginPercent: ensureNumber(row[mapping.margin]),
            date: dateStr || undefined,
            completionDate: completionDate || new Date().toISOString().split('T')[0],
            isBilled: !!dateStr,
            observations: String(row[mapping.obs] || '').trim()
        });
    }
    return result;
};

export const processFinanceImport = (data: any[][], mapping: any): Transaction[] => {
    const uid = requireAuthUid();
    const result: Transaction[] = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length < 2) continue;

        const rawDate = row[mapping.date];
        let date = new Date().toISOString();
        if (rawDate instanceof Date) date = rawDate.toISOString();
        else if (rawDate) date = new Date(rawDate).toISOString();

        const description = String(row[mapping.description] || 'Importado');
        const amount = ensureNumber(row[mapping.amount]);
        
        if (amount === 0) continue;

        result.push({
            id: crypto.randomUUID(),
            description,
            amount: Math.abs(amount),
            type: amount > 0 ? 'INCOME' : 'EXPENSE',
            date,
            categoryId: 'uncategorized',
            accountId: '', 
            isPaid: true,
            personType: 'PF',
            deleted: false,
            userId: uid,
            createdAt: new Date().toISOString()
        });
    }
    return result;
};

export const exportReportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

export async function getTrashItems() {
  const uid = requireAuthUid();
  try {
      const qSales = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", true));
      const qTrans = query(collection(db, "transactions"), where("userId", "==", uid), where("deleted", "==", true));
      const [sSnap, tSnap] = await Promise.all([getDocs(qSales), getDocs(qTrans)]);
      return { 
          sales: sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)), 
          transactions: tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)) 
      };
  } catch (e) {
      return { sales: [], transactions: [] };
  }
}

export const getDeletedClients = async () => {
    const uid = requireAuthUid();
    try {
        const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", true));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
    } catch (e) {
        return [];
    }
};

export const restoreClient = async (id:string) => { await updateDoc(doc(db, "clients", id), { deleted: false, updatedAt: serverTimestamp() }); };
export const permanentlyDeleteClient = async (id:string) => { await deleteDoc(doc(db, "clients", id)); };
export async function restoreItem(type: 'SALE' | 'TRANSACTION', item: any) {
  const col = type === 'SALE' ? "sales" : "transactions";
  await updateDoc(doc(db, col, item.id), { deleted: false, updatedAt: serverTimestamp() });
}
export async function permanentlyDeleteItem(type: 'SALE' | 'TRANSACTION', id: string) {
  const col = type === 'SALE' ? "sales" : "transactions";
  await deleteDoc(doc(db, col, id));
}

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  const base = valueProposed * quantity;
  const sortedRules = [...rules].sort((a,b) => b.minPercent - a.minPercent);
  const rule = sortedRules.find(r => margin >= r.minPercent);
  const rate = rule ? rule.commissionRate : 0;
  return { commissionBase: base, commissionValue: base * rate, rateUsed: rate };
};

export const getInvoiceMonth = (d: string, c: number) => {
    const date = new Date(d);
    if (date.getDate() > c) {
        date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString().substring(0, 7);
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colMap: Record<ProductType, string> = {
        [ProductType.BASICA]: 'commission_basic',
        [ProductType.NATAL]: 'commission_natal',
        [ProductType.CUSTOM]: 'commission_custom'
    };
    const colName = colMap[type];
    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
    } catch (e) {
        return [];
    }
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colMap: Record<ProductType, string> = {
        [ProductType.BASICA]: 'commission_basic',
        [ProductType.NATAL]: 'commission_natal',
        [ProductType.CUSTOM]: 'commission_custom'
    };
    const colName = colMap[type];
    const batch = writeBatch(db);

    try {
        const currentSnap = await getDocs(collection(db, colName));
        currentSnap.forEach(oldDoc => {
            batch.update(oldDoc.ref, { isActive: false, updatedAt: serverTimestamp() });
        });
        rules.forEach(rule => {
            const ref = doc(db, colName, rule.id || crypto.randomUUID());
            batch.set(ref, { ...rule, isActive: true, updatedAt: serverTimestamp() }, { merge: true });
        });
        await batch.commit();
    } catch (e) {
        throw e;
    }
};

export const saveFinanceData = async (
    accounts: FinanceAccount[], 
    cards: CreditCard[], 
    transactions: Transaction[], 
    categories: TransactionCategory[]
) => {
    const uid = requireAuthUid();
    const batch = writeBatch(db);
    
    // Atualiza local primeiro
    await dbBulkPut('accounts', accounts);
    await dbBulkPut('cards', cards);
    await dbBulkPut('transactions', transactions);
    await dbBulkPut('categories', categories);

    accounts.forEach(a => batch.set(doc(db, "accounts", a.id), { ...a, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    cards.forEach(c => batch.set(doc(db, "cards", c.id), { ...c, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    transactions.forEach(t => batch.set(doc(db, "transactions", t.id), { ...t, userId: uid, updatedAt: serverTimestamp() }, { merge: true }));
    categories.forEach(c => batch.set(doc(db, "categories", c.id), { ...c, updatedAt: serverTimestamp() }, { merge: true }));
    await batch.commit();
};

export const clearLocalCache = async () => {
    const stores = [
        'users', 'sales', 'accounts', 'transactions', 'clients', 
        'client_transfer_requests', 'commission_basic', 'commission_natal', 
        'commission_custom', 'config', 'cards', 'categories', 'goals', 
        'challenges', 'challenge_cells', 'receivables', 'wa_contacts', 
        'wa_tags', 'wa_campaigns', 'wa_queue', 'wa_manual_logs', 
        'wa_campaign_stats', 'audit_log'
    ];
    const dbInstance = await initDB();
    const tx = dbInstance.transaction(stores as any, 'readwrite');
    await Promise.all(stores.map(s => tx.objectStore(s as any).clear()));
    await tx.done;
};

export const hardResetLocalData = () => { localStorage.clear(); window.location.reload(); };
export const exportEncryptedBackup = async (p: string) => { alert("Recurso disponível em modo standalone."); };
export const importEncryptedBackup = async (file: File, p: string) => {};
export const clearAllSales = () => {};
export const findPotentialDuplicates = (sales: Sale[]): any[] => [];
export const smartMergeSales = (sales: Sale[]): Sale => sales[0];
