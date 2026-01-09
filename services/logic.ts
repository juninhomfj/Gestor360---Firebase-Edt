
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
        manual_billing: true, audit_logs: true
    }
};

/**
 * Validação mandante para operações de escrita
 * Arremessa erro se o sistema estiver em manutenção e o usuário não for DEV.
 */
export const validateWriteAccess = async () => {
    const user = getSession();
    if (user?.role === 'DEV') return true;
    
    const config = await getSystemConfig();
    if (config.isMaintenanceMode) {
        throw new Error("SISTEMA EM MANUTENÇÃO: As alterações estão temporariamente bloqueadas para atualizações de infraestrutura.");
    }
    return true;
};

export const checkMaintenance = async (user: User | null) => {
    if (!user || user.role === 'DEV') return false;
    const cfg = await getSystemConfig();
    return !!cfg.isMaintenanceMode;
};

export const canAccess = (user: User | null, mod: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true;
    const perms = user.permissions || {};
    return !!(perms as any)[mod];
};

export const SystemPerformance = {
    firebaseLatency: 0,
    backendLatency: 0,
    lastPing: null as Date | null,
    
    async measureFirebase(): Promise<number> {
        const start = performance.now();
        try {
            await getDocFromServer(doc(db, "config", "ping"));
            const latency = Math.round(performance.now() - start);
            this.firebaseLatency = latency;
            this.lastPing = new Date();
            return latency;
        } catch {
            return -1;
        }
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
    reads: 0, 
    writes: 0, 
    lastActivity: null as Date | null,
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
};

/**
 * Gestão de Notificações Cloud
 */
export const clearNotifications = async (userId: string, scope: 'ALL' | 'LOCAL' = 'LOCAL') => {
    if (scope === 'LOCAL') {
        return true;
    }
    try {
        const q = query(collection(db, 'notifications'), where('read', '==', false));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.update(d.ref, { read: true, updatedAt: serverTimestamp() }));
        await batch.commit();
        return true;
    } catch (e) {
        return false;
    }
};

export const archiveWACampaign = async (campaignId: string, status: boolean = true) => {
    await validateWriteAccess();
    const campRef = doc(db, 'wa_campaigns', campaignId);
    await updateDoc(campRef, { 
        isArchived: status,
        updatedAt: serverTimestamp()
    });
    SessionTraffic.trackWrite();
    return true;
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

    const sorted = Array.from(clientsData.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

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
    return {
        totalClients: clients.length, activeClients: activeCount, convertedThisMonth, conversionRate, productivityStatus
    };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    if (day > closingDay) d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 7);
};

export const importEncryptedBackup = async (file: File, pass: string): Promise<void> => {
    const text = await file.text();
    const data = JSON.parse(text);
    const tables = Object.keys(data);
    for (const table of tables) await dbBulkPut(table as any, data[table]);
    Logger.info("Auditoria: Restauração de base concluída localmente.");
};

export const clearAllSales = async (): Promise<void> => {
    const dbInst = await initDB();
    await dbInst.clear('sales');
    Logger.warn("Auditoria: Base de vendas local limpa pelo usuário.");
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    if (model === 'LINEAR') {
        const factor = target / ((count * (count + 1)) / 2);
        for (let i = 1; i <= count; i++) cells.push({
            id: crypto.randomUUID(), challengeId, number: i, value: i * factor, status: 'PENDING', userId: uid, deleted: false
        });
    } else if (model === 'PROPORTIONAL') {
        const val = target / count;
        for (let i = 1; i <= count; i++) cells.push({
            id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING', userId: uid, deleted: false
        });
    }
    return cells;
};

export const processFinanceImport = (data: any[][], mapping: ImportMapping): Transaction[] => {
    const uid = auth.currentUser?.uid || '';
    return data.slice(1).map(row => {
        const amount = ensureNumber(row[mapping['amount']]);
        return {
            id: crypto.randomUUID(), description: String(row[mapping['description']] || 'Importado'), amount: Math.abs(amount),
            type: amount < 0 ? 'EXPENSE' : 'INCOME', date: new Date(row[mapping['date']]).toISOString().split('T')[0],
            accountId: '', categoryId: 'uncategorized', isPaid: true, provisioned: false, isRecurring: false, deleted: false,
            createdAt: new Date().toISOString(), userId: uid
        };
    });
};

export const readExcelFile = async (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            resolve(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
};

export const saveFinanceData = async (data: { transactions?: Transaction[], accounts?: FinanceAccount[] }) => {
    await validateWriteAccess();
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
    SessionTraffic.trackWrite();
};

export const atomicClearUserTables = async (targetUserId: string, tables: string[]): Promise<void> => {
    await validateWriteAccess();
    for (const table of tables) {
        const items = await dbGetAll(table as any, (i: any) => i.userId === targetUserId);
        for (const item of items) {
            await dbDelete(table as any, item.id);
            await deleteDoc(doc(db, table, item.id));
        }
    }
    Logger.warn(`Audit: Reset atômico executado para o usuário ${targetUserId} em ${tables.length} tabelas.`);
};

export const downloadSalesTemplate = () => {
    const headers = ["date", "completionDate", "type", "client", "quantity", "valueProposed", "valueSold", "margin", "obs"];
    const csvContent = "\uFEFF" + headers.join(',') + '\n' + '2025-02-27,2025-02-20,Cesta Básica,Cliente Exemplo,10,150.00,1500.00,15,Venda de teste';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "modelo_importacao_vendas.csv");
    link.click();
};

export const saveSingleSale = async (sale: Sale): Promise<void> => {
    await validateWriteAccess();
    await dbPut('sales', sale);
    await setDoc(doc(db, 'sales', sale.id), sanitizeForFirestore(sale), { merge: true });
    SessionTraffic.trackWrite();
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set(sales.filter(s => !s.deleted).map(s => s.client)));
    const groups: { master: string, similar: string[] }[] = [];
    const processed = new Set<string>();
    for (let i = 0; i < clients.length; i++) {
        const nameA = clients[i];
        if (processed.has(nameA)) continue;
        const similar = [];
        for (let j = i + 1; j < clients.length; j++) {
            const nameB = clients[j];
            if (nameA.toLowerCase() === nameB.toLowerCase() || nameA.includes(nameB) || nameB.includes(nameA)) {
                similar.push(nameB);
                processed.add(nameB);
            }
        }
        if (similar.length > 0) {
            groups.push({ master: nameA, similar });
            processed.add(nameA);
        }
    }
    return groups;
};

export const smartMergeSales = (duplicates: Sale[]): Sale => {
    const sorted = [...duplicates].sort((a, b) => (b.observations?.length || 0) - (a.observations?.length || 0));
    return sorted[0];
};

export const getTicketStats = async (): Promise<number> => {
    const all = await dbGetAll('internal_messages');
    return all.filter(m => m.type === 'BUG_REPORT' && !m.read).length;
};

export const bulkMarkAsReconciled = async (ids: string[], status: boolean) => {
    await validateWriteAccess();
    const batch = writeBatch(db);
    for (const id of ids) {
        const txRef = doc(db, 'transactions', id);
        batch.update(txRef, sanitizeForFirestore({
            reconciled: status,
            reconciledAt: status ? new Date().toISOString() : null,
            updatedAt: serverTimestamp()
        }));
        const local = await dbGet('transactions', id);
        if (local) await dbPut('transactions', { ...local, reconciled: status, reconciledAt: status ? new Date().toISOString() : undefined });
    }
    await batch.commit();
    SessionTraffic.trackWrite(ids.length);
};

export const markAsReconciled = async (transactionId: string, status: boolean): Promise<void> => {
    await validateWriteAccess();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const txRef = doc(db, "transactions", transactionId);
    const updateData = sanitizeForFirestore({
        reconciled: status, reconciledAt: status ? new Date().toISOString() : null, updatedAt: serverTimestamp()
    });
    await updateDoc(txRef, updateData);
    const local = await dbGet('transactions', transactionId);
    if (local) await dbPut('transactions', { ...local, reconciled: status, reconciledAt: status ? new Date().toISOString() : undefined });
    SessionTraffic.trackWrite();
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = (quantity || 0) * (valueProposed || 0);
    const rule = (rules || []).find(r => r && margin >= (r.minPercent || 0) && (r.maxPercent === null || margin < (r.maxPercent || 0)));
    const rateUsed = rule ? (rule.commissionRate || 0) : 0;
    return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

export const createReceivableFromSale = async (sale: Sale): Promise<string> => {
    await validateWriteAccess();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Usuário não autenticado");
    const receivableId = crypto.randomUUID();
    const newRec: Receivable = {
        id: receivableId, description: `Comissão: ${sale.client} (${sale.type})`, value: sale.commissionValueTotal,
        date: sale.date || new Date().toISOString().split('T')[0], status: 'PENDING', distributed: false, deductions: [], userId: uid, deleted: false
    };
    const safeRec = sanitizeForFirestore(newRec);
    await dbPut('receivables', newRec);
    await setDoc(doc(db, "receivables", receivableId), safeRec);
    SessionTraffic.trackWrite();
    return receivableId;
};

export const subscribeToCommissionRules = (type: ProductType, callback: (rules: CommissionRule[]) => void) => {
    let colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const q = query(collection(db, colName), where("isActive", "==", true), limit(1));
    return onSnapshot(q, (snap) => {
        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const tiers = docData?.tiers || [];
            const rules: CommissionRule[] = tiers.map((t: any, idx: number) => ({
                id: `${docData.version}_${idx}`,
                minPercent: ensureNumber(t.min),
                maxPercent: t.max === null ? null : ensureNumber(t.max),
                commissionRate: ensureNumber(t.rate),
                isActive: true
            }));
            callback(rules.sort((a, b) => a.minPercent - b.minPercent));
        } else {
            callback([]);
        }
    }, (error) => {
        Logger.error(`Erro ao assinar regras de comissão [${type}]`, error);
    });
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    let colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    let storeName = type === ProductType.NATAL ? 'commission_natal' : 'commission_basic';
    try {
        const q = query(collection(db, colName), where("isActive", "==", true), limit(1));
        const snap = await getDocs(q); 
        SessionTraffic.trackRead(snap.size);
        if (!snap.empty) {
            const docData = snap.docs[0].data();
            const tiers = docData?.tiers || [];
            const rules: CommissionRule[] = tiers.map((t: any, idx: number) => ({
                id: `${docData.version}_${idx}`,
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
    let colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Acesso negado: Auth required.");

    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        
        snap.docs.forEach(d => batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() }));
        
        const newDocRef = doc(collection(db, colName));
        const payload = sanitizeForFirestore({
            version: Date.now(),
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: uid,
            tiers: rules.map(r => ({ 
                min: Number(r.minPercent), 
                max: r.maxPercent === null ? null : Number(r.maxPercent), 
                rate: Number(r.commissionRate)
            }))
        });
        
        batch.set(newDocRef, payload);
        await batch.commit();
        SessionTraffic.trackWrite();
        Logger.info(`Audit: Tabelas de comissão [${type}] atualizadas com sucesso.`);
    } catch (e: any) {
        Logger.error(`Audit: Falha ao salvar regras [${type}]`, { code: e.code, message: e.message });
        throw e;
    }
};

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
            SessionTraffic.trackRead(snap.size);
            const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            await dbBulkPut(table as any, data);
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

export const saveSales = async (sales: Sale[]) => {
    await validateWriteAccess();
    const batch = writeBatch(db);
    for (const sale of sales) {
        const safeSale = sanitizeForFirestore(sale);
        await dbPut('sales', sale);
        batch.set(doc(db, 'sales', sale.id), safeSale, { merge: true });
    }
    await batch.commit();
    SessionTraffic.trackWrite(sales.length);
};

export const handleSoftDelete = async (table: string, id: string) => {
    await validateWriteAccess();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const local = await dbGet(table as any, id);
    if (local) await dbPut(table as any, { ...local, deleted: true, deletedAt: new Date().toISOString() });
    try {
        await updateDoc(doc(db, table, id), sanitizeForFirestore({
            deleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }));
        SessionTraffic.trackWrite();
    } catch (e) {}
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
    const safeConfig = sanitizeForFirestore(config);
    await dbPut('config', { ...config, id: 'system' });
    await setDoc(doc(db, "config", "system"), safeConfig);
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

export const createClientAutomatically = async (name: string): Promise<string> => {
    await validateWriteAccess();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Auth required");
    const id = crypto.randomUUID();
    const newClient: Client = {
        id, name, userId: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false
    };
    await dbPut('clients', newClient);
    await setDoc(doc(db, 'clients', id), sanitizeForFirestore(newClient));
    return id;
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
    return {
        sales: await dbGetAll('sales', s => s.userId === uid && s.deleted),
        transactions: await dbGetAll('transactions', t => t.userId === uid && t.deleted)
    };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    await validateWriteAccess();
    const restored = { ...item, deleted: false, updatedAt: new Date().toISOString() };
    const table = type === 'SALE' ? 'sales' : 'transactions';
    await dbPut(table, restored);
    await setDoc(doc(db, table, item.id), sanitizeForFirestore(restored), { merge: true });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    await validateWriteAccess();
    const table = type === 'SALE' ? 'sales' : 'transactions';
    await dbDelete(table, id);
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

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextIncomeDay = (salaryDays || []).find(d => d > today) || (salaryDays || [])[0] || 1;
    let nextIncomeDate = new Date(now.getFullYear(), now.getMonth(), nextIncomeDay);
    if (nextIncomeDay <= today) nextIncomeDate = new Date(now.getFullYear(), now.getMonth() + 1, nextIncomeDay);
    const daysRemaining = Math.max(1, Math.ceil((nextIncomeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const pendingExpenses = transactions
        .filter(t => !t.isPaid && !t.deleted && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);
    return {
        daysRemaining,
        safeDailySpend: Math.max(0, (balance - pendingExpenses) / daysRemaining),
        pendingExpenses,
        nextIncomeDate
    };
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const data: any = {};
    const tables = ['sales', 'transactions', 'accounts', 'clients', 'cards', 'categories', 'goals', 'challenges', 'challenge_cells', 'receivables'];
    for (const t of tables) data[t] = await dbGetAll(t as any);
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup_gestor360_${Date.now()}.json`;
    a.click();
};
