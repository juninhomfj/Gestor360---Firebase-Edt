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
    
    Logger.info("Salvando configurações de sistema...");
    const userPrefs: UserPreferences & { userId: string } = {
        userId: uid
    };
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
    Logger.info("Configurações persistidas com sucesso.");
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

// --- COMISSÕES (SYNC FIX) ---

const getCommissionDocId = (type: ProductType): string => {
    // IMPORTANTE: Mapeia BASICA para o ID 'basic' do banco para manter consistência
    if (type === ProductType.BASICA) return 'basic';
    if (type === ProductType.NATAL) return 'natal';
    return type.toLowerCase();
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    const docId = getCommissionDocId(type);

    Logger.info(`Audit: Requisitando tabela de comissão [${docId}] do Cloud.`);

    try {
        const docRef = doc(db, "commissions", docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            const rules = (data.rules || []) as CommissionRule[];
            
            // Sincroniza localmente para evitar perdas em navegação
            await dbBulkPut(storeName as any, rules);
            
            SessionTraffic.trackRead();
            Logger.info(`Audit: Tabela [${docId}] baixada e sincronizada.`, { count: rules.length });
            return rules;
        } else {
            Logger.warn(`Audit: Tabela [${docId}] não encontrada no Cloud.`);
        }
    } catch (e) {
        Logger.error(`Audit: Falha ao baixar tabela [${docId}]. Usando local.`, e);
    }
    
    const cached = await dbGetAll(storeName as any);
    return cached || [];
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    const docId = getCommissionDocId(type);
    
    Logger.info(`Audit: Iniciando persistência de regras para [${docId}]`, { count: rules.length });
    
    try {
        // 1. Garantir persistência local PRIMEIRO (Resiliência)
        const dbInst = await initDB();
        await dbInst.clear(storeName as any);
        await dbBulkPut(storeName as any, rules);
        
        // 2. Persistência Cloud (Escrita Direta)
        const docRef = doc(db, "commissions", docId);
        const sanitized = sanitizeForFirestore(rules);
        
        await setDoc(docRef, { 
            id: docId,
            rules: sanitized, 
            updatedAt: serverTimestamp() 
        }, { merge: true });
        
        SessionTraffic.trackWrite();
        Logger.info(`Audit: Tabela [${docId}] sincronizada com Firebase com sucesso.`);
    } catch (e) {
        Logger.error(`Audit: Erro fatal ao sincronizar comissões [${docId}]`, e);
        throw e;
    }
};

// --- SALES ---

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = await getAuthenticatedUid();
    Logger.info("Audit: Sincronizando base de vendas do usuário.");
    try {
        const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const sales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
        await dbBulkPut('sales', sales);
        Logger.info(`Audit: ${sales.length} vendas sincronizadas.`);
        return sales;
    } catch (e) {
        Logger.error("Audit: Falha na sincronia de vendas.", e);
        return await dbGetAll('sales');
    }
};

export const saveSales = async (sales: Sale[]) => {
    const uid = await getAuthenticatedUid();
    Logger.info(`Audit: Gravando lote de ${sales.length} vendas.`);
    const sanitized = sales.map(s => sanitizeForFirestore({ ...s, userId: uid, updatedAt: serverTimestamp() }));
    await dbBulkPut('sales', sanitized);
    const batch = writeBatch(db);
    sanitized.forEach(s => {
        const { id, ...data } = s;
        batch.set(doc(db, "sales", id), data, { merge: true });
        SessionTraffic.trackWrite();
    });
    await batch.commit();
    Logger.info("Audit: Lote de vendas persistido no Firestore.");
};

export const saveSingleSale = async (payload: any) => {
  const uid = await getAuthenticatedUid();
  const saleId = payload.id || crypto.randomUUID();
  const saleData = sanitizeForFirestore({ ...payload, id: saleId, userId: uid, updatedAt: serverTimestamp() });
  
  Logger.info(`Audit: Salvando venda individual [${saleId}]`);
  try {
      await dbPut('sales', saleData);
      await setDoc(doc(db, "sales", saleId), saleData, { merge: true });
      SessionTraffic.trackWrite();
      Logger.info(`Audit: Venda [${saleId}] persistida.`);
  } catch (e) {
      Logger.error(`Audit: Erro ao salvar venda [${saleId}]`, e);
      throw e;
  }
};

export const getFinanceData = async () => {
    const uid = await getAuthenticatedUid();
    Logger.info("Audit: Sincronizando dados financeiros globais.");
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
        Logger.info("Audit: Sincronia financeira concluída.");
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
        Logger.error("Audit: Erro na sincronia financeira.", e);
        throw e;
    }
};

export const saveFinanceData = async (acc: FinanceAccount[], crd: CreditCard[], tx: Transaction[], cat: TransactionCategory[], gl: FinanceGoal[] = [], chal: Challenge[] = [], rec: Receivable[] = []) => {
    const uid = await getAuthenticatedUid();
    const batch = writeBatch(db);
    const prep = (item: any) => sanitizeForFirestore({ ...item, userId: uid, updatedAt: serverTimestamp() });
    
    Logger.info("Audit: Gravando transações e contas no Cloud.");
    acc.forEach(i => batch.set(doc(db, "accounts", i.id), prep(i), { merge: true }));
    crd.forEach(i => batch.set(doc(db, "cards", i.id), prep(i), { merge: true }));
    cat.forEach(i => batch.set(doc(db, "categories", i.id), prep(i), { merge: true }));
    gl.forEach(i => batch.set(doc(db, "goals", i.id), prep(i), { merge: true }));
    chal.forEach(i => batch.set(doc(db, "challenges", i.id), prep(i), { merge: true }));
    rec.forEach(i => batch.set(doc(db, "receivables", i.id), prep(i), { merge: true }));
    tx.slice(-500).forEach(i => batch.set(doc(db, "transactions", i.id), prep(i), { merge: true }));
    
    try {
        await batch.commit();
        SessionTraffic.trackWrite();
        Logger.info("Audit: Dados financeiros salvos com sucesso.");
    } catch (e) {
        Logger.error("Audit: Erro ao salvar dados financeiros.", e);
        throw e;
    }
};

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
    Logger.info(`Audit: Relatório [${fileName}] exportado.`);
};

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
    return { totalClients: clients.length, activeClients, convertedThisMonth, conversionRate: rate, productivityStatus: status };
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextDay = salaryDays.find(d => d > today) || salaryDays[0];
    const nextDate = new Date(now.getFullYear(), now.getMonth() + (nextDay <= today ? 1 : 0), nextDay);
    const daysRemaining = Math.max(1, Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const pendingExpenses = transactions.filter(t => t.type === 'EXPENSE' && !t.isPaid).reduce((acc, t) => acc + t.amount, 0);
    const available = balance - pendingExpenses;
    return { daysRemaining, safeDailySpend: Math.max(0, available / daysRemaining), pendingExpenses, nextIncomeDate: nextDate };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    if (day > closingDay) d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 7);
};

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
    const encrypted = encryptData(JSON.stringify(data));
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestor360_${new Date().getTime()}.v360`;
    a.click();
    Logger.info("Audit: Backup gerado.");
};

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
    Logger.info("Audit: Backup restaurado localmente.");
};

export const clearAllSales = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    Logger.warn("Audit: Iniciando limpeza total de vendas.");
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    const dbInst = await initDB();
    await dbInst.clear('sales');
    Logger.warn("Audit: Todas as vendas excluídas.");
};

export const bootstrapProductionData = async () => {
    const config = await getSystemConfig();
    if (config.bootstrapVersion && config.bootstrapVersion >= 1) return;
    
    Logger.info("Audit: Executando bootstrap de produção.");
    
    // Tabela 'basic' (Básica)
    const commBasicRef = doc(db, "commissions", "basic");
    const basicSnap = await getDoc(commBasicRef);
    if (!basicSnap.exists()) {
        await setDoc(commBasicRef, {
            id: "basic",
            rules: [
                { id: crypto.randomUUID(), minPercent: 0, maxPercent: 10, commissionRate: 0.04, isActive: true },
                { id: crypto.randomUUID(), minPercent: 10, maxPercent: 20, commissionRate: 0.05, isActive: true },
                { id: crypto.randomUUID(), minPercent: 20, maxPercent: null, commissionRate: 0.06, isActive: true }
            ],
            updatedAt: serverTimestamp()
        });
    }

    const commNatalRef = doc(db, "commissions", "natal");
    const natalSnap = await getDoc(commNatalRef);
    if (!natalSnap.exists()) {
        await setDoc(commNatalRef, { id: "natal", rules: [], updatedAt: serverTimestamp() });
    }

    await saveSystemConfig({ bootstrapVersion: 1 });
    Logger.info("Audit: Bootstrap finalizado.");
};

export const getClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", false));
    const snap = await getDocs(q);
    SessionTraffic.trackRead(snap.size);
    const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
    await dbBulkPut('clients', data);
    return data;
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const uid = await getAuthenticatedUid();
    const snap = await getDoc(doc(db, "config", `report_${uid}`));
    if (snap.exists()) return snap.data() as ReportConfig;
    return { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const clearLocalCache = async () => {
    const dbInst = await initDB();
    const stores = ['sales', 'accounts', 'transactions', 'categories', 'cards', 'receivables', 'goals', 'challenges', 'challenge_cells', 'clients'];
    for (const s of stores) await dbInst.clear(s as any);
    Logger.info("Audit: Cache local limpo manualmente.");
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    const updated = { ...item, deleted: false, updatedAt: serverTimestamp() };
    await setDoc(doc(db, col, item.id), updated, { merge: true });
    await dbPut(col as any, updated);
    Logger.info(`Audit: Item restaurado [Type: ${type}, ID: ${item.id}]`);
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    await deleteDoc(doc(db, col, id));
    await dbDelete(col as any, id);
    Logger.warn(`Audit: Item excluído permanentemente [Type: ${type}, ID: ${id}]`);
};

export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        const updated = { ...client, deleted: false, updatedAt: new Date().toISOString() };
        await setDoc(doc(db, "clients", id), sanitizeForFirestore(updated), { merge: true });
        await dbPut('clients', updated);
        Logger.info(`Audit: Cliente restaurado [${client.name}]`);
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
    await dbDelete('clients', id);
    Logger.warn(`Audit: Cliente excluído permanentemente [ID: ${id}]`);
};

// Fix: Implemented generateChallengeCells for saving challenge structure
export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    
    if (model === 'LINEAR') {
        const sum = (count * (count + 1)) / 2;
        const factor = target / sum;
        for (let i = 1; i <= count; i++) {
            cells.push({
                id: crypto.randomUUID(),
                challengeId,
                number: i,
                value: i * factor,
                status: 'PENDING',
                userId: uid,
                deleted: false
            });
        }
    } else if (model === 'PROPORTIONAL') {
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

// Fix: Implemented computeCommissionValues for sales calculations
export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const rule = rules.find(r => margin >= r.minPercent && (r.maxPercent === null || margin < r.maxPercent));
    const rateUsed = rule ? rule.commissionRate : 0;
    const commissionValue = commissionBase * rateUsed;
    return { commissionBase, commissionValue, rateUsed };
};

// Fix: Implemented saveReportConfig to persist user report settings
export const saveReportConfig = async (config: ReportConfig) => {
    const uid = await getAuthenticatedUid();
    await setDoc(doc(db, "config", `report_${uid}`), config, { merge: true });
    Logger.info("Audit: Configuração de relatório salva.");
};

// Fix: Implemented readExcelFile (CSV fallback) for data import
export const readExcelFile = async (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return resolve([]);
            const rows = text.split(/\r?\n/).filter(line => line.trim()).map(line => line.split(',').map(cell => cell.trim()));
            resolve(rows);
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// Fix: Implemented processFinanceImport to map file data to transactions
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Transaction[] => {
    const rows = data.slice(1);
    const uid = auth.currentUser?.uid || '';
    
    return rows.map(row => {
        const amount = ensureNumber(row[mapping['amount']]);
        return {
            id: crypto.randomUUID(),
            description: row[mapping['description']] || 'Importado',
            amount: Math.abs(amount),
            type: row[mapping['type']] ? (String(row[mapping['type']]).toUpperCase().includes('ENTRADA') ? 'INCOME' : 'EXPENSE') : (amount >= 0 ? 'INCOME' : 'EXPENSE'),
            date: row[mapping['date']] || new Date().toISOString(),
            categoryId: 'uncategorized',
            accountId: '', 
            isPaid: true,
            provisioned: false,
            isRecurring: false,
            deleted: false,
            createdAt: new Date().toISOString(),
            userId: uid
        } as Transaction;
    });
};

// Fix: Implemented atomicClearUserTables for administrative data reset
export const atomicClearUserTables = async (targetUserId: string, tables: string[]) => {
    const resetFn = httpsCallable(functions, 'adminHardResetUserData');
    const result = await resetFn({ targetUserId, tables });
    return result.data;
};

// Fix: Implemented findPotentialDuplicates for client base hygiene
export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set(sales.map(s => s.client)));
    const groups: { master: string, similar: string[] }[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < clients.length; i++) {
        const clientA = clients[i];
        if (processed.has(clientA)) continue;
        const group = { master: clientA, similar: [] as string[] };
        const normA = clientA.toLowerCase().trim();
        for (let j = i + 1; j < clients.length; j++) {
            const clientB = clients[j];
            if (processed.has(clientB)) continue;
            if (normA === clientB.toLowerCase().trim()) {
                group.similar.push(clientB);
                processed.add(clientB);
            }
        }
        if (group.similar.length > 0) { groups.push(group); processed.add(clientA); }
    }
    return groups;
};

// Fix: Implemented smartMergeSales for resolving duplicates
export const smartMergeSales = (sales: Sale[]): Sale => {
    const master = { ...sales[0] };
    master.observations = sales.map(s => s.observations).filter(Boolean).join(' | ');
    return master;
};

// Fix: Implemented getTrashItems to retrieve soft-deleted records
export const getTrashItems = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { sales: [], transactions: [] };
    const salesQ = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", true));
    const txQ = query(collection(db, "transactions"), where("userId", "==", uid), where("deleted", "==", true));
    const [salesSnap, txSnap] = await Promise.all([getDocs(salesQ), getDocs(txQ)]);
    return {
        sales: salesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Sale)),
        transactions: txSnap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction))
    };
};

// Fix: Implemented getDeletedClients for trash bin management
export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
};