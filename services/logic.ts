import {
  collection,
  query,
  where,
  getDocs,
  getDocsFromServer,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocFromServer,
  setDoc,
  writeBatch,
  deleteDoc,
  updateDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import * as XLSX from 'xlsx';
import CryptoJS from 'crypto-js';
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, Client, 
    ProductivityMetrics, Challenge, FinanceGoal, ImportMapping,
    User, ChallengeModel
} from '../types';
import { Logger } from './logger';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    bootstrapVersion: 2,
    includeNonAccountingInTotal: false,
    modules: {
        ai: true,
        sales: true,
        finance: true,
        crm: true,
        whatsapp: true,
        reports: true,
        dev: false,
        settings: true,
        news: true,
        receivables: true,
        distribution: true,
        imports: true
    }
};

export const ensureNumber = (value: any, fallback = 0): number => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number') return isNaN(value) ? fallback : value;
    let str = String(value).trim();
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) str = str.replace(/\./g, '').replace(',', '.');
    else if (lastDot > lastComma) str = str.replace(/,/g, '');
    else if (lastComma !== -1) str = str.replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? fallback : num;
};

// Fix: Added missing export for formatCurrency
export const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const SessionTraffic = {
    reads: 0, 
    writes: 0, 
    lastActivity: null as Date | null,
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = (quantity || 0) * (valueProposed || 0);
    const rule = (rules || []).find(r => r && margin >= (r.minPercent || 0) && (r.maxPercent === null || margin < (r.maxPercent || 0)));
    const rateUsed = rule ? (rule.commissionRate || 0) : 0;
    return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

/**
 * Carrega tabelas de comissão globais.
 * Tenta buscar do servidor a versão ativa (isActive == true).
 */
export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    let colName = 'commissions_basic';
    let storeName = 'commission_basic';

    if (type === ProductType.NATAL) {
        colName = 'commissions_natal';
        storeName = 'commission_natal';
    }

    try {
        const q = query(collection(db, colName), where("isActive", "==", true), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q); 
        SessionTraffic.trackRead(snap.size);

        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const tiers = docData?.tiers || [];
            const version = docData?.version || Date.now();
            const rules: CommissionRule[] = tiers.map((t: any, idx: number) => ({
                id: `${version}_${idx}`,
                minPercent: ensureNumber(t.min),
                maxPercent: t.max === null ? null : ensureNumber(t.max),
                commissionRate: ensureNumber(t.rate),
                isActive: true
            }));
            
            await dbBulkPut(storeName as any, rules);
            return rules.sort((a, b) => a.minPercent - b.minPercent);
        }
    } catch (e: any) {
        if (e.code !== 'permission-denied' && navigator.onLine) {
            Logger.warn(`Audit: Falha ao sincronizar tabela global [${type}]. Usando cache local.`);
        }
    }

    const cached = await dbGetAll(storeName as any);
    return (cached || [])
        .filter((r: any) => r && r.isActive)
        .sort((a: any, b: any) => (a.minPercent || 0) - (b.minPercent || 0));
};

/**
 * Salva regras de comissão e desativa versões anteriores.
 */
export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    let colName = 'commissions_basic';
    if (type === ProductType.NATAL) colName = 'commissions_natal';
    if (type === ProductType.CUSTOM) return;

    try {
        Logger.info(`Audit: Iniciando atualização global da tabela [${type}]`);
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        
        snap.docs.forEach(d => batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() }));
        
        const newDocRef = doc(collection(db, colName));
        batch.set(newDocRef, {
            version: Date.now(),
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid || 'system',
            tiers: rules.map(r => ({ 
                min: r.minPercent, 
                max: r.maxPercent, 
                rate: r.commissionRate > 1 ? r.commissionRate / 100 : r.commissionRate 
            }))
        });
        
        await batch.commit();
        SessionTraffic.trackWrite();
    } catch (e: any) {
        Logger.error(`Erro ao salvar regras globais [${type}]`, e);
        throw new Error(`Privilégios insuficientes.`);
    }
};

export function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Timestamp) return obj;
    if (obj instanceof Date) return Timestamp.fromDate(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const cleaned: any = {};
    Object.keys(obj).forEach(key => cleaned[key] = sanitizeForFirestore(obj[key]));
    return cleaned;
}

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    
    try {
        const q = query(collection(db, 'sales'), where('userId', '==', uid), where('deleted', '==', false), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        const cloudSales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
        await dbBulkPut('sales', cloudSales);
    } catch (e) {}

    const sales = await dbGetAll('sales', (s) => s.userId === uid && !s.deleted);
    return sales.map(s => ({
        ...s,
        quantity: ensureNumber(s.quantity, 1),
        valueSold: ensureNumber(s.valueSold),
        valueProposed: ensureNumber(s.valueProposed),
        marginPercent: ensureNumber(s.marginPercent),
        commissionValueTotal: ensureNumber(s.commissionValueTotal)
    }));
};

/**
 * Função unificada para baixar dados financeiros do backend e atualizar o front.
 */
export const getFinanceData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { accounts: [], transactions: [], cards: [], categories: [], goals: [], challenges: [], cells: [], receivables: [] };
    
    // Lista de tabelas para sincronizar
    const tables = ['accounts', 'transactions', 'cards', 'categories', 'goals', 'challenges', 'challenge_cells', 'receivables'];
    
    for (const table of tables) {
        try {
            const q = query(collection(db, table), where('userId', '==', uid), where('deleted', '==', false));
            const snap = await getDocs(q);
            SessionTraffic.trackRead(snap.size);
            const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            const storeName = table === 'challenge_cells' ? 'challenge_cells' : table;
            await dbBulkPut(storeName as any, data);
        } catch (e) {}
    }

    const [accounts, transactions, cards, categories, goals, challenges, cells, receivables] = await Promise.all([
        dbGetAll('accounts', a => a.userId === uid && !a.deleted),
        dbGetAll('transactions', t => t.userId === uid && !t.deleted),
        dbGetAll('cards', c => c.userId === uid && !c.deleted),
        dbGetAll('categories', c => c.userId === uid && !c.deleted),
        dbGetAll('goals', g => g.userId === uid && !g.deleted),
        dbGetAll('challenges', c => c.userId === uid && !c.deleted),
        dbGetAll('challenge_cells', c => c.userId === uid && !c.deleted),
        dbGetAll('receivables', r => r.userId === uid && !r.deleted)
    ]);

    return { 
        accounts: (accounts || []).map(a => ({ ...a, balance: ensureNumber(a.balance) })),
        transactions: (transactions || []).map(t => ({ ...t, amount: ensureNumber(t.amount) })),
        cards: (cards || []).map(c => ({ ...c, limit: ensureNumber(c.limit) })),
        categories, goals, challenges, cells, receivables 
    };
};

export const handleSoftDelete = async (table: string, id: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    Logger.warn(`Audit: Soft Delete solicitado em ${table}/${id}`);
    const local = await dbGet(table as any, id);
    if (local) {
        await dbPut(table as any, { ...local, deleted: true, deletedAt: new Date().toISOString() });
    }

    try {
        await updateDoc(doc(db, table, id), {
            deleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        SessionTraffic.trackWrite();
    } catch (e) {
        Logger.error(`Audit: Falha ao sincronizar soft delete`, e);
    }
};

export const saveSales = async (sales: Sale[]) => {
    const batch = writeBatch(db);
    for (const sale of sales) {
        const safeSale = sanitizeForFirestore(sale);
        await dbPut('sales', sale);
        batch.set(doc(db, 'sales', sale.id), safeSale, { merge: true });
    }
    await batch.commit();
    SessionTraffic.trackWrite(sales.length);
};

export const canAccess = (user: User | null, mod: string): boolean => {
    if (!user || !user.isActive || user.userStatus === 'INACTIVE') return false;
    if (user.role === 'DEV' || user.role === 'ADMIN') return true;
    return !!(user.permissions as any)?.[mod];
};

export const clearLocalCache = async () => {
    const dbInst = await initDB();
    const stores = dbInst.objectStoreNames;
    for (const store of Array.from(stores)) {
        await dbInst.clear(store as any);
    }
};

export const getTicketStats = async (): Promise<number> => {
    try {
        const q = query(collection(db, "internal_messages"), where("type", "==", "BUG_REPORT"), where("read", "==", false), where("deleted", "==", false));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(1);
        return snap.size;
    } catch (e) { return 0; }
};

// Fix: Added missing export for processFinanceImport
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    const rows = data.slice(1);
    const transactions: Partial<Transaction>[] = [];

    rows.forEach(row => {
        const dateIdx = mapping['date'];
        const descIdx = mapping['description'];
        const amountIdx = mapping['amount'];
        const typeIdx = mapping['type'];
        const personIdx = mapping['person'];

        if (dateIdx === undefined || dateIdx === -1 || 
            descIdx === undefined || descIdx === -1 || 
            amountIdx === undefined || amountIdx === -1) return;

        const rawAmount = ensureNumber(row[amountIdx]);
        let type: 'INCOME' | 'EXPENSE' = rawAmount >= 0 ? 'INCOME' : 'EXPENSE';
        
        if (typeIdx !== undefined && typeIdx !== -1 && row[typeIdx]) {
            const tStr = String(row[typeIdx]).toUpperCase();
            if (tStr.includes('ENTRADA') || tStr.includes('RECEITA')) type = 'INCOME';
            if (tStr.includes('SAIDA') || tStr.includes('DESPESA')) type = 'EXPENSE';
        }

        const tx: Partial<Transaction> = {
            id: crypto.randomUUID(),
            description: String(row[descIdx] || 'Importado'),
            amount: Math.abs(rawAmount),
            type,
            date: String(row[dateIdx] || new Date().toISOString().split('T')[0]),
            isPaid: true,
            provisioned: false,
            isRecurring: false,
            deleted: false,
            createdAt: new Date().toISOString(),
            userId: auth.currentUser?.uid || '',
            categoryId: 'uncategorized',
            personType: (personIdx !== undefined && personIdx !== -1 && row[personIdx]) ? (String(row[personIdx]).toUpperCase().includes('PJ') ? 'PJ' : 'PF') : 'PF'
        };

        transactions.push(tx);
    });

    return transactions;
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
                resolve(XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]);
            } catch (err) { reject(err); }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsBinaryString(file);
    });
};

export const downloadSalesTemplate = () => {
    const data = [
        ["Data Pedido", "Data Faturamento", "Tipo", "Cliente", "Quantidade", "Valor Unitário Proposto", "Valor Total Venda", "Margem (%)", "Observações"],
        ["2024-01-01", "2024-01-10", "Cesta Básica", "Exemplo LTDA", 10, 150.00, 1500.00, 15.0, "Importado v2.5"]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_gestor360_v2.5.xlsx");
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    try {
        const snap = await getDocFromServer(doc(db, "config", "system"));
        if (snap.exists()) return snap.data() as SystemConfig;
    } catch (e) {}
    const local = await dbGet('config', 'system');
    return local || DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
    await dbPut('config', { ...config, id: 'system' });
    await setDoc(doc(db, "config", "system"), sanitizeForFirestore(config));
};

export const saveFinanceData = async (accounts: FinanceAccount[], cards: CreditCard[], transactions: Transaction[], categories: TransactionCategory[]) => {
    const batch = writeBatch(db);
    for (const acc of accounts) { await dbPut('accounts', acc); batch.set(doc(db, 'accounts', acc.id), sanitizeForFirestore(acc), { merge: true }); }
    for (const card of cards) { await dbPut('cards', card); batch.set(doc(db, 'cards', card.id), sanitizeForFirestore(card), { merge: true }); }
    for (const tx of transactions) { await dbPut('transactions', tx); batch.set(doc(db, 'transactions', tx.id), sanitizeForFirestore(tx), { merge: true }); }
    for (const cat of categories) { await dbPut('categories', cat); batch.set(doc(db, 'categories', cat.id), sanitizeForFirestore(cat), { merge: true }); }
    await batch.commit();
};

export const getClients = async (): Promise<Client[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
        const q = query(collection(db, 'clients'), where('userId', '==', uid), where('deleted', '==', false));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
        await dbBulkPut('clients', data);
    } catch (e) {}
    return await dbGetAll('clients', c => c.userId === uid && !c.deleted);
};

export const saveSingleSale = async (sale: Sale) => {
    await dbPut('sales', sale);
    await setDoc(doc(db, 'sales', sale.id), sanitizeForFirestore(sale), { merge: true });
    SessionTraffic.trackWrite();
};

export const bootstrapProductionData = async () => {
    const sys = await getSystemConfig();
    if (sys.bootstrapVersion < 2) {
        await saveSystemConfig({ ...DEFAULT_SYSTEM_CONFIG, bootstrapVersion: 2 });
    }
};

export const getTrashItems = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { sales: [], transactions: [] };
    const sales = await dbGetAll('sales', s => s.userId === uid && s.deleted);
    const transactions = await dbGetAll('transactions', t => t.userId === uid && t.deleted);
    return { sales, transactions };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const restored = { ...item, deleted: false, updatedAt: new Date().toISOString() };
    const table = type === 'SALE' ? 'sales' : 'transactions';
    await dbPut(table, restored);
    await setDoc(doc(db, table, item.id), sanitizeForFirestore(restored), { merge: true });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const table = type === 'SALE' ? 'sales' : 'transactions';
    await dbDelete(table, id);
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, { name: string, totalSpent: number, lastPurchaseDate: string, totalOrders: number }>();
    sales.forEach(s => {
        if (s.deleted) return;
        const name = s.client || 'Cliente Indefinido';
        const existing = clientsMap.get(name) || { name, totalSpent: 0, lastPurchaseDate: '1970-01-01', totalOrders: 0 };
        existing.totalSpent += ensureNumber(s.valueSold) * ensureNumber(s.quantity);
        existing.totalOrders += 1;
        const sDate = s.date || s.completionDate || '1970-01-01';
        if (sDate > existing.lastPurchaseDate) existing.lastPurchaseDate = sDate;
        clientsMap.set(name, existing);
    });

    const now = new Date();
    return Array.from(clientsMap.values()).map(c => {
        const lastDate = new Date(c.lastPurchaseDate);
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        let status: 'NEW' | 'ACTIVE' | 'INACTIVE' | 'LOST' = 'ACTIVE';
        if (diffDays <= config.daysForNewClient && c.totalOrders === 1) status = 'NEW';
        else if (diffDays > config.daysForLost) status = 'LOST';
        else if (diffDays > config.daysForInactive) status = 'INACTIVE';
        
        return { ...c, daysSinceLastPurchase: diffDays, status };
    });
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const data: any[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7);
        const name = d.toLocaleDateString('pt-BR', { month: 'short' });
        
        const monthSales = sales.filter(s => !s.deleted && s.date?.startsWith(key));
        const basica = monthSales.filter(s => s.type === ProductType.BASICA).reduce((acc, s) => acc + ensureNumber(s.commissionValueTotal), 0);
        const natal = monthSales.filter(s => s.type === ProductType.NATAL).reduce((acc, s) => acc + ensureNumber(s.commissionValueTotal), 0);
        
        data.push({ name, basica, natal });
    }
    return data;
};

export const exportReportToCSV = (data: any[], filename: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const clientAnalysis = analyzeClients(sales, config);
    
    const activeClients = clientAnalysis.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const convertedThisMonth = new Set(sales.filter(s => {
        if (!s.date || s.deleted) return false;
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).map(s => s.client)).size;

    const conversionRate = activeClients > 0 ? (convertedThisMonth / activeClients) * 100 : 0;
    
    let productivityStatus: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (conversionRate >= 70) productivityStatus = 'GREEN';
    else if (conversionRate >= 40) productivityStatus = 'YELLOW';

    return {
        totalClients: clientAnalysis.length,
        activeClients,
        convertedThisMonth,
        conversionRate,
        productivityStatus
    };
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextIncomeDay = (salaryDays || []).find(d => d > today) || (salaryDays || [])[0] || 1;
    
    let nextIncomeDate = new Date(now.getFullYear(), now.getMonth(), nextIncomeDay);
    if (nextIncomeDay <= today) {
        nextIncomeDate = new Date(now.getFullYear(), now.getMonth() + 1, nextIncomeDay);
    }

    const daysRemaining = Math.max(1, Math.ceil((nextIncomeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const pendingExpenses = transactions
        .filter(t => t && !t.isPaid && !t.deleted && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + ensureNumber(t.amount), 0);

    const safeDailySpend = (balance - pendingExpenses) / daysRemaining;

    return {
        daysRemaining,
        safeDailySpend: Math.max(0, safeDailySpend),
        pendingExpenses,
        nextIncomeDate
    };
};

export const getInvoiceMonth = (date: string, closingDay: number): string => {
    const d = new Date(date);
    const day = d.getDate();
    if (day > (closingDay || 10)) {
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().substring(0, 7);
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const data = {
        sales: await dbGetAll('sales'),
        transactions: await dbGetAll('transactions'),
        accounts: await dbGetAll('accounts'),
        clients: await dbGetAll('clients'),
        cards: await dbGetAll('cards'),
        config: await dbGetAll('config'),
        categories: await dbGetAll('categories'),
        goals: await dbGetAll('goals'),
        challenges: await dbGetAll('challenges'),
        challenge_cells: await dbGetAll('challenge_cells'),
        receivables: await dbGetAll('receivables')
    };
    const json = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(json, passphrase).toString();
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestor360_${new Date().getTime()}.v360`;
    a.click();
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = CryptoJS.AES.decrypt(text, passphrase).toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error("Senha de backup incorreta ou arquivo corrompido.");
    const data = JSON.parse(decrypted);
    
    await clearLocalCache();
    if (data.sales) await dbBulkPut('sales', data.sales);
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
    if (data.clients) await dbBulkPut('clients', data.clients);
    if (data.cards) await dbBulkPut('cards', data.cards);
    if (data.config) await dbBulkPut('config', data.config);
    if (data.categories) await dbBulkPut('categories', data.categories);
    if (data.goals) await dbBulkPut('goals', data.goals);
    if (data.challenges) await dbBulkPut('challenges', data.challenges);
    if (data.challenge_cells) await dbBulkPut('challenge_cells', data.challenge_cells);
    if (data.receivables) await dbBulkPut('receivables', data.receivables);
};

export const clearAllSales = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const sales = await getStoredSales();
    const batch = writeBatch(db);
    for (const s of sales) {
        batch.update(doc(db, 'sales', s.id), { deleted: true, deletedAt: serverTimestamp() });
        await dbDelete('sales', s.id);
    }
    await batch.commit();
};

export const generateChallengeCells = (challengeId: string, targetValue: number, depositCount: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    
    for (let i = 1; i <= depositCount; i++) {
        let value = 0;
        if (model === 'LINEAR') {
            const sum = (depositCount * (depositCount + 1)) / 2;
            const factor = targetValue / sum;
            value = i * factor;
        } else if (model === 'PROPORTIONAL') {
            value = targetValue / depositCount;
        }
        
        cells.push({
            id: crypto.randomUUID(),
            challengeId,
            number: i,
            value: ensureNumber(value),
            status: 'PENDING',
            userId: uid,
            deleted: false
        });
    }
    return cells;
};

export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    const batch = writeBatch(db);
    for (const table of tables) {
        const q = query(collection(db, table), where("userId", "==", userId));
        const snap = await getDocs(q);
        snap.forEach(d => batch.update(d.ref, { deleted: true, deletedAt: serverTimestamp() }));
        
        const allLocal = await dbGetAll(table as any, (item: any) => item.userId === userId);
        for (const item of allLocal) {
            await dbDelete(table as any, item.id);
        }
    }
    await batch.commit();
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    try {
        const snap = await getDocFromServer(doc(db, "config", "report"));
        if (snap.exists()) return snap.data() as ReportConfig;
    } catch (e) {}
    const local = await dbGet('config', 'report');
    return local || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    await dbPut('config', { ...config, id: 'report' });
    await setDoc(doc(db, "config", "report"), sanitizeForFirestore(config));
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set((sales || []).filter(s => s && !s.deleted).map(s => s.client)));
    const groups: { master: string, similar: string[] }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < clients.length; i++) {
        const clientA = clients[i];
        if (seen.has(clientA)) continue;
        const similar: string[] = [];
        for (let j = i + 1; j < clients.length; j++) {
            const clientB = clients[j];
            if (seen.has(clientB)) continue;
            if (clientA.toLowerCase().trim() === clientB.toLowerCase().trim() || 
                (clientA.length > 5 && clientB.includes(clientA)) || 
                (clientB.length > 5 && clientA.includes(clientB))) {
                similar.push(clientB);
                seen.add(clientB);
            }
        }
        if (similar.length > 0) {
            groups.push({ master: clientA, similar });
            seen.add(clientA);
        }
    }
    return groups;
};

export const smartMergeSales = (sales: Sale[]): Sale => {
    return (sales || []).filter(s => s && !s.deleted).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];
};

export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return await dbGetAll('clients', c => c.userId === uid && c.deleted);
};

export const restoreClient = async (id: string) => {
    const local = await dbGet('clients', id);
    if (local) {
        const restored = { ...local, deleted: false, updatedAt: new Date().toISOString() };
        await dbPut('clients', restored);
        await updateDoc(doc(db, 'clients', id), { deleted: false, updatedAt: serverTimestamp() });
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    await updateDoc(doc(db, 'clients', id), { deleted: true, deletedAt: serverTimestamp() });
    await dbDelete('clients', id);
};