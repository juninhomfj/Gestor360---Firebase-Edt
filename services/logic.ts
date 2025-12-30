
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

/**
 * MOTOR DE NORMALIZAÇÃO NUMÉRICA (V3)
 * Resolve problemas de margens gigantes causadas por formatos brasileiros (45,87 -> 45.87)
 */
export function ensureNumber(value: any, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  
  let str = String(value).replace(/[R$\s%]/g, ''); // Remove R$, espaços e %
  
  // Lógica para detectar separador decimal
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    // Formato 1.234,56 -> Remove o ponto (milhar) e troca vírgula por ponto (decimal)
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Formato 1234,56 -> Troca vírgula por ponto
    str = str.replace(',', '.');
  }
  
  const num = parseFloat(str);
  return !isNaN(num) ? num : fallback;
}

function requireAuthUid(): string {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado");
  return uid;
}

function sanitizeForFirestore(obj: any): any {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        let val = obj[key];
        // Força conversão de tipos numéricos sensíveis
        if (['valueSold', 'valueProposed', 'marginPercent', 'quantity', 'commissionBaseTotal', 'commissionValueTotal', 'commissionRateUsed', 'amount', 'balance'].includes(key)) {
            val = ensureNumber(val);
        }
        if (val !== undefined) cleaned[key] = val;
    });
    return cleaned;
}

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; 
    return !!(user.permissions as any)[feature];
};

/**
 * LIMPEZA ATÔMICA POR TABELA
 * Permite selecionar quais módulos resetar.
 */
export const atomicClearUserTables = async (targetUserId: string, tables: string[]) => {
    const currentUid = requireAuthUid();
    const batch = writeBatch(db);
    
    Logger.log('CRASH', `INICIANDO RESET SELETIVO. Alvo: ${targetUserId}. Tabelas: ${tables.join(',')}`);

    for (const table of tables) {
        const q = query(collection(db, table), where("userId", "==", targetUserId));
        const snap = await getDocs(q);
        snap.docs.forEach(d => batch.delete(d.ref));
        
        // Limpa cache local se o alvo for o usuário atual
        if (targetUserId === currentUid) {
            const dbInstance = await initDB();
            if (dbInstance && (dbInstance.objectStoreNames as any).contains(table)) {
                const tx = dbInstance.transaction(table as any, 'readwrite');
                await tx.store.clear();
                await tx.done;
            }
        }
    }
    
    await batch.commit();
    Logger.log('INFO', `RESET CONCLUÍDO. Executor: ${currentUid}`);
};

export const getStoredSales = async (): Promise<Sale[]> => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) return []; // Aguarda o Firebase estar pronto

  const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
  const snap = await getDocs(q);
  const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
  
  if (sales.length > 0) {
      await dbBulkPut('sales', sales);
  }
  return sales;
};

export const saveSales = async (sales: Sale[]) => {
    const uid = requireAuthUid();
    const sanitizedSales = sales.map(s => sanitizeForFirestore({ ...s, userId: uid }));
    
    await dbBulkPut('sales', sanitizedSales);
    
    const CHUNK_SIZE = 450; 
    for (let i = 0; i < sanitizedSales.length; i += CHUNK_SIZE) {
        const chunk = sanitizedSales.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(s => {
            const { id, ...data } = s;
            batch.set(doc(db, "sales", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        });
        await batch.commit();
    }
};

export const saveSingleSale = async (payload: any) => {
  const uid = requireAuthUid();
  const saleId = payload.id || crypto.randomUUID();
  const sale = sanitizeForFirestore({ ...payload, id: saleId, userId: uid });
  
  await dbPut('sales', sale);
  await setDoc(doc(db, "sales", saleId), { ...sale, updatedAt: serverTimestamp() }, { merge: true });
};

export const saveFinanceData = async (accounts: FinanceAccount[], cards: CreditCard[], transactions: Transaction[], categories: TransactionCategory[]) => {
    const uid = requireAuthUid();
    const batch = writeBatch(db);
    
    for (const acc of accounts) {
        batch.set(doc(db, "accounts", acc.id), sanitizeForFirestore({ ...acc, userId: uid, updatedAt: serverTimestamp() }), { merge: true });
    }
    
    const recentTx = transactions.slice(-100); 
    for (const tx of recentTx) {
        batch.set(doc(db, "transactions", tx.id), sanitizeForFirestore({ ...tx, userId: uid, updatedAt: serverTimestamp() }), { merge: true });
    }

    await batch.commit();
    await Promise.all([
        dbBulkPut('accounts', accounts.map(a => sanitizeForFirestore(a))),
        dbBulkPut('cards', cards.map(c => sanitizeForFirestore(c))),
        dbBulkPut('transactions', transactions.map(t => sanitizeForFirestore(t))),
        dbBulkPut('categories', categories)
    ]);
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  const q = ensureNumber(quantity);
  const vp = ensureNumber(valueProposed);
  const m = ensureNumber(margin);
  
  const base = vp * q;
  const sortedRules = [...rules].sort((a,b) => b.minPercent - a.minPercent);
  const rule = sortedRules.find(r => m >= r.minPercent);
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
        if ((dbInstance.objectStoreNames as any).contains(store)) {
            const tx = dbInstance.transaction(store as any, 'readwrite');
            await tx.store.clear();
            await tx.done;
        }
    }
    localStorage.removeItem('sys_session_v1');
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

// --- FIX: EXPORTING MISSING MEMBERS ---

/**
 * Returns a label for the user's current plan based on role.
 * Fixes: Layout.tsx error
 */
export const getUserPlanLabel = (user: User): string => {
  if (user.role === 'DEV') return 'Enterprise Root';
  if (user.role === 'ADMIN') return 'Business Pro';
  return 'Standard Plan';
};

/**
 * Calculates CRM productivity metrics.
 * Fixes: ClientReports.tsx error
 */
export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
  const sales = await getStoredSales();
  const reportCfg = await getReportConfig();
  const clients = analyzeClients(sales, reportCfg);
  
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  
  const convertedThisMonth = sales.filter(s => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;
  
  const activeClients = clients.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
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

/**
 * Calculates daily safe spend pacing.
 * Fixes: FinanceDashboard.tsx error
 */
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
  const now = new Date();
  const today = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  let nextDay = salaryDays.find(d => d > today);
  let nextMonth = month;
  let nextYear = year;
  
  if (!nextDay) {
      nextDay = salaryDays[0];
      nextMonth = (month + 1) % 12;
      if (nextMonth === 0) nextYear++;
  }
  
  const nextDate = new Date(nextYear, nextMonth, nextDay);
  const diffTime = nextDate.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  const pendingExpenses = transactions
      .filter(t => t.type === 'EXPENSE' && !t.isPaid)
      .reduce((acc, t) => acc + t.amount, 0);
      
  const available = balance - pendingExpenses;
  const safeDailySpend = available / daysRemaining;
  
  return {
      daysRemaining,
      safeDailySpend: Math.max(0, safeDailySpend),
      pendingExpenses,
      nextIncomeDate: nextDate
  };
};

/**
 * Determines the target invoice month for a card expense.
 * Fixes: FinanceManager.tsx error
 */
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

/**
 * Generates an encrypted backup file.
 * Fixes: BackupModal.tsx, DataExportWizard.tsx errors
 */
export const exportEncryptedBackup = async (passphrase: string) => {
  const data = {
      sales: await dbGetAll('sales'),
      accounts: await dbGetAll('accounts'),
      transactions: await dbGetAll('transactions'),
      clients: await dbGetAll('clients'),
      receivables: await dbGetAll('receivables'),
      goals: await dbGetAll('goals'),
      challenges: await dbGetAll('challenges'),
      cells: await dbGetAll('challenge_cells'),
      config: await dbGetAll('config')
  };
  
  const json = JSON.stringify(data);
  const encrypted = encryptData(json); 
  
  const blob = new Blob([encrypted], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestor360_backup_${new Date().toISOString().slice(0,10)}.v360`;
  a.click();
};

/**
 * Restores data from an encrypted backup file.
 * Fixes: BackupModal.tsx error
 */
export const importEncryptedBackup = async (file: File, passphrase: string) => {
  const text = await file.text();
  const decrypted = decryptData(text); 
  if (!decrypted) throw new Error("Falha na descriptografia.");
  
  const data = JSON.parse(decrypted);
  if (data.sales) await dbBulkPut('sales', data.sales);
  if (data.accounts) await dbBulkPut('accounts', data.accounts);
  if (data.transactions) await dbBulkPut('transactions', data.transactions);
  if (data.clients) await dbBulkPut('clients', data.clients);
  if (data.receivables) await dbBulkPut('receivables', data.receivables);
  if (data.goals) await dbBulkPut('goals', data.goals);
  if (data.challenges) await dbBulkPut('challenges', data.challenges);
  if (data.cells) await dbBulkPut('challenge_cells', data.cells);
};

/**
 * Clears all sales from the database for the current user.
 * Fixes: BackupModal.tsx error
 */
export const clearAllSales = async () => {
    const uid = requireAuthUid();
    const batch = writeBatch(db);
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    const dbInstance = await initDB();
    const tx = dbInstance.transaction('sales', 'readwrite');
    await tx.store.clear();
    await tx.done;
};

/**
 * Generates cells for a savings challenge based on the selected model.
 * Fixes: FinanceChallenges.tsx error
 */
export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
  const cells: ChallengeCell[] = [];
  const uid = requireAuthUid();
  
  if (model === 'PROPORTIONAL') {
      const val = target / count;
      for (let i = 1; i <= count; i++) {
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
  } else if (model === 'LINEAR') {
      const factor = (2 * target) / (count * (count + 1));
      for (let i = 1; i <= count; i++) {
          cells.push({
              id: crypto.randomUUID(),
              challengeId,
              number: i,
              value: factor * i,
              status: 'PENDING',
              userId: uid,
              deleted: false
          });
      }
  } else {
      for (let i = 1; i <= count; i++) {
          cells.push({
              id: crypto.randomUUID(),
              challengeId,
              number: i,
              value: 0,
              status: 'PENDING',
              userId: uid,
              deleted: false
          });
      }
  }
  return cells;
};

/**
 * Reads an Excel or CSV file and returns its content as a 2D array.
 * Fixes: FinanceTransactionsList.tsx error
 */
export const readExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            resolve(json);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Processes a 2D array from an Excel file into a list of partial transactions.
 * Fixes: FinanceTransactionsList.tsx error
 */
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    const rows = data.slice(1);
    const transactions: Partial<Transaction>[] = [];
    const uid = requireAuthUid();

    rows.forEach(row => {
        const desc = mapping.description !== -1 ? String(row[mapping.description] || '') : '';
        const rawAmount = mapping.amount !== -1 ? ensureNumber(row[mapping.amount]) : 0;
        const date = mapping.date !== -1 ? String(row[mapping.date] || '') : new Date().toISOString();
        
        if (!desc || rawAmount === 0) return;

        transactions.push({
            id: crypto.randomUUID(),
            description: desc,
            amount: Math.abs(rawAmount),
            type: rawAmount > 0 ? 'INCOME' : 'EXPENSE',
            date: new Date(date).toISOString().split('T')[0],
            categoryId: 'uncategorized',
            isPaid: true,
            userId: uid,
            createdAt: new Date().toISOString(),
            deleted: false
        });
    });

    return transactions;
};

/**
 * Saves commission rules to Firestore and Local DB.
 * Fixes: App.tsx error
 */
export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colMap: Record<ProductType, string> = { 
        [ProductType.BASICA]: 'commission_basic', 
        [ProductType.NATAL]: 'commission_natal', 
        [ProductType.CUSTOM]: 'commission_custom' 
    };
    const collectionName = colMap[type];
    
    const batch = writeBatch(db);
    rules.forEach(rule => {
        const ref = doc(db, collectionName, rule.id);
        batch.set(ref, { ...rule, updatedAt: serverTimestamp() });
    });
    await batch.commit();
    await dbBulkPut(collectionName as any, rules);
};

/**
 * Ensures basic system configuration and data are available.
 * Fixes: App.tsx error
 */
export const bootstrapProductionData = async () => {
    const uid = requireAuthUid();
    const configRef = doc(db, "config", `system_${uid}`);
    const snap = await getDoc(configRef);
    
    if (!snap.exists()) {
        await setDoc(configRef, DEFAULT_SYSTEM_CONFIG);
        
        const defaultBasic: CommissionRule[] = [
            { id: crypto.randomUUID(), minPercent: 0, maxPercent: 5, commissionRate: 0.02, isActive: true },
            { id: crypto.randomUUID(), minPercent: 5, maxPercent: 10, commissionRate: 0.04, isActive: true },
            { id: crypto.randomUUID(), minPercent: 10, maxPercent: null, commissionRate: 0.06, isActive: true },
        ];
        await saveCommissionRules(ProductType.BASICA, defaultBasic);
    }
};

/**
 * Finds clients with potentially similar names for deduplication.
 * Fixes: ClientUnification.tsx error
 */
export const findPotentialDuplicates = (sales: Sale[]) => {
    const groups: { master: string, similar: string[] }[] = [];
    const names = Array.from(new Set(sales.map(s => s.client)));
    const processed = new Set<string>();

    for (let i = 0; i < names.length; i++) {
        if (processed.has(names[i])) continue;
        const master = names[i];
        const similar: string[] = [];
        
        for (let j = i + 1; j < names.length; j++) {
            const other = names[j];
            if (processed.has(other)) continue;
            
            if (master.toLowerCase() === other.toLowerCase() || 
                master.toLowerCase().includes(other.toLowerCase()) || 
                other.toLowerCase().includes(master.toLowerCase())) {
                similar.push(other);
                processed.add(other);
            }
        }
        
        if (similar.length > 0) {
            groups.push({ master, similar });
            processed.add(master);
        }
    }
    return groups;
};

/**
 * Merges a list of duplicate sales into a single master record.
 * Fixes: DeduplicationReview.tsx error
 */
export const smartMergeSales = (duplicates: Sale[]): Sale => {
    const master = { ...duplicates[0] };
    const others = duplicates.slice(1);
    
    others.forEach(s => {
        master.quantity += s.quantity;
        master.valueSold += s.valueSold;
        master.commissionBaseTotal += s.commissionBaseTotal;
        master.commissionValueTotal += s.commissionValueTotal;
        master.observations = (master.observations || '') + '\n' + (s.observations || '');
    });
    
    master.updatedAt = new Date().toISOString();
    return master;
};

/**
 * Returns clients marked as deleted (Trash).
 * Fixes: TrashBin.tsx error
 */
export const getDeletedClients = async (): Promise<Client[]> => {
    return await dbGetAll('clients', c => !!c.deleted);
};

/**
 * Restores a client from the trash bin.
 * Fixes: TrashBin.tsx error
 */
export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        const restored = { ...client, deleted: false, updatedAt: new Date().toISOString() };
        await dbPut('clients', restored);
        await updateDoc(doc(db, "clients", id), { deleted: false, updatedAt: serverTimestamp() });
    }
};

/**
 * Permanently removes a client from the database.
 * Fixes: TrashBin.tsx error
 */
export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
    await dbDelete('clients', id);
};
