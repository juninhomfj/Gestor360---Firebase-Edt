
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

// Added DEFAULT_REPORT_CONFIG as a fallback for getReportConfig
export const DEFAULT_REPORT_CONFIG: ReportConfig = {
    daysForNewClient: 30,
    daysForInactive: 60,
    daysForLost: 180
};

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; // BYPASS TOTAL PARA DEV
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
        console.info("[Bootstrap] Verificando integridade organizacional...");

        // 1. Clientes
        const clientSnap = await getDocs(query(collection(db, "clients"), limit(1)));
        if (clientSnap.empty) {
            const model: Client = {
                id: "model_client_prod", name: "Cliente Exemplo Produção", companyName: "Empresa Modelo LTDA",
                contactName: "Administrador", status: "ATIVO", benefitProfile: "AMBOS",
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

        // 4. Tabelas de Comissão Isoladas
        const checkRules = await getDocs(query(collection(db, "commission_basic"), limit(1)));
        if (checkRules.empty) {
            const defaultRule: CommissionRule = { id: 'def_rule', minPercent: 0, maxPercent: null, commissionRate: 0.1 };
            await setDoc(doc(db, "commission_basic", defaultRule.id), defaultRule);
            await setDoc(doc(db, "commission_natal", defaultRule.id), defaultRule);
        }

        console.info("[Bootstrap] Integridade Firestore validada.");
    } catch (e) {
        console.error("[Bootstrap] Erro de Permissão ou Rede:", e);
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

export const saveSystemConfig = async (config: SystemConfig) => {
    await saveConfigItem('system_config', config);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await setDoc(doc(db, "config", "system"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
    }
};

// Added missing getReportConfig function to fix the import error in App.tsx
export const getReportConfig = async (): Promise<ReportConfig> => {
    const local = await getConfigItem('report_config');
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const snap = await getDoc(doc(db, "config", "reports"));
        if (snap.exists()) return snap.data() as ReportConfig;
    }
    return local || DEFAULT_REPORT_CONFIG;
};

// Added saveReportConfig to handle persistence of report settings
export const saveReportConfig = async (config: ReportConfig) => {
    await saveConfigItem('report_config', config);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await setDoc(doc(db, "config", "reports"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
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

export const saveSales = async (sales: Sale[]) => {
    for (const s of sales) {
        await saveSingleSale(s);
    }
};

// --- COMISSÕES (SOLUÇÃO PARA O BUG DE ESPELHAMENTO) ---
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
        // Garante isolamento total gravando apenas na coleção solicitada
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
    for (const a of acc) await setDoc(doc(db, "accounts", a.id), a);
    for (const t of txs) await setDoc(doc(db, "transactions", t.id), { ...t, updatedAt: serverTimestamp() });
    for (const c of cats) await setDoc(doc(db, "categories", c.id), c);
    
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
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)).filter(c => !c.deleted);
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

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    sales.forEach(s => {
        const client = s.client;
        const current = clientsMap.get(client) || { name: client, totalOrders: 0, totalSpent: 0, lastPurchaseDate: '1970-01-01', status: 'ACTIVE' };
        current.totalOrders++;
        current.totalSpent += s.valueSold * s.quantity;
        if (s.date && s.date > current.lastPurchaseDate) current.lastPurchaseDate = s.date;
        clientsMap.set(client, current);
    });
    return Array.from(clientsMap.values());
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    return [];
};

export const exportReportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    return { totalClients: 0, activeClients: 0, convertedThisMonth: 0, conversionRate: 0, productivityStatus: 'GREEN' };
};

export const exportEncryptedBackup = async (passphrase: string) => {
    const data = await getFinanceData();
    const sales = await getStoredSales();
    const blob = new Blob([JSON.stringify({ data, sales })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'backup_v360.json'; a.click();
};

export const importEncryptedBackup = async (file: File, passphrase: string) => {
};

export const clearAllSales = () => {
};

export const generateChallengeCells = (challengeId: string, targetValue: number, depositCount: number, model: ChallengeModel): ChallengeCell[] => {
    return [];
};

export const generateFinanceTemplate = () => {
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
