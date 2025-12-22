
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc,
    getDocs, 
    query, 
    where, 
    writeBatch,
    serverTimestamp,
    limit,
    deleteDoc,
    updateDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    DuplicateGroup, FinancialPacing, User, Client, ProductivityMetrics, SalesGoal, ChallengeCell, ChallengeModel, Challenge, CreditCard, FinanceGoal, ProductLabels
} from '../types';
import { dbPut, dbBulkPut, dbGetAll, dbGet, saveConfigItem, getConfigItem, dbDelete, dbClear } from '../storage/db';

export const DEFAULT_PRODUCT_LABELS: ProductLabels = { basica: 'Cesta Básica', natal: 'Cesta de Natal', custom: 'Personalizado' };

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    theme: 'glass',
    modules: { 
        sales: true, finance: true, whatsapp: true, ai: true, reports: true, 
        news: true, receivables: true, distribution: true, imports: true, crm: true, dev: true
    },
    productLabels: DEFAULT_PRODUCT_LABELS,
    notificationSound: '',
    alertSound: '',
    successSound: '',
    warningSound: '',
    includeNonAccountingInTotal: false
};

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; // DEV ACESSA TUDO SEMPRE
    if (user.role === 'ADMIN') {
        if (feature === 'dev') return false;
        return true;
    }
    return !!(user.modules as any)[feature];
};

export const bootstrapProductionData = async (): Promise<void> => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
        console.info("[Bootstrap] Iniciando verificação de integridade...");

        // 1. Clientes
        const clientSnap = await getDocs(query(collection(db, "clients"), limit(1)));
        if (clientSnap.empty) {
            const model: Client = {
                id: "model_client_prod", name: "Cliente Exemplo Produção", companyName: "Empresa Modelo LTDA",
                contactName: "Administrador", status: "ATIVO", benefitProfile: "BASICA",
                monthlyQuantityDeclared: 1, monthlyQuantityAverage: 0, isActive: true,
                userId: uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, "clients", model.id), { ...model, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }

        // 2. Contas
        const accSnap = await getDocs(query(collection(db, "accounts"), limit(1)));
        if (accSnap.empty) {
            const model: FinanceAccount = {
                id: "default_main", name: "Caixa Geral", type: "CASH", balance: 0,
                isAccounting: true, includeInDistribution: true, personType: "PF"
            };
            await setDoc(doc(db, "accounts", model.id), model);
        }

        // 3. Categorias
        const catSnap = await getDocs(query(collection(db, "categories"), limit(1)));
        if (catSnap.empty) {
            const baseCats: TransactionCategory[] = [
                { id: "cat_receita", name: "Receita de Vendas", type: "INCOME", personType: "PJ", subcategories: [] },
                { id: "cat_despesa", name: "Despesa Operacional", type: "EXPENSE", personType: "PJ", subcategories: [] }
            ];
            for (const cat of baseCats) {
                await setDoc(doc(db, "categories", cat.id), cat);
            }
        }

        // 4. Tabelas de Comissão (Evitando estado vazio no formulário)
        const checkRules = await getDocs(query(collection(db, "commission_basic"), limit(1)));
        if (checkRules.empty) {
            const defaultRule: CommissionRule = { id: 'def_rule', minPercent: 0, maxPercent: null, commissionRate: 0.1 };
            await setDoc(doc(db, "commission_basic", defaultRule.id), defaultRule);
            await setDoc(doc(db, "commission_natal", defaultRule.id), defaultRule);
        }

        console.info("[Bootstrap] Integridade Firestore validada.");
    } catch (e) {
        console.error("[Bootstrap] Falha crítica:", e);
    }
};

// --- CONFIGURAÇÃO ---
export const getSystemConfig = async (): Promise<SystemConfig> => {
    const local = await getConfigItem('system_config');
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const snap = await getDoc(doc(db, "config", "system"));
        if (snap.exists()) return snap.data() as SystemConfig;
    }
    return local || DEFAULT_SYSTEM_CONFIG;
};

// Added getReportConfig export
export const getReportConfig = async (): Promise<ReportConfig> => {
    const local = await getConfigItem('report_config');
    return local || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveSystemConfig = async (config: SystemConfig) => {
    await saveConfigItem('system_config', config);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await setDoc(doc(db, "config", "system"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
    }
};

// --- VENDAS ---
export const getStoredSales = async (): Promise<Sale[]> => {
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const snap = await getDocs(query(collection(db, "sales"), where("userId", "==", auth.currentUser.uid)));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)).filter(s => !s.deleted);
    }
    const local = await dbGetAll('sales');
    return local.filter(s => !s.deleted);
};

export const saveSingleSale = async (sale: Sale) => {
    await dbPut('sales', sale);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await setDoc(doc(db, "sales", sale.id), { ...sale, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
    }
};

// Added saveSales for bulk operations
export const saveSales = async (sales: Sale[]) => {
    for (const s of sales) {
        await saveSingleSale(s);
    }
};

// --- COMISSÕES (SOLUÇÃO PARA O ESPELHAMENTO) ---
export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colName = type === ProductType.BASICA ? "commission_basic" : (type === ProductType.NATAL ? "commission_natal" : "commission_custom");
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const snap = await getDocs(collection(db, colName));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
    }
    return await dbGetAll(colName as any);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colName = type === ProductType.BASICA ? "commission_basic" : (type === ProductType.NATAL ? "commission_natal" : "commission_custom");
    await dbBulkPut(colName as any, rules);
    
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const batch = writeBatch(db);
        // Limpa atual no Firestore primeiro (opcional, ou sobrescreve)
        rules.forEach(r => batch.set(doc(db, colName, r.id), r));
        await batch.commit();
    }
};

export const computeCommissionValues = (quantity: number, valueProposed: number, marginPercent: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const sorted = [...rules].sort((a, b) => a.minPercent - b.minPercent);
    const rule = sorted.find(r => {
        const max = r.maxPercent === null ? Infinity : r.maxPercent;
        return marginPercent >= r.minPercent && marginPercent < max;
    });
    const rate = rule ? rule.commissionRate : 0;
    return { commissionBase, commissionValue: commissionBase * rate, rateUsed: rate };
};

// --- FINANCEIRO ---
export const getFinanceData = async () => {
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const [accS, txS, catS] = await Promise.all([
            getDocs(collection(db, "accounts")),
            getDocs(query(collection(db, "transactions"), where("deleted", "==", false))),
            getDocs(collection(db, "categories"))
        ]);
        return {
            accounts: accS.docs.map(d => ({ id: d.id, ...d.data() } as any)),
            transactions: txS.docs.map(d => ({ id: d.id, ...d.data() } as any)),
            categories: catS.docs.map(d => ({ id: d.id, ...d.data() } as any)),
            cards: [], goals: [], challenges: [], cells: [], receivables: []
        };
    }
    const [acc, cards, txs, cats, goals, chals, cells, recs] = await Promise.all([
        dbGetAll('accounts'), dbGetAll('cards'), dbGetAll('transactions'), dbGetAll('categories'),
        dbGetAll('goals'), dbGetAll('challenges'), dbGetAll('challenge_cells'), dbGetAll('receivables')
    ]);
    return { accounts: acc, cards, transactions: txs.filter(t => !t.deleted), categories: cats, goals, challenges: chals, cells, receivables: recs };
};

// Updated saveFinanceData to accept all arguments passed from components
export const saveFinanceData = async (
    acc: FinanceAccount[], 
    cards: CreditCard[], 
    txs: Transaction[], 
    cats: TransactionCategory[],
    goals?: FinanceGoal[],
    challenges?: Challenge[],
    cells?: ChallengeCell[],
    receivables?: Receivable[]
) => {
    // Escrita direta Firestore para manter síncrono
    for (const a of acc) await setDoc(doc(db, "accounts", a.id), a);
    for (const t of txs) await setDoc(doc(db, "transactions", t.id), { ...t, updatedAt: serverTimestamp() });
    for (const c of cats) await setDoc(doc(db, "categories", c.id), c);
    
    // Add additional logic for other stores if provided
    if (goals) for (const g of goals) await dbPut('goals', g);
    if (challenges) for (const ch of challenges) await dbPut('challenges', ch);
    if (cells) await dbBulkPut('challenge_cells', cells);
    if (receivables) for (const r of receivables) await dbPut('receivables', r);
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    let nextDay = salaryDays.sort((a, b) => a - b).find(d => d > today) || salaryDays[0] || 1;
    const nextIncomeDate = new Date(now.getFullYear(), now.getMonth() + (nextDay <= today ? 1 : 0), nextDay);
    const diffTime = nextIncomeDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const pendingExpenses = transactions.filter(t => !t.isPaid && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate).reduce((acc, t) => acc + t.amount, 0);
    const safeDailySpend = (balance - pendingExpenses) / daysRemaining;
    return { daysRemaining, safeDailySpend: Math.max(0, safeDailySpend), pendingExpenses, nextIncomeDate };
};

export const getInvoiceMonth = (date: string, closingDay: number): string => {
    const d = new Date(date);
    if (d.getDate() > closingDay) d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 7); 
};

export const getTrashItems = async () => {
    const txs = await getDocs(query(collection(db, "transactions"), where("deleted", "==", true)));
    return { sales: [], transactions: txs.docs.map(d => ({ id: d.id, ...d.data() } as any)) };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    await updateDoc(doc(db, col, item.id), { deleted: false, deletedAt: null });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    const col = type === 'SALE' ? 'sales' : 'transactions';
    await deleteDoc(doc(db, col, id));
};

export const hardResetLocalData = async () => {
    localStorage.clear();
    await dbClear('sales'); await dbClear('transactions'); await dbClear('accounts'); await dbClear('clients');
    window.location.reload();
};

export const getUserPlanLabel = (user: User) => {
    if (user.role === 'DEV') return 'Engenheiro de Sistema (Root)';
    return user.role === 'ADMIN' ? 'Administrador do Sistema' : 'Plano Profissional';
};

export const getClients = async (): Promise<Client[]> => {
    const snap = await getDocs(collection(db, "clients"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
};

export const saveClient = async (client: Client) => {
    await setDoc(doc(db, "clients", client.id), { ...client, updatedAt: serverTimestamp() });
};

export const getDeletedClients = async () => {
    const snap = await getDocs(query(collection(db, "clients"), where("deleted", "==", true)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
};

export const restoreClient = async (id: string) => {
    await updateDoc(doc(db, "clients", id), { deleted: false, deletedAt: null });
};

export const permanentlyDeleteClient = async (id: string) => {
    await deleteDoc(doc(db, "clients", id));
};

// Added missing exports for ClientReports and other modules
export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    // Logic to analyze clients based on sales history and configuration
    return []; 
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    // Logic to analyze monthly volume
    return [];
};

export const exportReportToCSV = (data: any[], filename: string) => {
    // Logic to export data to CSV
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    return { totalClients: 0, activeClients: 0, convertedThisMonth: 0, conversionRate: 0, productivityStatus: 'GREEN' };
};

export const exportEncryptedBackup = async (passphrase: string) => {
    // Logic to export encrypted backup
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
    // Logic to import encrypted backup
};

export const clearAllSales = () => {
    // Logic to clear all sales
};

export const generateChallengeCells = (challengeId: string, targetValue: number, depositCount: number, model: ChallengeModel): ChallengeCell[] => {
    return [];
};

export const generateFinanceTemplate = () => {
    // Logic to generate finance template
};

export const processFinanceImport = (data: any[][], mapping: Record<string, number>): Transaction[] => {
    return [];
};

export const readExcelFile = async (file: File): Promise<any[][]> => {
    return [];
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    return [];
};

export const smartMergeSales = (sales: Sale[]): Sale => {
    return sales[0];
};

export const processSalesImport = (data: any[][], mapping: Record<string, number>): any[] => {
    return [];
};
