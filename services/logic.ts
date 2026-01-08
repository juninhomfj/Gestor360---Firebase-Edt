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

export const SessionTraffic = {
    reads: 0, 
    writes: 0, 
    lastActivity: null as Date | null,
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const rule = rules.find(r => margin >= r.minPercent && (r.maxPercent === null || margin < r.maxPercent));
    const rateUsed = rule ? rule.commissionRate : 0;
    return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    try {
        const q = query(collection(db, colName), where("isActive", "==", true), limit(1));
        const snap = await getDocs(q);
        SessionTraffic.trackRead(snap.size);
        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const rules: CommissionRule[] = (docData.tiers || []).map((t: any, idx: number) => ({
                id: `${docData.version}_${idx}`,
                minPercent: t.min,
                maxPercent: t.max,
                commissionRate: t.rate,
                isActive: true
            }));
            await dbBulkPut(storeName as any, rules);
            return rules.sort((a, b) => a.minPercent - b.minPercent);
        }
    } catch (e: any) {
        Logger.error(`Erro ao carregar regras de comissão [${type}]`, e);
    }
    const cached = await dbGetAll(storeName as any);
    return (cached || []).filter((r: any) => r.isActive).sort((a: any, b: any) => a.minPercent - b.minPercent);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.update(d.ref, { isActive: false }));
        batch.set(doc(collection(db, colName)), {
            version: Date.now(),
            isActive: true,
            createdAt: serverTimestamp(),
            tiers: rules.map(r => ({ 
                min: r.minPercent, 
                max: r.maxPercent, 
                rate: r.commissionRate > 1 ? r.commissionRate / 100 : r.commissionRate 
            }))
        });
        await batch.commit();
        SessionTraffic.trackWrite();
    } catch (e: any) {
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
    const sales = await dbGetAll('sales', (s) => s.userId === uid && !s.deleted);
    return sales.map(s => ({
        ...s,
        valueSold: ensureNumber(s.valueSold),
        valueProposed: ensureNumber(s.valueProposed),
        commissionValueTotal: ensureNumber(s.commissionValueTotal)
    }));
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
        Logger.error(`Audit: Falha ao sincronizar soft delete para ${table}/${id}`, e);
    }
};

export const saveSales = async (sales: Sale[]) => {
    const batch = writeBatch(db);
    for (const sale of sales) {
        await dbPut('sales', sale);
        batch.set(doc(db, 'sales', sale.id), sanitizeForFirestore(sale), { merge: true });
    }
    await batch.commit();
    SessionTraffic.trackWrite(sales.length);
};

export const canAccess = (user: User | null, mod: string): boolean => {
    if (!user || !user.isActive || user.userStatus === 'INACTIVE') return false;
    if (user.role === 'DEV' || user.role === 'ADMIN') return true;
    return !!(user.permissions as any)[mod];
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
        const snap = await getDoc(doc(db, "config", "system"));
        if (snap.exists()) return snap.data() as SystemConfig;
    } catch (e) {}
    const local = await dbGet('config', 'system');
    return local || DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
    await dbPut('config', { ...config, id: 'system' });
    await setDoc(doc(db, "config", "system"), sanitizeForFirestore(config));
};

export const getFinanceData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { accounts: [], transactions: [], cards: [], categories: [], goals: [], challenges: [], cells: [], receivables: [] };
    
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

    return { accounts, transactions, cards, categories, goals, challenges, cells, receivables };
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
    await deleteDoc(doc(db, table, id));
};

/* --- NOVO: IMPLEMENTAÇÃO DOS MEMBROS FALTANTES --- */

// Fix: Adicionado analyzeClients para análise de carteira CRM
export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, { name: string, totalSpent: number, lastPurchaseDate: string, totalOrders: number }>();
    sales.forEach(s => {
        const existing = clientsMap.get(s.client) || { name: s.client, totalSpent: 0, lastPurchaseDate: '1970-01-01', totalOrders: 0 };
        existing.totalSpent += s.valueSold * s.quantity;
        existing.totalOrders += 1;
        const sDate = s.date || s.completionDate || '1970-01-01';
        if (sDate > existing.lastPurchaseDate) existing.lastPurchaseDate = sDate;
        clientsMap.set(s.client, existing);
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

// Fix: Adicionado analyzeMonthlyVolume para gráficos históricos
export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const data: any[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7);
        const name = d.toLocaleDateString('pt-BR', { month: 'short' });
        
        const monthSales = sales.filter(s => s.date?.startsWith(key));
        const basica = monthSales.filter(s => s.type === ProductType.BASICA).reduce((acc, s) => acc + s.commissionValueTotal, 0);
        const natal = monthSales.filter(s => s.type === ProductType.NATAL).reduce((acc, s) => acc + s.commissionValueTotal, 0);
        
        data.push({ name, basica, natal });
    }
    return data;
};

// Fix: Adicionado exportReportToCSV para exportação de dados
export const exportReportToCSV = (data: any[], filename: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Fix: Adicionado calculateProductivityMetrics para semáforo de performance
export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const clientAnalysis = analyzeClients(sales, config);
    
    const activeClients = clientAnalysis.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const convertedThisMonth = new Set(sales.filter(s => {
        if (!s.date) return false;
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

// Fix: Adicionado calculateFinancialPacing para análise preditiva de caixa
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextIncomeDay = salaryDays.find(d => d > today) || salaryDays[0];
    
    let nextIncomeDate = new Date(now.getFullYear(), now.getMonth(), nextIncomeDay);
    if (nextIncomeDay <= today) {
        nextIncomeDate = new Date(now.getFullYear(), now.getMonth() + 1, nextIncomeDay);
    }

    const daysRemaining = Math.ceil((nextIncomeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const pendingExpenses = transactions
        .filter(t => !t.isPaid && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = daysRemaining > 0 ? (balance - pendingExpenses) / daysRemaining : 0;

    return {
        daysRemaining,
        safeDailySpend: Math.max(0, safeDailySpend),
        pendingExpenses,
        nextIncomeDate
    };
};

// Fix: Adicionado getInvoiceMonth para alocação de despesas em cartões
export const getInvoiceMonth = (date: string, closingDay: number): string => {
    const d = new Date(date);
    const day = d.getDate();
    if (day > closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().substring(0, 7);
};

// Fix: Adicionado exportEncryptedBackup para segurança de dados
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

// Fix: Adicionado importEncryptedBackup para restauração
export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const decrypted = CryptoJS.AES.decrypt(text, passphrase).toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error("Senha incorreta.");
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

// Fix: Adicionado clearAllSales para limpeza atômica
export const clearAllSales = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const sales = await getStoredSales();
    const batch = writeBatch(db);
    for (const s of sales) {
        batch.delete(doc(db, 'sales', s.id));
        await dbDelete('sales', s.id);
    }
    await batch.commit();
};

// Fix: Adicionado generateChallengeCells para desafios de poupança
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
            value,
            status: 'PENDING',
            userId: uid,
            deleted: false
        });
    }
    return cells;
};

// Fix: Adicionado processFinanceImport para importação de extratos
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    const transactions: Partial<Transaction>[] = [];
    const rows = data.slice(1);
    
    rows.forEach(row => {
        const description = mapping.description !== -1 ? String(row[mapping.description] || '') : 'Importação';
        const amount = ensureNumber(mapping.amount !== -1 ? row[mapping.amount] : 0);
        const date = mapping.date !== -1 ? String(row[mapping.date] || '') : new Date().toISOString().split('T')[0];
        
        if (description && amount !== 0) {
            transactions.push({
                id: crypto.randomUUID(),
                description,
                amount: Math.abs(amount),
                type: amount > 0 ? 'INCOME' : 'EXPENSE',
                date,
                isPaid: true,
                provisioned: false,
                deleted: false,
                createdAt: new Date().toISOString(),
                userId: auth.currentUser?.uid || ''
            });
        }
    });
    return transactions;
};

// Fix: Adicionado atomicClearUserTables para gestão administrativa
export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    const batch = writeBatch(db);
    for (const table of tables) {
        const q = query(collection(db, table), where("userId", "==", userId));
        const snap = await getDocs(q);
        snap.forEach(d => batch.delete(d.ref));
        
        const allLocal = await dbGetAll(table as any, (item: any) => item.userId === userId);
        for (const item of allLocal) {
            await dbDelete(table as any, item.id);
        }
    }
    await batch.commit();
};

// Fix: Adicionado formatCurrency para formatação consistente de BRL
export const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Fix: Adicionado getReportConfig e saveReportConfig
export const getReportConfig = async (): Promise<ReportConfig> => {
    try {
        const snap = await getDoc(doc(db, "config", "report"));
        if (snap.exists()) return snap.data() as ReportConfig;
    } catch (e) {}
    const local = await dbGet('config', 'report');
    return local || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    await dbPut('config', { ...config, id: 'report' });
    await setDoc(doc(db, "config", "report"), sanitizeForFirestore(config));
};

// Fix: Adicionado findPotentialDuplicates para higienização de base
export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set(sales.map(s => s.client)));
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

// Fix: Adicionado smartMergeSales para consolidação de registros
export const smartMergeSales = (sales: Sale[]): Sale => {
    return sales.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];
};

// Fix: Adicionado métodos de gestão de lixeira de clientes
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
    await dbDelete('clients', id);
    await deleteDoc(doc(db, 'clients', id));
};