
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    query, 
    where, 
    deleteDoc, 
    writeBatch,
    Timestamp,
    orderBy,
    limit
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { 
    Sale, Transaction, FinanceAccount, CreditCard, TransactionCategory, 
    FinanceGoal, Challenge, ChallengeCell, Receivable, ReportConfig, 
    SystemConfig, ProductLabels, ProductType, CommissionRule, ChallengeModel 
} from '../types';
import { dbPut, dbBulkPut, dbGetAll, saveConfigItem, getConfigItem } from '../storage/db';

export const DEFAULT_PRODUCT_LABELS: ProductLabels = {
    basica: 'Cesta Básica',
    natal: 'Cesta de Natal',
    custom: 'Personalizado'
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    theme: 'glass',
    modules: { 
        sales: true, 
        finance: true, 
        whatsapp: true, 
        ai: true, 
        reports: true, 
        news: true,
        receivables: true,
        distribution: true,
        imports: true,
        crm: true,
        dev: false
    },
    productLabels: DEFAULT_PRODUCT_LABELS
};

const dbLog = (op: string, entity: string, success: boolean, detail?: string) => {
    console.log(`[Firestore][${op}][${entity}] ${success ? 'SUCESSO' : 'ERRO'} | ${detail || ''}`);
};

// --- SALES ---
export const saveSingleSale = async (sale: Sale, isNew: boolean) => {
    await dbPut('sales', sale); 
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const ref = doc(db, "sales", sale.id);
            await setDoc(ref, { ...sale, userId: auth.currentUser.uid, updatedAt: Timestamp.now() });
            dbLog(isNew ? 'CREATE' : 'UPDATE', 'sales', true, sale.id);
        } catch (e: any) {
            dbLog('WRITE_CLOUD', 'sales', false, e.message);
        }
    }
};

export const saveSales = async (sales: Sale[]) => {
    await dbBulkPut('sales', sales);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const userId = auth.currentUser.uid;
        const batch = writeBatch(db);
        sales.forEach(sale => {
            const ref = doc(db, "sales", sale.id);
            batch.set(ref, { ...sale, userId, updatedAt: Timestamp.now() });
        });
        try {
            await batch.commit();
        } catch (e: any) {
            dbLog('BATCH_CLOUD', 'sales', false, e.message);
        }
    }
};

export const deleteSingleSale = async (id: string) => {
    const sales = await dbGetAll('sales');
    const updated = sales.map(s => s.id === id ? { ...s, deleted: true, deletedAt: new Date().toISOString() } : s);
    await dbBulkPut('sales', updated);

    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const ref = doc(db, "sales", id);
            await setDoc(ref, { deleted: true, deletedAt: Timestamp.now(), userId: auth.currentUser.uid }, { merge: true });
        } catch (e: any) {}
    }
};

export const getStoredSales = async (): Promise<Sale[]> => {
    const localSales = await dbGetAll('sales');
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const q = query(collection(db, "sales"), where("userId", "==", auth.currentUser.uid));
            const snap = await getDocs(q);
            const remoteSales = snap.docs.map(d => d.data() as Sale).filter(s => !s.deleted);
            if (remoteSales.length > 0) {
                await dbBulkPut('sales', remoteSales);
                return remoteSales;
            }
        } catch (e) {}
    }
    return localSales.filter(s => !s.deleted);
};

// --- FINANCE ---
export const saveFinanceData = async (
    accounts: FinanceAccount[], 
    cards: CreditCard[], 
    transactions: Transaction[], 
    categories: TransactionCategory[], 
    goals: FinanceGoal[], 
    challenges: Challenge[], 
    cells: ChallengeCell[], 
    receivables: Receivable[]
) => {
    await Promise.all([
        dbBulkPut('accounts', accounts),
        dbBulkPut('cards', cards),
        dbBulkPut('transactions', transactions),
        dbBulkPut('categories', categories),
        dbBulkPut('goals', goals),
        dbBulkPut('receivables', receivables)
    ]);

    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const userId = auth.currentUser.uid;
        const batch = writeBatch(db);
        const addToBatch = (items: any[], col: string) => {
            items.forEach(item => {
                batch.set(doc(db, col, item.id), { ...item, userId, updatedAt: Timestamp.now() });
            });
        };
        try {
            addToBatch(accounts, "finance_accounts");
            addToBatch(cards, "credit_cards");
            addToBatch(transactions.slice(0, 100), "transactions"); 
            addToBatch(categories, "transaction_categories");
            addToBatch(goals, "finance_goals");
            addToBatch(receivables, "receivables");
            await batch.commit();
        } catch (e: any) {}
    }
};

export const getFinanceData = async () => {
    const local = {
        accounts: await dbGetAll('accounts'),
        cards: await dbGetAll('cards'),
        transactions: await dbGetAll('transactions'),
        categories: await dbGetAll('categories'),
        goals: await dbGetAll('goals'),
        challenges: await dbGetAll('challenges'),
        cells: await dbGetAll('challenge_cells'),
        receivables: await dbGetAll('receivables')
    };

    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const userId = auth.currentUser.uid;
            const [accSnap, txSnap] = await Promise.all([
                getDocs(query(collection(db, "finance_accounts"), where("userId", "==", userId))),
                getDocs(query(collection(db, "transactions"), where("userId", "==", userId), limit(200)))
            ]);
            const remoteAcc = accSnap.docs.map(d => d.data() as FinanceAccount);
            const remoteTx = txSnap.docs.map(d => d.data() as Transaction);
            if (remoteAcc.length > 0) await dbBulkPut('accounts', remoteAcc);
            if (remoteTx.length > 0) await dbBulkPut('transactions', remoteTx);
            return { ...local, accounts: remoteAcc.length > 0 ? remoteAcc : local.accounts, transactions: remoteTx.length > 0 ? remoteTx : local.transactions };
        } catch (e) {}
    }
    return local;
};

// --- CONFIG & TABLES ---
export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const store = type === ProductType.BASICA ? 'commission_basic' : (type === ProductType.NATAL ? 'commission_natal' : 'commission_custom');
    const local = await dbGetAll(store as any);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const snap = await getDocs(collection(db, store));
            const remote = snap.docs.map(d => d.data() as CommissionRule);
            if (remote.length > 0) {
                await dbBulkPut(store as any, remote);
                return remote;
            }
        } catch (e) {}
    }
    return local;
};

export const saveTable = async (type: ProductType, rules: CommissionRule[]) => {
    const store = type === ProductType.BASICA ? 'commission_basic' : (type === ProductType.NATAL ? 'commission_natal' : 'commission_custom');
    await dbBulkPut(store as any, rules);
    // @ts-ignore
    if (db && db.type !== 'mock') {
        try {
            const batch = writeBatch(db);
            rules.forEach(rule => batch.set(doc(db, store, rule.id), rule));
            await batch.commit();
        } catch (e) {}
    }
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
    const config = await getConfigItem('system_config');
    return config || DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
    await saveConfigItem('system_config', config);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            await setDoc(doc(db, "config", "system"), { ...config, userId: auth.currentUser.uid, updatedAt: Timestamp.now() });
        } catch(e) {}
    }
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const config = await getConfigItem('report_config');
    return config || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    await saveConfigItem('report_config', config);
};

// --- HELPERS ---
export const calculateMargin = (sold: number, proposed: number): number => {
    if (proposed <= 0.01) return 0; 
    return ((sold - proposed) / proposed) * 100;
};

export const computeCommissionValues = (quantity: number, valueProposed: number, marginPercent: number, rules: any[]) => {
    const commissionBase = quantity * valueProposed;
    const rate = findCommissionRate(marginPercent, rules);
    const safeRate = rate > 1 ? rate / 100 : rate;
    return { commissionBase, commissionValue: commissionBase * safeRate, rateUsed: safeRate };
};

const findCommissionRate = (margin: number, rules: any[]): number => {
    if (!rules || rules.length === 0) return 0;
    const normalizedMargin = parseFloat(margin.toFixed(2));
    const rule = rules.find(r => {
        const min = Number(r.minPercent);
        let max = r.maxPercent === null ? Infinity : Number(r.maxPercent);
        return normalizedMargin >= min && normalizedMargin <= max;
    });
    return rule ? Number(rule.commissionRate) : 0;
};

export const getInvoiceMonth = (date: string, closingDay: number): string => {
    const d = new Date(date);
    const day = d.getDate();
    if (day > closingDay) d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 7); 
};

export const hardResetLocalData = async () => {
    localStorage.clear();
    sessionStorage.clear();
    const { closeDBConnection } = await import('../storage/db');
    await closeDBConnection();
    window.location.reload();
};

export const addMonths = (date: Date | string, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

export const ensureClient = async (name: string) => {
    const id = crypto.randomUUID();
    const client = { id, name, userId: auth.currentUser?.uid || 'local', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deleted: false };
    await dbPut('clients', client);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try { await setDoc(doc(db, "clients", id), client); } catch(e) {}
    }
};

export const searchClients = async (term: string) => {
    const all = await dbGetAll('clients');
    return all.filter(c => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 5);
};

export const findPotentialDuplicates = (sales: Sale[]) => [];
export const takeSnapshot = (sales: Sale[]) => {};
export const analyzeClients = (sales: Sale[], config: ReportConfig) => [];
export const analyzeMonthlyVolume = (sales: Sale[], months: number) => [];
export const calculateFinancialPacing = (balance: number, days: number[], transactions: Transaction[]) => ({ daysRemaining: 0, safeDailySpend: 0, pendingExpenses: 0, nextIncomeDate: new Date() });
export const exportReportToCSV = (data: any[], filename: string) => {};
export const readExcelFile = async (file: File) => [[]];
export const generateFinanceTemplate = () => {};
export const processSalesImport = (data: any[][], mapping: any) => [];
export const processFinanceImport = (data: any[][], mapping: any) => [];
export const getTrashItems = async () => ({ sales: [], transactions: [] });
export const restoreItem = async (type: string, item: any) => {};
export const permanentlyDeleteItem = async (type: string, id: string) => {};
export const getDeletedClients = async () => [];
export const restoreClient = async (id: string) => {};
export const permanentlyDeleteClient = async (id: string) => {};
export const canAccess = (user: any, mod: string) => true;
export const getUserPlanLabel = (user: any) => 'Plano 360';
export const exportEncryptedBackup = async (pass: string) => {};
export const importEncryptedBackup = async (f: File, p: string) => {};
export const clearAllSales = () => {};
export const auditDataDuplicates = (s: Sale[], t: Transaction[]) => ({ salesGroups: [], transactionGroups: [] });
export const generateChallengeCells = (id: string, t: number, c: number, m: ChallengeModel) => [];
export const smartMergeSales = (s: Sale[]) => s[0];
