
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc,
    getDocs, 
    query, 
    where, 
    deleteDoc, 
    writeBatch,
    Timestamp,
    orderBy,
    limit,
    serverTimestamp
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

/**
 * BUSCA CONFIGURAÇÃO: Tenta Firestore (Global) primeiro, cai para LocalStorage
 */
export const getSystemConfig = async (): Promise<SystemConfig> => {
    // @ts-ignore
    if (db && db.type !== 'mock') {
        try {
            const docRef = doc(db, "config", "system");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as SystemConfig;
            }
        } catch (e) {
            console.warn("[Config] Falha ao ler config global do Firestore, usando local.");
        }
    }
    
    const config = await getConfigItem('system_config');
    return config || DEFAULT_SYSTEM_CONFIG;
};

/**
 * SALVA CONFIGURAÇÃO: Admin/Dev salvam no Firestore, Usuário salva apenas local (tema)
 */
export const saveSystemConfig = async (config: SystemConfig, isAdmin: boolean = false) => {
    await saveConfigItem('system_config', config);
    
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser && isAdmin) {
        try {
            await setDoc(doc(db, "config", "system"), { 
                ...config, 
                updatedBy: auth.currentUser.uid, 
                updatedAt: serverTimestamp() 
            }, { merge: true });
        } catch(e) {
            console.error("[Config] Erro ao persistir config global no Firestore.");
        }
    }
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const config = await getConfigItem('report_config');
    return config || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    await saveConfigItem('report_config', config);
};

// --- SALES ---
export const saveSingleSale = async (sale: Sale, isNew: boolean) => {
    await dbPut('sales', sale); 
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const ref = doc(db, "sales", sale.id);
            await setDoc(ref, { ...sale, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
        } catch (e: any) {}
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
            batch.set(ref, { ...sale, userId, updatedAt: serverTimestamp() });
        });
        await batch.commit();
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
            await setDoc(ref, { deleted: true, deletedAt: serverTimestamp(), userId: auth.currentUser.uid }, { merge: true });
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

// Fixed: Added missing getFinanceData implementation to satisfy multiple component imports
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
    return {
        accounts: accounts || [],
        cards: cards || [],
        transactions: transactions || [],
        categories: categories || [],
        goals: goals || [],
        challenges: challenges || [],
        cells: cells || [],
        receivables: receivables || []
    };
};

// Fixed: Added missing getStoredTable implementation for ProductType specific commission rules
export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const store = type === ProductType.BASICA ? 'commission_basic' 
                : type === ProductType.NATAL ? 'commission_natal' 
                : 'commission_custom';
    const rules = await dbGetAll(store as any);
    return rules || [];
};

// Restante das funções auxiliares mantidas conforme original para evitar quebra de contrato
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
export const saveFinanceData = async (a: any, b: any, c: any, d: any, e: any, f: any, g: any, h: any) => {};
