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
    User, DuplicateGroup, NtfyPayload
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

// Side effect: Disparo para ntfy.sh
export const triggerNtfyPush = async (payload: Omit<NtfyPayload, 'topic'>) => {
    try {
        const sysConfig = await getSystemConfig();
        if (!sysConfig.ntfyTopic) return;

        const sendNtfy = httpsCallable(functions, 'sendNtfyNotification');
        await sendNtfy({
            ...payload,
            topic: sysConfig.ntfyTopic
        });
    } catch (e) {
        // Push é descartável e não bloqueia o fluxo do app
        console.warn("[NTFY_PUSH_FAILED]", e);
    }
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
    Logger.info("Configurações de sistema salvas");
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
    // Mapeamento explícito para evitar erros de case ou plural
    if (type === ProductType.BASICA) return 'basic';
    if (type === ProductType.NATAL) return 'natal';
    return type.toLowerCase();
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    const docId = getCommissionDocId(type);

    Logger.info(`Solicitando tabela de comissões: ${docId}`);

    try {
        const docRef = doc(db, "commissions", docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            const rules = (data.rules || []) as CommissionRule[];
            
            // Sincroniza localmente para garantir que o cache esteja atualizado
            await dbBulkPut(storeName as any, rules);
            
            SessionTraffic.trackRead();
            Logger.info(`Tabela ${docId} carregada do Firebase com sucesso.`, { count: rules.length });
            return rules;
        } else {
            Logger.warn(`Documento de comissão ${docId} não encontrado no Firebase.`);
        }
    } catch (e) {
        Logger.error(`Erro ao carregar comissões ${type} do Firebase. Tentando cache local...`, e);
    }
    
    const cached = await dbGetAll(storeName as any);
    Logger.info(`Tabela ${docId} carregada do cache local (Offline/Fallback).`, { count: cached?.length || 0 });
    return cached || [];
};

export const computeCommissionValues = (quantity: number, unitValue: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * unitValue;
    let rate = 0;
    
    // Procura a faixa correspondente à margem
    const rule = rules.find(r => margin >= r.minPercent && (r.maxPercent === null || margin < r.maxPercent));
    rate = rule ? rule.commissionRate : 0;
    
    return { commissionBase, commissionValue: commissionBase * rate, rateUsed: rate };
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    const docId = getCommissionDocId(type);
    
    Logger.info(`Iniciando salvamento de regras de comissão: ${docId}`, { count: rules.length });
    
    try {
        // 1. Persistência Local Imediata (Resiliência)
        const dbInst = await initDB();
        await dbInst.clear(storeName as any);
        await dbBulkPut(storeName as any, rules);
        Logger.info(`Cache local da tabela ${docId} atualizado.`);

        // 2. Persistência Cloud
        const docRef = doc(db, "commissions", docId);
        const sanitized = sanitizeForFirestore(rules);
        await setDoc(docRef, { 
            id: docId,
            rules: sanitized, 
            updatedAt: serverTimestamp() 
        }, { merge: true });
        
        SessionTraffic.trackWrite();
        Logger.info(`Tabela de comissões ${docId} sincronizada com Firebase.`);
    } catch (e) {
        Logger.error(`Falha crítica ao salvar comissões ${docId} no Firebase.`, e);
        throw e;
    }
};

// --- SALES ---

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = await getAuthenticatedUid();
    Logger.info("Carregando vendas do usuário...");
    
    try {
        const q = query(collection(db, "sales"), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const sales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
        
        await dbBulkPut('sales', sales);
        Logger.info(`Carregadas ${sales.length} vendas da nuvem e sincronizadas localmente.`);
        return sales;
    } catch (e) {
        Logger.error("Erro ao carregar vendas da nuvem. Usando local.", e);
        return await dbGetAll('sales');
    }
};

export const saveSales = async (sales: Sale[]) => {
    const uid = await getAuthenticatedUid();
    Logger.info(`Sincronizando lote de ${sales.length} vendas...`);
    
    const sanitized = sales.map(s => sanitizeForFirestore({ ...s, userId: uid, updatedAt: serverTimestamp() }));
    await dbBulkPut('sales', sanitized);
    
    const batch = writeBatch(db);
    sanitized.forEach(s => {
        const { id, ...data } = s;
        batch.set(doc(db, "sales", id), data, { merge: true });
        SessionTraffic.trackWrite();
    });
    
    try {
        await batch.commit();
        Logger.info(`Lote de ${sales.length} vendas gravado no Firebase.`);
    } catch (e) {
        Logger.error("Erro ao gravar vendas em lote.", e);
        throw e;
    }
};

export const saveSingleSale = async (payload: any) => {
  const uid = await getAuthenticatedUid();
  const saleId = payload.id || crypto.randomUUID();
  const saleData = sanitizeForFirestore({ ...payload, id: saleId, userId: uid, updatedAt: serverTimestamp() });
  
  Logger.info(`Salvando venda individual: ${saleId}`);
  
  try {
      await dbPut('sales', saleData);
      await setDoc(doc(db, "sales", saleId), saleData, { merge: true });
      SessionTraffic.trackWrite();
      Logger.info(`Venda ${saleId} salva no Firebase.`);

      if (saleData.valueSold > 5000) {
          await triggerNtfyPush({
              title: "💰 Venda de Alto Valor!",
              message: `Nova venda registrada: ${saleData.client} - R$ ${saleData.valueSold.toFixed(2)}`,
              priority: 'high',
              tags: ['moneybag', 'rocket']
          });
      }
  } catch (e) {
      Logger.error(`Erro ao salvar venda ${saleId}`, e);
      throw e;
  }
};

// --- FINANCE ---

export const getFinanceData = async () => {
    const uid = await getAuthenticatedUid();
    Logger.info("Sincronizando dados financeiros completos...");
    
    const fetchSafe = async (col: string) => {
        const q = query(collection(db, col), where("userId", "==", uid), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sincroniza localmente
        await dbBulkPut(col as any, items);
        return items;
    };
    
    try {
        const [acc, tx, crd, cat, gl, chal, cell, rec] = await Promise.all([
            fetchSafe("accounts"), fetchSafe("transactions"), fetchSafe("cards"), fetchSafe("categories"),
            fetchSafe("goals"), fetchSafe("challenges"), fetchSafe("challenge_cells"), fetchSafe("receivables")
        ]);
        Logger.info("Sincronização financeira concluída.");
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
        Logger.error("Erro na sincronização financeira total.", e);
        throw e;
    }
};

export const saveFinanceData = async (acc: FinanceAccount[], crd: CreditCard[], tx: Transaction[], cat: TransactionCategory[], gl: FinanceGoal[] = [], chal: Challenge[] = [], rec: Receivable[] = []) => {
    const uid = await getAuthenticatedUid();
    const batch = writeBatch(db);
    const prep = (item: any) => sanitizeForFirestore({ ...item, userId: uid, updatedAt: serverTimestamp() });
    
    Logger.info("Iniciando gravação de lote financeiro...");
    
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
        Logger.info("Lote financeiro gravado no Firebase.");
    } catch (e) {
        Logger.error("Erro ao salvar lote financeiro.", e);
        await triggerNtfyPush({
            title: "🛑 Erro de Sincronia Financeira",
            message: `Falha ao persistir lote financeiro para UID: ${uid}`,
            priority: 'urgent',
            tags: ['x', 'warning']
        });
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
    Logger.info(`Relatório exportado: ${fileName}`);
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

    return {
        totalClients: clients.length,
        activeClients,
        convertedThisMonth,
        conversionRate: rate,
        productivityStatus: status
    };
};

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

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    if (day > closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
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
    const json = JSON.stringify(data);
    const encrypted = encryptData(json);
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestor360_${new Date().getTime()}.v360`;
    a.click();
    Logger.info("Backup criptografado gerado e baixado");
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
    Logger.info("Backup restaurado localmente");
};

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
    Logger.warn("Todas as vendas foram excluídas via Admin");
};

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
    Logger.info("Células de desafio geradas");
    return cells;
};

export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    const rows = data.slice(1);
    const uid = auth.currentUser?.uid || '';
    Logger.info(`Iniciando processamento de importação financeira: ${rows.length} linhas`);
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
            provisioned: false,
            isRecurring: false,
            userId: uid,
            deleted: false,
            createdAt: new Date().toISOString()
        };
    });
};

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

export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    Logger.warn(`Executando Reset Atômico para usuário ${userId}`, { tables });
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

export const bootstrapProductionData = async () => {
    const config = await getSystemConfig();
    if (config.bootstrapVersion && config.bootstrapVersion >= 1) return;
    
    Logger.info("Iniciando bootstrap de dados de produção");
    
    // Tabela básica
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

    // Tabela Natal
    const commNatalRef = doc(db, "commissions", "natal");
    const natalSnap = await getDoc(commNatalRef);
    if (!natalSnap.exists()) {
        await setDoc(commNatalRef, {
            id: "natal",
            rules: [],
            updatedAt: serverTimestamp()
        });
    }

    await saveSystemConfig({ bootstrapVersion: 1 });
};

export const saveReportConfig = async (config: ReportConfig) => {
    const uid = await getAuthenticatedUid();
    await setDoc(doc(db, "config", `report_${uid}`), config, { merge: true });
    Logger.info("Configurações de relatório salvas");
};

export const clearLocalCache = async () => {
    const dbInst = await initDB();
    const stores = ['sales', 'accounts', 'transactions', 'categories', 'cards', 'receivables', 'goals', 'challenges', 'challenge_cells', 'clients'];
    for (const s of stores) {
        await dbInst.clear(s as any);
    }
    Logger.info("Cache local limpo");
};

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

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    const updated = { ...item, deleted: false, updatedAt: serverTimestamp() };
    await setDoc(doc(db, col, item.id), updated, { merge: true });
    await dbPut(col as any, updated);
    Logger.info(`Item restaurado: ${item.id}`, { type });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    await deleteDoc(doc(db, col, id));
    await dbDelete(col as any, id);
    Logger.warn(`Item excluído permanentemente: ${id}`, { type });
};

export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = await getAuthenticatedUid();
    const q = query(collection(db, "clients"), where("userId", "==", uid), where("deleted", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
};

export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        const updated = { ...client, deleted: false, updatedAt: new Date().toISOString() };
        await setDoc(doc(db, "clients", id), sanitizeForFirestore(updated), { merge: true });
        await dbPut('clients', updated);
        Logger.info(`Cliente restaurado: ${client.name}`, { id });
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
    await dbDelete('clients', id);
    Logger.warn(`Cliente excluído permanentemente: ${id}`);
};