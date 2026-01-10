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
  updateDoc,
  orderBy,
  limit,
  deleteDoc,
  onSnapshot
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import { sanitizeForFirestore } from '../utils/firestoreUtils';
import * as XLSX from 'xlsx';
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, Client, 
    ProductivityMetrics, Challenge, FinanceGoal, ImportMapping,
    User, ChallengeModel, WACampaign
} from '../types';
import { Logger } from './logger';
import { getSession } from './auth';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    bootstrapVersion: 2,
    includeNonAccountingInTotal: false,
    isMaintenanceMode: false,
    modules: {
        ai: true, sales: true, finance: true, crm: true,
        whatsapp: true, reports: true, dev: true, settings: true,
        news: true, receivables: true, distribution: true, imports: true,
        abc_analysis: true, ltv_details: true, ai_retention: true, 
        manual_billing: true, audit_logs: true, fiscal: true 
    }
};

export const validateWriteAccess = async () => {
    const user = getSession();
    if (user?.role === 'DEV') return true;
    const config = await getSystemConfig();
    if (config.isMaintenanceMode) throw new Error("SISTEMA EM MANUTENÇÃO: Operação de escrita bloqueada.");
    return true;
};

export const canAccess = (user: User | null, mod: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true;
    const perms = user.permissions || {};
    return !!(perms as any)[mod];
};

export const SystemPerformance = {
    firebaseLatency: 0,
    async measureFirebase(): Promise<number> {
        const start = performance.now();
        try {
            await getDocFromServer(doc(db, "config", "ping"));
            const latency = Math.round(performance.now() - start);
            this.firebaseLatency = latency;
            return latency;
        } catch { return -1; }
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

export const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const SessionTraffic = {
    reads: 0, writes: 0, lastActivity: null as Date | null,
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
};

export const calculatePredictiveCashFlow = (
    currentBalance: number,
    receivables: Receivable[],
    transactions: Transaction[]
) => {
    const timeline = [];
    const now = new Date();
    let rollingBalance = currentBalance;

    for (let i = 0; i <= 30; i++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];

        const dayIncomes = receivables
            .filter(r => r.date === dateStr && r.status === 'PENDING')
            .reduce((acc, r) => acc + (r.value - (r.deductions?.reduce((dAcc, d) => dAcc + d.amount, 0) || 0)), 0);

        const dayExpenses = transactions
            .filter(t => t.date === dateStr && !t.isPaid && t.type === 'EXPENSE')
            .reduce((acc, t) => acc + t.amount, 0);

        rollingBalance += (dayIncomes - dayExpenses);

        timeline.push({
            date: dateStr,
            displayDate: targetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            balance: rollingBalance,
            income: dayIncomes,
            expense: dayExpenses,
            isCritical: rollingBalance < 0
        });
    }

    return timeline;
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();
    sales.forEach(sale => {
        if (sale.deleted) return;
        const name = sale.client;
        const date = new Date(sale.date || sale.completionDate || 0);
        const existing = clientsMap.get(name) || {
            name, totalOrders: 0, totalSpent: 0, lastPurchaseDate: date, firstPurchaseDate: date
        };
        existing.totalOrders++;
        existing.totalSpent += sale.valueSold;
        if (date > existing.lastPurchaseDate) existing.lastPurchaseDate = date;
        if (date < existing.firstPurchaseDate) existing.firstPurchaseDate = date;
        clientsMap.set(name, existing);
    });
    return Array.from(clientsMap.values()).map(c => {
        const daysSinceLast = Math.floor((now.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceFirst = Math.floor((now.getTime() - c.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        let status = 'ACTIVE';
        if (daysSinceFirst <= config.daysForNewClient) status = 'NEW';
        else if (daysSinceLast > config.daysForLost) status = 'LOST';
        else if (daysSinceLast > config.daysForInactive) status = 'INACTIVE';
        return { ...c, daysSinceLastPurchase: daysSinceLast, status };
    });
};

export const getABCAnalysis = (sales: Sale[]) => {
    const activeSales = sales.filter(s => !s.deleted);
    const clientsData = new Map<string, number>();
    let totalRevenue = 0;
    activeSales.forEach(s => {
        const current = clientsData.get(s.client) || 0;
        clientsData.set(s.client, current + s.valueSold);
        totalRevenue += s.valueSold;
    });
    const sorted = Array.from(clientsData.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
    let cumulative = 0;
    return sorted.map(c => {
        cumulative += c.revenue;
        const percent = (cumulative / totalRevenue) * 100;
        let classification: 'A' | 'B' | 'C' = 'C';
        if (percent <= 70) classification = 'A';
        else if (percent <= 90) classification = 'B';
        return { ...c, percentOfTotal: (c.revenue / totalRevenue) * 100, cumulativePercent: percent, classification };
    });
};

export const getSalesByClient = async (clientName: string, clientId?: string): Promise<Sale[]> => {
    const allSales = await getStoredSales();
    return allSales.filter(s => {
        if (clientId && s.clientId === clientId) return true;
        return s.client.toLowerCase() === clientName.toLowerCase();
    }).sort((a,b) => new Date(b.date || b.completionDate || 0).getTime() - new Date(a.date || a.completionDate || 0).getTime());
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const data: any[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const name = d.toLocaleDateString('pt-BR', { month: 'short' });
        data.push({ name, basica: 0, natal: 0, month: d.getMonth(), year: d.getFullYear() });
    }
    sales.forEach(sale => {
        if (sale.deleted || !sale.date) return;
        const d = new Date(sale.date);
        const bin = data.find(b => b.month === d.getMonth() && b.year === d.getFullYear());
        if (bin) {
            if (sale.type === ProductType.BASICA) bin.basica += sale.quantity;
            else bin.natal += sale.quantity;
        }
    });
    return data;
};

export const exportReportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const csvContent = "\uFEFF" + headers + '\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    Logger.info(`Audit: Exportação de CSV finalizada para [${filename}]`);
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const config = await getReportConfig();
    const clients = analyzeClients(sales, config);
    const activeCount = clients.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const now = new Date();
    const convertedThisMonth = sales.filter(s => {
        if (s.deleted || !s.date) return false;
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const conversionRate = activeCount > 0 ? (convertedThisMonth / activeCount) * 100 : 0;
    let productivityStatus: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (conversionRate >= 70) productivityStatus = 'GREEN';
    else if (conversionRate >= 40) productivityStatus = 'YELLOW';
    return { totalClients: clients.length, activeClients: activeCount, convertedThisMonth, conversionRate, productivityStatus };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    if (day > closingDay) d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 7);
};

export const clearAllSales = async (): Promise<void> => {
    const dbInst = await initDB();
    await dbInst.clear('sales');
    Logger.warn("Auditoria: Cache local de vendas limpo.");
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    if (model === 'LINEAR') {
        const factor = target / ((count * (count + 1)) / 2);
        for (let i = 1; i <= count; i++) cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: i * factor, status: 'PENDING', userId: uid, deleted: false });
    } else if (model === 'PROPORTIONAL') {
        const val = target / count;
        for (let i = 1; i <= count; i++) cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING', userId: uid, deleted: false });
    }
    return cells;
};

export const saveFinanceData = async (data: { transactions?: Transaction[], accounts?: FinanceAccount[] }) => {
    await validateWriteAccess();
    try {
        if (data.transactions) await dbBulkPut('transactions', data.transactions);
        if (data.accounts) await dbBulkPut('accounts', data.accounts);
        SessionTraffic.trackWrite();
    } catch (e: any) {
        Logger.error(`Audit: Erro ao gravar dados financeiros: ${e.message}`);
        throw e;
    }
};

export const saveSingleSale = async (sale: Sale): Promise<void> => {
    await validateWriteAccess();
    try {
        await dbPut('sales', sale);
        await setDoc(doc(db, 'sales', sale.id), sanitizeForFirestore(sale), { merge: true });
        SessionTraffic.trackWrite();
    } catch (e: any) {
        Logger.error(`Audit: Erro ao gravar venda [${sale.id}]: ${e.message}`);
        throw e;
    }
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = (quantity || 0) * (valueProposed || 0);
    const rule = (rules || []).find(r => margin >= (r.minPercent || 0) && (r.maxPercent === null || margin < (r.maxPercent || 0)));
    const rateUsed = rule ? (rule.commissionRate || 0) : 0;
    return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

export const createReceivableFromSale = async (sale: Sale): Promise<string> => {
    await validateWriteAccess();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Unauthenticated");
    const receivableId = crypto.randomUUID();
    const newRec: Receivable = { id: receivableId, description: `Comissão: ${sale.client}`, value: sale.commissionValueTotal, date: sale.date || new Date().toISOString().split('T')[0], status: 'PENDING', distributed: false, deductions: [], userId: uid, deleted: false };
    await dbPut('receivables', newRec);
    await setDoc(doc(db, "receivables", receivableId), sanitizeForFirestore(newRec));
    SessionTraffic.trackWrite();
    return receivableId;
};

export const subscribeToCommissionRules = (type: ProductType, callback: (rules: CommissionRule[]) => void) => {
    const colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const q = query(collection(db, colName), where("isActive", "==", true), limit(1));
    return onSnapshot(q, (snap) => {
        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const rules: CommissionRule[] = (docData?.tiers || []).map((t: any, idx: number) => ({
                id: `${docData.version || 'v1'}_${idx}`,
                minPercent: ensureNumber(t.min),
                maxPercent: t.max === null ? null : ensureNumber(t.max),
                commissionRate: ensureNumber(t.rate),
                isActive: true
            }));
            callback(rules.sort((a, b) => a.minPercent - b.minPercent));
        } else { callback([]); }
    }, (error) => {
        console.error("[Logic] Tabela de comissão erro no onSnapshot:", error);
        callback([]);
    });
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    try {
        const q = query(collection(db, colName), where("isActive", "==", true), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const rules: CommissionRule[] = (docData?.tiers || []).map((t: any, idx: number) => ({
                id: `${docData.version || 'v1'}_${idx}`,
                minPercent: ensureNumber(t.min),
                maxPercent: t.max === null ? null : ensureNumber(t.max),
                commissionRate: ensureNumber(t.rate),
                isActive: true
            }));
            await dbBulkPut(storeName as any, rules);
            return rules.sort((a, b) => a.minPercent - b.minPercent);
        }
    } catch (e) {}
    const cached = await dbGetAll(storeName as any);
    return (cached || []).filter((r: any) => r.isActive).sort((a: any, b: any) => a.minPercent - b.minPercent);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    await validateWriteAccess();
    const colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const q = query(collection(db, colName), where("isActive", "==", true));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() }));
    const newDocRef = doc(collection(db, colName));
    batch.set(newDocRef, sanitizeForFirestore({ version: Date.now(), isActive: true, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid, tiers: rules.map(r => ({ min: Number(r.minPercent), max: r.maxPercent === null ? null : Number(r.maxPercent), rate: Number(r.commissionRate) })) }));
    await batch.commit();
    Logger.info(`Audit: Tabela de comissão [${type}] atualizada globalmente.`);
};

export const getStoredSales = async (): Promise<Sale[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
        const q = query(collection(db, 'sales'), where('userId', '==', uid), where('deleted', '==', false), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        const cloudSales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
        await dbBulkPut('sales', cloudSales);
    } catch (e) {}
    return await dbGetAll('sales', s => s.userId === uid && !s.deleted);
};

export const getFinanceData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { accounts: [], transactions: [], cards: [], categories: [], goals: [], challenges: [], cells: [], receivables: [] };
    const tables = ['accounts', 'transactions', 'cards', 'categories', 'goals', 'challenges', 'challenge_cells', 'receivables'];
    for (const table of tables) {
        try {
            const q = query(collection(db, table), where('userId', '==', uid), where('deleted', '==', false));
            const snap = await getDocs(q);
            await dbBulkPut(table as any, snap.docs.map(d => ({ ...d.data(), id: d.id })));
        } catch (e) {}
    }
    return {
        accounts: await dbGetAll('accounts', a => a.userId === uid && !a.deleted),
        transactions: await dbGetAll('transactions', t => t.userId === uid && !t.deleted),
        cards: await dbGetAll('cards', c => c.userId === uid && !c.deleted),
        categories: await dbGetAll('categories', c => c.userId === uid && !c.deleted),
        goals: await dbGetAll('goals', g => g.userId === uid && !g.deleted),
        challenges: await dbGetAll('challenges', ch => ch.userId === uid && !ch.deleted),
        cells: await dbGetAll('challenge_cells', cl => cl.userId === uid && !cl.deleted),
        receivables: await dbGetAll('receivables', r => r.userId === uid && !r.deleted)
    };
};

export const handleSoftDelete = async (table: string, id: string) => {
    await validateWriteAccess();
    try {
        const local = await dbGet(table as any, id);
        if (local) await dbPut(table as any, { ...local, deleted: true, deletedAt: new Date().toISOString() });
        await updateDoc(doc(db, table, id), { deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } catch (e: any) {
        Logger.error(`Audit: Falha ao deletar item [${id}] de [${table}]: ${e.message}`);
    }
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
    await validateWriteAccess();
    await dbPut('config', { ...config, id: 'system' });
    await setDoc(doc(db, "config", "system"), sanitizeForFirestore(config));
};

export const getClients = async (): Promise<Client[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
        const q = query(collection(db, 'clients'), where('userId', '==', uid), where('deleted', '==', false));
        const snap = await getDocs(q);
        await dbBulkPut('clients', snap.docs.map(d => ({ ...d.data(), id: d.id } as Client)));
    } catch (e) {}
    return await dbGetAll('clients', c => c.userId === uid && !c.deleted);
};

export const createClientAutomatically = async (name: string): Promise<string> => {
    await validateWriteAccess();
    const uid = auth.currentUser?.uid || '';
    const id = crypto.randomUUID();
    const newClient: Client = { id, name, userId: uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deleted: false };
    await dbPut('clients', newClient);
    await setDoc(doc(db, 'clients', id), sanitizeForFirestore(newClient));
    return id;
};

export const bootstrapProductionData = async () => {
    const sys = await getSystemConfig();
    if (sys.bootstrapVersion < 2) await saveSystemConfig({ ...DEFAULT_SYSTEM_CONFIG, bootstrapVersion: 2 });
};

export const getTrashItems = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { sales: [], transactions: [] };
    return {
        sales: await dbGetAll('sales', s => s.userId === uid && s.deleted),
        // Fixed: changed 's.deleted' to 't.deleted' as 's' is not defined in this arrow function
        transactions: await dbGetAll('transactions', t => t.userId === uid && t.deleted)
    };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    await validateWriteAccess();
    const table = type === 'SALE' ? 'sales' : 'transactions';
    const restored = { ...item, deleted: false, updatedAt: new Date().toISOString() };
    await dbPut(table, restored);
    await setDoc(doc(db, table, item.id), sanitizeForFirestore(restored), { merge: true });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    await validateWriteAccess();
    await dbDelete(type === 'SALE' ? 'sales' : 'transactions', id);
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
    await validateWriteAccess();
    await dbPut('config', { ...config, id: 'report' });
    await setDoc(doc(db, "config", "report"), sanitizeForFirestore(config));
};

export const getDeletedClients = async (): Promise<Client[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return await dbGetAll('clients', c => c.userId === uid && c.deleted);
};

export const restoreClient = async (id: string) => {
    await validateWriteAccess();
    const local = await dbGet('clients', id);
    if (local) {
        const restored = { ...local, deleted: false, updatedAt: new Date().toISOString() };
        await dbPut('clients', restored);
        await updateDoc(doc(db, 'clients', id), { deleted: false, updatedAt: serverTimestamp() });
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    await validateWriteAccess();
    await dbDelete('clients', id);
};

export const readExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            try {
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(json as any[][]);
            } catch (err) { reject(err); }
        };
        reader.onerror = (ex) => reject(ex);
        reader.readAsArrayBuffer(file);
    });
};

export const downloadSalesTemplate = () => {
    const headers = ["Data Faturamento (Opcional)", "Data Pedido", "Tipo (Cesta Básica ou Natal)", "Cliente", "Quantidade", "Valor Unitário Proposto", "Valor Total Venda", "Margem (%)", "Observações"];
    const rows = [["2025-01-10", "2025-01-05", "Cesta Básica", "Exemplo Cliente LTDA", "100", "80.50", "8050.00", "15.5", "Venda importada"]];
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_importacao_vendas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const saveSales = async (sales: Sale[]) => {
    await validateWriteAccess();
    const batch = writeBatch(db);
    for (const sale of sales) {
        const saleRef = doc(db, 'sales', sale.id);
        batch.set(saleRef, sanitizeForFirestore(sale), { merge: true });
    }
    await batch.commit();
    await dbBulkPut('sales', sales);
    SessionTraffic.trackWrite(sales.length);
};

export const getTicketStats = async (): Promise<number> => {
    try {
        const q = query(collection(db, 'internal_messages'), where('type', '==', 'BUG_REPORT'), where('deleted', '==', false));
        const snap = await getDocs(q);
        return snap.size;
    } catch (e) { return 0; }
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    const activeSales = sales.filter(sale => !sale.deleted);
    const uniqueNames = Array.from(new Set(activeSales.map(sale => sale.client)));
    const duplicates: { master: string, similar: string[] }[] = [];
    const processed = new Set<string>();
    const normalize = (str: string) => str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < uniqueNames.length; i++) {
        const nameA = uniqueNames[i];
        if (processed.has(nameA)) continue;
        const normA = normalize(nameA);
        const similar: string[] = [];
        for (let j = i + 1; j < uniqueNames.length; j++) {
            const nameB = uniqueNames[j];
            if (processed.has(nameB)) continue;
            const normB = normalize(nameB);
            if (normA === normB || (normA.length > 5 && normB.length > 5 && (normA.includes(normB) || normB.includes(normA)))) {
                similar.push(nameB);
                processed.add(nameB);
            }
        }
        if (similar.length > 0) {
            duplicates.push({ master: nameA, similar });
            processed.add(nameA);
        }
    }
    return duplicates;
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const data: any = {};
    const tables = ['sales', 'transactions', 'accounts', 'clients', 'cards', 'categories', 'goals', 'challenges', 'challenge_cells', 'receivables'];
    for (const t of tables) data[t] = await dbGetAll(t as any);
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup_gestor360_${Date.now()}.json`; a.click();
};

export const calculateFinancialPacing = (balance: number, expenses: Transaction[]): FinancialPacing => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = endOfMonth.getDate() - now.getDate() + 1;
    
    const pendingExpenses = expenses
        .filter(e => !e.isPaid && e.type === 'EXPENSE')
        .reduce((acc, e) => acc + e.amount, 0);
    
    const safeDailySpend = (balance - pendingExpenses) / Math.max(1, daysRemaining);
    
    return {
        daysRemaining,
        safeDailySpend: Math.max(0, safeDailySpend),
        pendingExpenses,
        nextIncomeDate: new Date() 
    };
};

export const markAsReconciled = async (txId: string, status: boolean) => {
    await validateWriteAccess();
    await updateDoc(doc(db, "transactions", txId), {
        reconciled: status,
        reconciledAt: status ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
    });
    
    const local = await dbGet('transactions', txId);
    if (local) {
        await dbPut('transactions', { 
            ...local, 
            reconciled: status, 
            reconciledAt: status ? new Date().toISOString() : undefined 
        });
    }
};

export const bulkMarkAsReconciled = async (ids: string[], status: boolean) => {
    await validateWriteAccess();
    const batch = writeBatch(db);
    for (const id of ids) {
        batch.update(doc(db, "transactions", id), {
            reconciled: status,
            reconciledAt: status ? serverTimestamp() : null,
            updatedAt: serverTimestamp()
        });
        
        const local = await dbGet('transactions', id);
        if (local) {
            await dbPut('transactions', { 
                ...local, 
                reconciled: status, 
                reconciledAt: status ? new Date().toISOString() : undefined 
            });
        }
    }
    await batch.commit();
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                for (const table in data) {
                    if (Array.isArray(data[table])) {
                        await dbBulkPut(table as any, data[table]);
                    }
                }
                resolve();
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

export const processFinanceImport = async (data: any[][], mapping: ImportMapping) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const transactions: Transaction[] = [];
    const batch = writeBatch(db);

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const dateIdx = mapping['date'];
        const descIdx = mapping['description'];
        const amountIdx = mapping['amount'];
        const typeIdx = mapping['type'];

        if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) continue;

        const amount = ensureNumber(row[amountIdx]);
        const type = typeIdx !== -1 && row[typeIdx] 
            ? (String(row[typeIdx]).toUpperCase().includes('REC') ? 'INCOME' : 'EXPENSE') 
            : (amount >= 0 ? 'INCOME' : 'EXPENSE');

        const txId = crypto.randomUUID();
        const tx: Transaction = {
            id: txId,
            description: String(row[descIdx] || 'Importado'),
            amount: Math.abs(amount),
            type: type as any,
            date: row[dateIdx] ? new Date(row[dateIdx]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isPaid: true,
            provisioned: false,
            isRecurring: false,
            deleted: false,
            createdAt: new Date().toISOString(),
            userId: uid,
            categoryId: 'uncategorized',
            accountId: '' 
        };
        
        transactions.push(tx);
        batch.set(doc(db, 'transactions', txId), sanitizeForFirestore(tx));
    }
    
    if (transactions.length > 0) {
        await batch.commit();
        await dbBulkPut('transactions', transactions);
    }
};

export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    await validateWriteAccess();
    for (const table of tables) {
        const q = query(collection(db, table), where('userId', '==', userId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        
        // Local clear
        const local = await dbGetAll(table as any);
        for(const item of local) {
            if (item.userId === userId) await dbDelete(table as any, item.id);
        }
    }
};

export const clearNotifications = async (userId: string, source: string) => {
    await validateWriteAccess();
    const colRef = collection(db, 'notifications');
    const q = source === 'ALL' 
        ? query(colRef, where('userId', '==', userId))
        : query(colRef, where('userId', '==', userId), where('source', '==', source));
    
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

export const archiveWACampaign = async (campaignId: string, status: boolean) => {
    await validateWriteAccess();
    await updateDoc(doc(db, 'wa_campaigns', campaignId), {
        isArchived: status,
        updatedAt: serverTimestamp()
    });
    const local = await dbGet('wa_campaigns', campaignId);
    if (local) {
        await dbPut('wa_campaigns', { ...local, isArchived: status } as any);
    }
};

export const smartMergeSales = (items: Sale[]): Sale => {
    const sorted = [...items].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const master = sorted[0];
    const duplicates = sorted.slice(1);
    
    const obs = [master.observations, ...duplicates.map(d => d.observations)].filter(Boolean).join(' | ');
    
    return {
        ...master,
        observations: obs,
        updatedAt: new Date().toISOString()
    };
};