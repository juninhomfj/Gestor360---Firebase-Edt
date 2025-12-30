
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
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import * as XLSX from 'xlsx';
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import { Logger } from './logger';
import { encryptData, decryptData } from '../utils/encryption';
import { 
    User, Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, ChallengeModel, Client, 
    DuplicateGroup, ProductivityMetrics, SaleFormData, SaleStatus, Challenge
} from '../types';

export const SessionTraffic = {
    reads: 0,
    writes: 0,
    lastActivity: null as Date | null,
    status: 'IDLE' as 'IDLE' | 'BUSY' | 'OFFLINE',
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
};

function requireAuthUid(): string {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado");
  return uid;
}

/**
 * TRATAMENTO DE NÚMEROS DE ALTA PRECISÃO
 * Revisado: Garante que "45,87" vire 45.87 e não 4587.
 */
function ensureNumber(value: any, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  
  // Limpa caracteres de moeda e espaços. 
  // IMPORTANTE: Preserva a última vírgula ou ponto como decimal e remove outros separadores.
  let str = String(value).replace(/[R$\s]/g, '');
  
  // Detecta se o formato usa vírgula como decimal (padrão BR)
  if (str.includes(',') && !str.includes('.')) {
      str = str.replace(',', '.');
  } else if (str.includes(',') && str.includes('.')) {
      // Formato misto (ex: 1.234,56). Remove o ponto e troca vírgula por ponto.
      str = str.replace(/\./g, '').replace(',', '.');
  }
    
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

/**
 * LIMPEZA DEFINITIVA PERSONALIZADA
 * Deleta fisicamente os registros de um usuário específico ou do logado.
 */
export const permanentlyClearAllSalesFirestore = async (targetUserId?: string) => {
    const currentUid = requireAuthUid();
    const uidToDelete = targetUserId || currentUid;
    
    // Proteção: Apenas DEV pode deletar dados de outros
    const { getSession } = await import('./auth');
    const session = getSession();
    if (targetUserId && session?.role !== 'DEV') {
        throw new Error("Apenas desenvolvedores podem realizar limpeza atômica em outros perfis.");
    }

    const q = query(collection(db, "sales"), where("userId", "==", uidToDelete));
    const snap = await getDocs(q);
    
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    // Se for o próprio usuário limpando, limpa o cache local também
    if (uidToDelete === currentUid) {
        const dbInstance = await initDB();
        if (dbInstance) {
            const tx = dbInstance.transaction('sales', 'readwrite');
            await tx.store.clear();
            await tx.done;
        }
    }
    
    SessionTraffic.trackWrite(snap.size);
    Logger.log('CRASH', `LIMPEZA ATÔMICA EXECUTADA. Perfil Alvo: ${uidToDelete}. Executor: ${currentUid}. Itens: ${snap.size}`);
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
  try {
      const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
      const snap = await getDocs(q);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      if (sales.length > 0) await dbBulkPut('sales', sales);
      return sales;
  } catch (e) { return await dbGetAll('sales', (s) => !s.deleted); }
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

export const processSalesImport = (rows: any[][], mapping: any): SaleFormData[] => {
    return rows.slice(1).map((row, index) => {
        const rawMargin = row[mapping.margin];
        const marginValue = ensureNumber(rawMargin);

        return {
            client: String(row[mapping.client] || 'Cliente Desconhecido'),
            quantity: ensureNumber(row[mapping.quantity], 1),
            type: String(row[mapping.type]).toUpperCase().includes('NATAL') ? ProductType.NATAL : ProductType.BASICA,
            valueProposed: ensureNumber(row[mapping.valueProposed]),
            valueSold: ensureNumber(row[mapping.valueSold]),
            marginPercent: marginValue,
            completionDate: String(row[mapping.completionDate] || new Date().toISOString().split('T')[0]),
            date: row[mapping.date] ? String(row[mapping.date]) : undefined,
            isBilled: !!row[mapping.date],
            observations: String(row[mapping.obs] || '')
        };
    });
};

export const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    const ref = doc(db, "config", "system_config");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as SystemConfig : { theme: 'glass' };
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colMap: Record<ProductType, string> = { [ProductType.BASICA]: 'commission_basic', [ProductType.NATAL]: 'commission_natal', [ProductType.CUSTOM]: 'commission_custom' };
    const q = query(collection(db, colMap[type]), where("isActive", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
};

export const getClients = async (): Promise<Client[]> => {
    const uid = requireAuthUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
};

export const saveSingleSale = async (payload: any) => {
  const uid = requireAuthUid();
  const saleId = payload.id || crypto.randomUUID();
  const sale = sanitizeForFirestore({ ...payload, id: saleId, userId: uid, updatedAt: serverTimestamp() });
  await dbPut('sales', sale);
  await setDoc(doc(db, "sales", saleId), sale, { merge: true });
};

export const getTrashItems = async () => {
  const sales = await dbGetAll('sales', (s) => !!s.deleted);
  const transactions = await dbGetAll('transactions', (t) => !!t.deleted);
  return { sales, transactions };
};

export const getDeletedClients = async (): Promise<Client[]> => dbGetAll('clients', (c) => !!c.deleted);
export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
  const col = type === 'SALE' ? "sales" : "transactions";
  await updateDoc(doc(db, col, item.id), { deleted: false, updatedAt: serverTimestamp() });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
  const col = type === 'SALE' ? "sales" : "transactions";
  await deleteDoc(doc(db, col, id));
};

export const getUserPlanLabel = (user: User) => {
    if (user.role === 'DEV') return 'Developer Full';
    if (user.role === 'ADMIN') return 'Administrador';
    return 'Plano Standard';
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();

    sales.forEach(s => {
        const client = s.client;
        const date = new Date(s.date || s.completionDate || s.createdAt);
        const diffDays = Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        
        const existing = clientsMap.get(client) || { 
            name: client, 
            totalSpent: 0, 
            totalOrders: 0, 
            lastPurchaseDate: date, 
            daysSinceLastPurchase: diffDays 
        };

        existing.totalSpent += s.valueSold;
        existing.totalOrders += 1;
        if (date > existing.lastPurchaseDate) {
            existing.lastPurchaseDate = date;
            existing.daysSinceLastPurchase = diffDays;
        }
        clientsMap.set(client, existing);
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
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const monthSales = sales.filter(s => {
            const sd = new Date(s.date || s.completionDate || s.createdAt);
            return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        });
        result.push({
            name: label,
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
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const analyzed = analyzeClients(sales, config);
    const now = new Date();
    const thisMonthSales = sales.filter(s => {
        const d = new Date(s.date || s.completionDate || s.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    const active = analyzed.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const converted = new Set(thisMonthSales.map(s => s.client)).size;
    const rate = active > 0 ? (converted / active) * 100 : 0;
    
    return {
        totalClients: analyzed.length,
        activeClients: active,
        convertedThisMonth: converted,
        conversionRate: rate,
        productivityStatus: rate >= 70 ? 'GREEN' : (rate >= 40 ? 'YELLOW' : 'RED')
    };
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    let nextDay = salaryDays.find(d => d > today) || salaryDays[0];
    let nextDate = new Date(now.getFullYear(), now.getMonth() + (nextDay <= today ? 1 : 0), nextDay);
    
    const daysRemaining = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const pendingExpenses = transactions.filter(t => !t.isPaid && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    
    return {
        daysRemaining,
        safeDailySpend: Math.max(0, (balance - pendingExpenses) / (daysRemaining || 1)),
        pendingExpenses,
        nextIncomeDate: nextDate
    };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    if (day >= closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().slice(0, 7);
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const data = {
        sales: await dbGetAll('sales'),
        transactions: await dbGetAll('transactions'),
        accounts: await dbGetAll('accounts'),
        cards: await dbGetAll('cards'),
        categories: await dbGetAll('categories'),
        goals: await dbGetAll('goals'),
        receivables: await dbGetAll('receivables'),
        clients: await dbGetAll('clients')
    };
    const encrypted = encryptData(JSON.stringify(data));
    const blob = new Blob([encrypted], { type: 'application/v360' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().slice(0,10)}.v360`;
    a.click();
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = decryptData(text);
    if (!decrypted) throw new Error("Senha incorreta ou arquivo corrompido.");
    const data = JSON.parse(decrypted);
    if (data.sales) await dbBulkPut('sales', data.sales);
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
    if (data.cards) await dbBulkPut('cards', data.cards);
    if (data.categories) await dbBulkPut('categories', data.categories);
    if (data.goals) await dbBulkPut('goals', data.goals);
    if (data.receivables) await dbBulkPut('receivables', data.receivables);
    if (data.clients) await dbBulkPut('clients', data.clients);
};

export const clearAllSales = async () => permanentlyClearAllSalesFirestore();

export const saveSystemConfig = async (config: SystemConfig) => {
    await setDoc(doc(db, "config", "system_config"), config, { merge: true });
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = { theme: 'glass' };

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = requireAuthUid();
    for (let i = 1; i <= count; i++) {
        let value = 0;
        if (model === 'LINEAR') {
            const sum = (count * (count + 1)) / 2;
            const factor = target / sum;
            value = i * factor;
        } else if (model === 'PROPORTIONAL') {
            value = target / count;
        }
        cells.push({
            id: crypto.randomUUID(),
            challengeId,
            number: i,
            value: Math.round(value * 100) / 100,
            status: 'PENDING',
            userId: uid,
            deleted: false
        });
    }
    return cells;
};

export const processFinanceImport = (rows: any[][], mapping: any): Partial<Transaction>[] => {
    return rows.slice(1).map(row => {
        const amount = ensureNumber(row[mapping.amount]);
        return {
            id: crypto.randomUUID(),
            date: String(row[mapping.date] || new Date().toISOString().split('T')[0]),
            description: String(row[mapping.description] || 'Importado'),
            amount: Math.abs(amount),
            type: amount >= 0 ? 'INCOME' : 'EXPENSE',
            isPaid: true,
            deleted: false
        };
    });
};

export const readExcelFile = async (file: File): Promise<any[][]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set(sales.map(s => s.client)));
    const duplicates: any[] = [];
    for (let i = 0; i < clients.length; i++) {
        for (let j = i + 1; j < clients.length; j++) {
            const a = clients[i].toLowerCase();
            const b = clients[j].toLowerCase();
            if (a === b || a.includes(b) || b.includes(a)) {
                duplicates.push({ master: clients[i], similar: [clients[j]] });
            }
        }
    }
    return duplicates;
};

export const smartMergeSales = (salesGroup: Sale[]): Sale => {
    return salesGroup.reduce((acc, curr) => ({
        ...acc,
        quantity: acc.quantity + curr.quantity,
        valueSold: acc.valueSold + curr.valueSold,
        commissionValueTotal: acc.commissionValueTotal + curr.commissionValueTotal
    }));
};

export const restoreClient = async (id: string) => {
    await updateDoc(doc(db, "clients", id), { deleted: false, updatedAt: serverTimestamp() });
};

export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
};

export const getFinanceData = async () => {
    const [accounts, cards, transactions, categories, goals, challenges, cells, receivables] = await Promise.all([
        dbGetAll('accounts'),
        dbGetAll('cards'),
        dbGetAll('transactions'),
        dbGetAll('categories'),
        dbGetAll('goals'),
        dbGetAll('challenges'),
        dbGetAll('challenge_cells'),
        dbGetAll('receivables')
    ]);
    return { accounts, cards, transactions, categories, goals, challenges, cells, receivables };
};

export const bootstrapProductionData = async () => {};
export const saveReportConfig = async (c: any) => {};
export const getReportConfig = async () => ({ daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 });
export const saveCommissionRules = async (type: any, rules: any) => {};
export const saveFinanceData = async (a:any, b:any, c:any, d:any) => {};
export const clearLocalCache = async () => {};
