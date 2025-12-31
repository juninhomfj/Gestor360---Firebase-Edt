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
  limit,
  getCountFromServer
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "./firebase";
import { dbPut, dbBulkPut, dbGetAll, initDB, dbDelete, dbGet } from '../storage/db';
import { encryptData, decryptData } from '../utils/encryption';
import * as XLSX from 'xlsx';
import CryptoJS from 'crypto-js';
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    CreditCard, ChallengeCell, FinancialPacing, Client, 
    ProductivityMetrics, Challenge, FinanceGoal, ImportMapping, UserPreferences,
    User, DuplicateGroup, NtfyPayload, ChallengeModel, InternalMessage
} from '../types';
import { Logger } from './logger';
import { sendMessage } from './internalChat';

// Fix: Defined DEFAULT_SYSTEM_CONFIG which was missing and causing line 191 error
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    bootstrapVersion: 1,
    includeNonAccountingInTotal: false,
    modules: {
        ai: true,
        sales: true,
        finance: true,
        crm: true,
        whatsapp: false,
        reports: true,
        dev: false,
        settings: true,
        news: true,
        receivables: true,
        distribution: true,
        imports: true
    }
};

// --- SISTEMA DE LOGGING DETERMINÍSTICO (BUFFER CIRCULAR) ---
const MAX_LOG_BUFFER = 50;
const executionBuffer: Array<{ timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; module: string; action: string; details?: any }> = [];

export const recordTrace = (level: 'INFO' | 'WARN' | 'ERROR', module: string, action: string, details?: any) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        module,
        action,
        details: details ? JSON.parse(JSON.stringify(details)) : null
    };
    executionBuffer.push(entry);
    if (executionBuffer.length > MAX_LOG_BUFFER) executionBuffer.shift();
    if (process.env.NODE_ENV === 'development') console.log(`[${level}] [${module}:${action}]`, details || '');
};

/**
 * Reporta erro de runtime criando um Ticket Contável.
 */
export const reportRuntimeError = async (context?: string) => {
    const user = auth.currentUser;
    if (!user) return;

    recordTrace('INFO', 'SYSTEM', 'REPORT_TICKET_GEN');

    const reportContent = `[TICKET AUTOMÁTICO - ${context || 'ERRO'}]\n` +
        `Buffer:\n${JSON.stringify(executionBuffer, null, 2)}`;

    try {
        await sendMessage(
            { id: user.uid, name: user.displayName || 'Usuário' } as User,
            reportContent,
            'BUG_REPORT',
            'ADMIN'
        );
    } catch (e: any) {
        recordTrace('ERROR', 'SYSTEM', 'TICKET_FAIL', { error: e.message });
    }
};

/**
 * Retorna o número exato de tickets (bug_reports) no sistema.
 */
export const getTicketStats = async () => {
    const coll = collection(db, "internal_messages");
    const q = query(coll, where("type", "==", "BUG_REPORT"));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
};

export const SessionTraffic = {
    reads: 0, writes: 0, lastActivity: null as Date | null,
    trackRead(count = 1) { this.reads += count; this.lastActivity = new Date(); },
    trackWrite(count = 1) { this.writes += count; this.lastActivity = new Date(); }
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
        recordTrace('ERROR', 'COMMISSIONS', 'LOAD_FAIL', { type, error: e.message });
    }
    
    const cached = await dbGetAll(storeName as any);
    return (cached || []).sort((a: any, b: any) => a.minPercent - b.minPercent);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colName = type === ProductType.NATAL ? 'commissions_natal' : 'commissions_basic';
    const version = Date.now();
    
    try {
        const q = query(collection(db, colName), where("isActive", "==", true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);

        snap.docs.forEach(d => batch.update(d.ref, { isActive: false }));

        batch.set(doc(collection(db, colName)), {
            version,
            isActive: true,
            createdAt: serverTimestamp(),
            tiers: rules.map(r => ({ min: r.minPercent, max: r.maxPercent, rate: r.commissionRate }))
        });

        await batch.commit();
        SessionTraffic.trackWrite();
    } catch (e: any) {
        recordTrace('ERROR', 'COMMISSIONS', 'SAVE_FAIL', { error: e.message });
        throw e;
    }
};

export const ensureNumber = (value: any, fallback = 0): number => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number') return isNaN(value) ? fallback : value;
    const str = String(value).replace(/[^\d.,-]/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? fallback : num;
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
    return await dbGetAll('sales', (s) => s.userId === uid && !s.deleted);
};

export const saveSingleSale = async (sale: Sale) => {
    await dbPut('sales', sale);
    await setDoc(doc(db, 'sales', sale.id), sanitizeForFirestore(sale), { merge: true });
    SessionTraffic.trackWrite();
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

export const getSystemConfig = async (): Promise<SystemConfig & UserPreferences> => {
    const globalSnap = await getDoc(doc(db, "config", "system"));
    const uid = auth.currentUser?.uid;
    const userPrefs = uid ? await getDoc(doc(db, "config", `system_${uid}`)) : null;
    return { 
        ...DEFAULT_SYSTEM_CONFIG, 
        ...(globalSnap.exists() ? globalSnap.data() : {}),
        ...(userPrefs?.exists() ? userPrefs.data() : {})
    };
};

export const saveSystemConfig = async (config: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, "config", `system_${uid}`), sanitizeForFirestore(config), { merge: true });
    SessionTraffic.trackWrite();
};

export const computeCommissionValues = (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const rule = rules.find(r => margin >= r.minPercent && (r.maxPercent === null || margin < r.maxPercent));
    const rateUsed = rule ? rule.commissionRate : 0;
    return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

export const getFinanceData = async () => {
    const [accounts, cards, transactions, categories, goals, challenges, cells, receivables] = await Promise.all([
        dbGetAll('accounts'), dbGetAll('cards'), dbGetAll('transactions'), dbGetAll('categories'),
        dbGetAll('goals'), dbGetAll('challenges'), dbGetAll('challenge_cells'), dbGetAll('receivables')
    ]);
    return { accounts, cards, transactions, categories, goals, challenges, cells, receivables };
};

export const bootstrapProductionData = async () => {
    recordTrace('INFO', 'SYSTEM', 'BOOTSTRAP');
};

export const clearLocalCache = async () => {
    localStorage.clear();
    const dbInst = await initDB();
    for (const s of Array.from(dbInst.objectStoreNames)) await dbInst.clear(s as any);
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const snap = await dbGet('config', 'report_config');
    return (snap as any) || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    await setDoc(doc(db, 'config', 'report_config'), config, { merge: true });
};

export const getClients = async (): Promise<Client[]> => {
    return await dbGetAll('clients', c => !c.deleted);
};

export const getTrashItems = async () => {
    const [sales, transactions] = await Promise.all([
        dbGetAll('sales', s => s.deleted),
        dbGetAll('transactions', t => t.deleted)
    ]);
    return { sales, transactions };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const store = type === 'SALE' ? 'sales' : 'transactions';
    const updated = { ...item, deleted: false, deletedAt: null };
    await dbPut(store as any, updated);
    await updateDoc(doc(db, store, item.id), { deleted: false, deletedAt: null });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const store = type === 'SALE' ? 'sales' : 'transactions';
    await dbDelete(store as any, id);
    await deleteDoc(doc(db, store, id));
};

export const getDeletedClients = async (): Promise<Client[]> => {
    return await dbGetAll('clients', c => c.deleted);
};

export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        const updated = { ...client, deleted: false, deletedAt: null };
        await dbPut('clients', updated);
        await updateDoc(doc(db, 'clients', id), { deleted: false, deletedAt: null });
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    await dbDelete('clients', id);
    await deleteDoc(doc(db, 'clients', id));
};

// Fix: Implemented canAccess missing export
export const canAccess = (user: User | null, mod: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true;
    if (!user.permissions) return false;
    return !!(user.permissions as any)[mod];
};

// Fix: Implemented analyzeClients missing export
export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();

    sales.forEach(s => {
        const existing = clientsMap.get(s.client) || { 
            name: s.client, totalOrders: 0, totalSpent: 0, lastPurchaseDate: '1970-01-01', status: 'NEW', daysSinceLastPurchase: 0 
        };
        existing.totalOrders += 1;
        existing.totalSpent += s.valueSold * s.quantity;
        const sDate = s.date || s.completionDate || '1970-01-01';
        if (new Date(sDate) > new Date(existing.lastPurchaseDate)) {
            existing.lastPurchaseDate = sDate;
        }
        clientsMap.set(s.client, existing);
    });

    return Array.from(clientsMap.values()).map(c => {
        const lastDate = new Date(c.lastPurchaseDate);
        const diffDays = Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        c.daysSinceLastPurchase = diffDays;
        
        if (diffDays <= config.daysForNewClient) c.status = 'NEW';
        else if (diffDays <= config.daysForInactive) c.status = 'ACTIVE';
        else if (diffDays <= config.daysForLost) c.status = 'INACTIVE';
        else c.status = 'LOST';
        
        return c;
    });
};

// Fix: Implemented analyzeMonthlyVolume missing export
export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const now = new Date();
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const name = d.toLocaleDateString('pt-BR', { month: 'short' });
        const month = d.getMonth();
        const year = d.getFullYear();
        
        const filtered = sales.filter(s => {
            const sd = new Date(s.date || s.completionDate || '');
            return sd.getMonth() === month && sd.getFullYear() === year && !s.deleted;
        });
        
        data.push({
            name,
            basica: filtered.filter(s => s.type === ProductType.BASICA).length,
            natal: filtered.filter(s => s.type === ProductType.NATAL).length
        });
    }
    return data;
};

// Fix: Implemented exportReportToCSV missing export
export const exportReportToCSV = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${fileName}.csv`);
};

// Fix: Implemented calculateProductivityMetrics missing export
export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const sales = await getStoredSales();
    const reportConfig = await getReportConfig();
    const clients = analyzeClients(sales, reportConfig);
    
    const activeClients = clients.filter(c => c.status === 'ACTIVE' || c.status === 'NEW').length;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const convertedThisMonth = sales.filter(s => {
        const d = new Date(s.date || s.completionDate || '');
        return d >= firstDay && !s.deleted;
    }).length;
    
    const conversionRate = activeClients > 0 ? (convertedThisMonth / activeClients) * 100 : 0;
    
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (conversionRate >= 70) status = 'GREEN';
    else if (conversionRate >= 40) status = 'YELLOW';
    
    return {
        totalClients: clients.length,
        activeClients,
        convertedThisMonth,
        conversionRate,
        productivityStatus: status
    };
};

// Fix: Implemented calculateFinancialPacing missing export
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const nextSalaryDay = salaryDays.find(d => d > today) || salaryDays[0];
    
    let nextDate = new Date(now.getFullYear(), now.getMonth(), nextSalaryDay);
    if (nextSalaryDay <= today) {
        nextDate = new Date(now.getFullYear(), now.getMonth() + 1, nextSalaryDay);
    }

    const diffTime = nextDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const pendingExpenses = transactions
        .filter(t => !t.isPaid && t.type === 'EXPENSE')
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = (balance - pendingExpenses) / daysRemaining;

    return {
        daysRemaining,
        safeDailySpend,
        pendingExpenses,
        nextIncomeDate: nextDate
    };
};

// Fix: Implemented getInvoiceMonth missing export
export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
    const d = new Date(dateStr);
    const day = d.getDate();
    let month = d.getMonth();
    let year = d.getFullYear();

    if (day > closingDay) {
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
    }
    
    return `${year}-${String(month + 1).padStart(2, '0')}`;
};

// Fix: Implemented exportEncryptedBackup missing export
export const exportEncryptedBackup = async (passphrase: string) => {
    const allData: any = {};
    const stores = [
        'sales', 'accounts', 'transactions', 'clients', 'config', 'cards', 
        'categories', 'goals', 'challenges', 'challenge_cells', 'receivables'
    ];
    
    for (const store of stores) {
        allData[store] = await dbGetAll(store as any);
    }
    
    const json = JSON.stringify(allData);
    const encrypted = CryptoJS.AES.encrypt(json, passphrase).toString();
    
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestor360_${new Date().getTime()}.v360`;
    a.click();
};

// Fix: Implemented importEncryptedBackup missing export
export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const bytes = CryptoJS.AES.decrypt(text, passphrase);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    
    const batch = writeBatch(db);
    for (const store of Object.keys(decryptedData)) {
        const data = decryptedData[store];
        if (Array.isArray(data)) {
            await dbBulkPut(store as any, data);
            data.forEach(item => {
                batch.set(doc(db, store, item.id), sanitizeForFirestore(item), { merge: true });
            });
        }
    }
    await batch.commit();
};

// Fix: Implemented clearAllSales missing export
export const clearAllSales = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'sales'), where('userId', '==', uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    const dbInst = await initDB();
    await dbInst.clear('sales');
};

// Fix: Implemented generateChallengeCells missing export
export const generateChallengeCells = (challengeId: string, targetValue: number, depositCount: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    
    for (let i = 1; i <= depositCount; i++) {
        let value = 0;
        if (model === 'LINEAR') {
            const sum = (depositCount * (depositCount + 1)) / 2;
            const unit = targetValue / sum;
            value = i * unit;
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

// Fix: Implemented processFinanceImport missing export
export const processFinanceImport = (data: any[][], mapping: ImportMapping): Partial<Transaction>[] => {
    const results: Partial<Transaction>[] = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const tx: any = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            deleted: false,
            userId: auth.currentUser?.uid || ''
        };

        if (mapping.date !== -1 && row[mapping.date]) tx.date = String(row[mapping.date]);
        if (mapping.description !== -1 && row[mapping.description]) tx.description = String(row[mapping.description]);
        if (mapping.amount !== -1 && row[mapping.amount]) tx.amount = ensureNumber(row[mapping.amount]);
        
        if (tx.amount < 0) {
            tx.type = 'EXPENSE';
            tx.amount = Math.abs(tx.amount);
        } else {
            tx.type = 'INCOME';
        }
        
        results.push(tx);
    }
    return results;
};

// Fix: Implemented readExcelFile missing export
export const readExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            resolve(rows);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Fix: Implemented saveFinanceData missing export
export const saveFinanceData = async (accounts: FinanceAccount[], cards: CreditCard[], transactions: Transaction[], categories: TransactionCategory[]) => {
    const batch = writeBatch(db);
    
    for (const acc of accounts) {
        await dbPut('accounts', acc);
        batch.set(doc(db, 'accounts', acc.id), sanitizeForFirestore(acc), { merge: true });
    }
    for (const card of cards) {
        await dbPut('cards', card);
        batch.set(doc(db, 'cards', card.id), sanitizeForFirestore(card), { merge: true });
    }
    for (const tx of transactions) {
        await dbPut('transactions', tx);
        batch.set(doc(db, 'transactions', tx.id), sanitizeForFirestore(tx), { merge: true });
    }
    for (const cat of categories) {
        await dbPut('categories', cat);
        batch.set(doc(db, 'categories', cat.id), sanitizeForFirestore(cat), { merge: true });
    }
    
    await batch.commit();
    SessionTraffic.trackWrite(accounts.length + cards.length + transactions.length + categories.length);
};

// Fix: Implemented atomicClearUserTables missing export
export const atomicClearUserTables = async (userId: string, tables: string[]) => {
    const batch = writeBatch(db);
    for (const tableName of tables) {
        const q = query(collection(db, tableName), where('userId', '==', userId));
        const snap = await getDocs(q);
        snap.forEach(d => batch.delete(d.ref));
        
        const dbInst = await initDB();
        if (dbInst.objectStoreNames.contains(tableName as any)) {
            await dbInst.clear(tableName as any);
        }
    }
    await batch.commit();
};

// Fix: Implemented formatCurrency missing export
export const formatCurrency = (val: number, hidden = false): string => {
    if (hidden) return '••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Fix: Implemented downloadSalesTemplate missing export
export const downloadSalesTemplate = () => {
    const data = [
        ["Data Pedido", "Data Faturamento", "Tipo", "Cliente", "Quantidade", "Valor Unitário Proposto", "Valor Total Venda", "Margem (%)", "Observações"],
        ["2024-01-01", "2024-01-10", "Cesta Básica", "Empresa A", 10, 150.00, 1500.00, 15.0, "Exemplo"],
        ["2024-01-02", "", "Natal", "Cliente B", 5, 200.00, 1000.00, 12.5, "Pendente"]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_importacao_vendas.xlsx");
};

// Fix: Implemented findPotentialDuplicates missing export
export const findPotentialDuplicates = (sales: Sale[]) => {
    const clients = Array.from(new Set(sales.map(s => s.client)));
    const groups: { master: string, similar: string[] }[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < clients.length; i++) {
        const clientA = clients[i];
        if (processed.has(clientA)) continue;

        const similar: string[] = [];
        for (let j = i + 1; j < clients.length; j++) {
            const clientB = clients[j];
            if (processed.has(clientB)) continue;
            
            if (clientA.toLowerCase().includes(clientB.toLowerCase()) || clientB.toLowerCase().includes(clientA.toLowerCase())) {
                similar.push(clientB);
                processed.add(clientB);
            }
        }

        if (similar.length > 0) {
            groups.push({ master: clientA, similar });
            processed.add(clientA);
        }
    }
    return groups;
};

// Fix: Implemented smartMergeSales missing export
export const smartMergeSales = (duplicates: Sale[]): Sale => {
    const base = [...duplicates].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const observations = duplicates.map(d => d.observations).filter(Boolean).join(' | ');
    return { ...base, observations };
};
