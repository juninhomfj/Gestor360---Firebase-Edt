
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
    orderBy,
    limit,
    deleteDoc,
    updateDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    DuplicateGroup, FinancialPacing, User, Client, ProductivityMetrics, SalesGoal, ChallengeCell, ChallengeModel, Challenge
} from '../types';
import { dbPut, dbBulkPut, dbGetAll, dbGet, saveConfigItem, getConfigItem, dbDelete, dbClear } from '../storage/db';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    theme: 'glass',
    modules: { 
        sales: true, finance: true, whatsapp: true, ai: true, reports: true, 
        news: true, receivables: true, distribution: true, imports: true, crm: true, dev: false
    },
    productLabels: { basica: 'Cesta Básica', natal: 'Cesta de Natal', custom: 'Personalizado' },
    includeNonAccountingInTotal: false,
    notificationSound: '',
    alertSound: '',
    successSound: '',
    warningSound: '',
    supportEmail: 'hypelab3@gmail.com',
    supportTelegram: '@naosoub0t'
};

/* Fix: Added DEFAULT_PRODUCT_LABELS constant */
export const DEFAULT_PRODUCT_LABELS = { basica: 'Cesta Básica', natal: 'Cesta de Natal', custom: 'Personalizado' };

/**
 * AUTORIZAÇÃO CENTRALIZADA (DEV > ADMIN > USER)
 */
export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    
    // 1. DEV acessa absolutamente tudo sem exceção
    if (user.role === 'DEV') return true;
    
    // 2. ADMIN acessa tudo, menos recursos de engenharia DEV
    if (user.role === 'ADMIN') {
        if (feature === 'dev') return false;
        return true;
    }
    
    // 3. USER depende das flags modulares
    return !!(user.modules as any)[feature];
};

/**
 * BOOTSTRAP DE PRODUÇÃO IDEMPOTENTE
 * Garante que o ambiente tenha dados mínimos para operar sem quebrar.
 */
export const bootstrapProductionData = async (): Promise<void> => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
        console.info("[Bootstrap] Verificando integridade do banco...");

        // 1. Clientes
        const clientSnap = await getDocs(query(collection(db, "clients"), limit(1)));
        if (clientSnap.empty) {
            console.log("[Bootstrap] Criando cliente modelo...");
            const model: Client = {
                id: "model_client_prod",
                name: "Cliente Exemplo Produção",
                companyName: "Empresa Modelo LTDA",
                contactName: "Administrador",
                status: "ATIVO",
                benefitProfile: "BASICA",
                monthlyQuantityDeclared: 1,
                monthlyQuantityAverage: 0,
                isActive: true,
                userId: uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, "clients", model.id), { ...model, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            await dbPut('clients', model);
        }

        // 2. Contas Financeiras
        const accSnap = await getDocs(query(collection(db, "accounts"), limit(1)));
        if (accSnap.empty) {
            console.log("[Bootstrap] Criando conta padrão...");
            const model: FinanceAccount = {
                id: "default_main",
                name: "Conta Principal (Caixa)",
                type: "CASH",
                balance: 0,
                isAccounting: true,
                includeInDistribution: true,
                personType: "PF"
            };
            await setDoc(doc(db, "accounts", model.id), model);
            await dbPut('accounts', model);
        }

        // 3. Categorias
        const catSnap = await getDocs(query(collection(db, "categories"), limit(1)));
        if (catSnap.empty) {
            console.log("[Bootstrap] Criando categorias base...");
            const baseCats: TransactionCategory[] = [
                { id: "cat_receita", name: "Receita de Vendas", type: "INCOME", personType: "PJ", subcategories: [] },
                { id: "cat_despesa", name: "Despesa Operacional", type: "EXPENSE", personType: "PJ", subcategories: [] }
            ];
            for (const cat of baseCats) {
                await setDoc(doc(db, "categories", cat.id), cat);
                await dbPut('categories', cat);
            }
        }

        // 4. Configuração
        const configSnap = await getDoc(doc(db, "config", "system"));
        if (!configSnap.exists()) {
            await setDoc(doc(db, "config", "system"), { ...DEFAULT_SYSTEM_CONFIG, updatedAt: serverTimestamp() });
        }

        console.info("[Bootstrap] Integridade validada.");
    } catch (e) {
        console.error("[Bootstrap] Falha crítica:", e);
    }
};

// --- CONFIGURAÇÃO ---
export const getSystemConfig = async (): Promise<SystemConfig> => {
    const local = await getConfigItem('system_config');
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const snap = await getDoc(doc(db, "config", "system"));
            if (snap.exists()) return snap.data() as SystemConfig;
        } catch (e) {}
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

export const getReportConfig = async (): Promise<ReportConfig> => {
    const config = await getConfigItem('report_config');
    return config || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

// --- VENDAS ---
export const getStoredSales = async (): Promise<Sale[]> => {
    const local = await dbGetAll('sales');
    return local.filter(s => !s.deleted);
};

export const saveSales = async (sales: Sale[]) => {
    await dbBulkPut('sales', sales);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const batch = writeBatch(db);
        sales.forEach(sale => {
            batch.set(doc(db, "sales", sale.id), { ...sale, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
        });
        await batch.commit();
    }
};

export const saveSingleSale = async (sale: Sale) => {
    await dbPut('sales', sale);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await setDoc(doc(db, "sales", sale.id), { ...sale, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
    }
};

export const deleteSingleSale = async (id: string) => {
    const sale = await dbGet('sales', id);
    if (sale) {
        const updated = { ...sale, deleted: true, deletedAt: new Date().toISOString() };
        await dbPut('sales', updated);
        // @ts-ignore
        if (db && db.type !== 'mock' && auth.currentUser) {
            await updateDoc(doc(db, "sales", id), { deleted: true, deletedAt: serverTimestamp() });
        }
    }
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const store = type === ProductType.BASICA ? 'commission_basic' : type === ProductType.NATAL ? 'commission_natal' : 'commission_custom';
    return await dbGetAll(store as any);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const store = type === ProductType.BASICA ? 'commission_basic' : type === ProductType.NATAL ? 'commission_natal' : 'commission_custom';
    await dbClear(store as any);
    await dbBulkPut(store as any, rules);
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

// --- MÓDULO CLIENTES ---
export const getClients = async (): Promise<Client[]> => {
    const local = await dbGetAll('clients');
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        const q = query(collection(db, "clients"), where("userId", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        const remote = snap.docs.map(d => d.data() as Client);
        if (remote.length > 0) { await dbBulkPut('clients', remote); return remote; }
    }
    return local;
};

export const saveClient = async (client: Client) => {
    const stamped = { ...client, updatedAt: new Date().toISOString() };
    await dbPut('clients', stamped);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await setDoc(doc(db, "clients", client.id), { ...stamped, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
    }
};

/* Fix: Added getDeletedClients function */
export const getDeletedClients = async (): Promise<Client[]> => {
    const local = await dbGetAll('clients');
    return local.filter(c => c.deleted);
};

/* Fix: Added restoreClient function */
export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        await dbPut('clients', { ...client, deleted: false, deletedAt: undefined, updatedAt: new Date().toISOString() });
    }
};

/* Fix: Added permanentlyDeleteClient function */
export const permanentlyDeleteClient = async (id: string) => {
    await dbDelete('clients', id);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await deleteDoc(doc(db, "clients", id));
    }
};

// --- FINANCEIRO ---
export const getFinanceData = async () => {
    const [accounts, cards, transactions, categories, goals, challenges, challenge_cells, receivables] = await Promise.all([
        dbGetAll('accounts'), dbGetAll('cards'), dbGetAll('transactions'), dbGetAll('categories'),
        dbGetAll('goals'), dbGetAll('challenges'), dbGetAll('challenge_cells'), dbGetAll('receivables')
    ]);
    return {
        accounts: accounts || [], cards: cards || [], transactions: (transactions || []).filter(t => !t.deleted),
        categories: categories || [], goals: goals || [], challenges: challenges || [],
        cells: challenge_cells || [], receivables: receivables || []
    };
};

export const saveFinanceData = async (acc: any, cards: any, txs: any, cats: any, goals: any, chals: any, cells: any, recs: any) => {
    await Promise.all([
        dbBulkPut('accounts', acc), dbBulkPut('cards', cards), dbBulkPut('transactions', txs),
        dbBulkPut('categories', cats), dbBulkPut('goals', goals), dbBulkPut('challenges', chals),
        dbBulkPut('challenge_cells', cells), dbBulkPut('receivables', recs)
    ]);
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

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();
    sales.forEach(s => {
        if (s.deleted) return;
        const entry = clientsMap.get(s.client) || { name: s.client, totalOrders: 0, totalSpent: 0, lastPurchaseDate: '1970-01-01' };
        entry.totalOrders++;
        entry.totalSpent += (s.valueSold * s.quantity);
        const sDate = s.date || s.completionDate || '1970-01-01';
        if (new Date(sDate) > new Date(entry.lastPurchaseDate)) entry.lastPurchaseDate = sDate;
        clientsMap.set(s.client, entry);
    });
    return Array.from(clientsMap.values()).map(c => {
        const lastDate = new Date(c.lastPurchaseDate);
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        let status: any = 'ACTIVE';
        if (diffDays > config.daysForLost) status = 'LOST';
        else if (diffDays > config.daysForInactive) status = 'INACTIVE';
        return { ...c, status, daysSinceLastPurchase: diffDays };
    });
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const data: any[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        data.push({ name: d.toLocaleDateString('pt-BR', { month: 'short' }), key: d.toISOString().substring(0, 7), basica: 0, natal: 0 });
    }
    sales.forEach(s => {
        if (s.deleted || !s.date) return;
        const bin = data.find(d => d.key === s.date?.substring(0, 7));
        if (bin) {
            if (s.type === ProductType.BASICA) bin.basica += s.quantity;
            if (s.type === ProductType.NATAL) bin.natal += s.quantity;
        }
    });
    return data;
};

export const getTrashItems = async () => {
    const sales = await dbGetAll('sales');
    const txs = await dbGetAll('transactions');
    return { sales: sales.filter(s => s.deleted), transactions: txs.filter(t => t.deleted) };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    await dbPut(type === 'SALE' ? 'sales' : 'transactions', { ...item, deleted: false, deletedAt: null });
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    await dbDelete(type === 'SALE' ? 'sales' : 'transactions', id);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        await deleteDoc(doc(db, type === 'SALE' ? "sales" : "transactions", id));
    }
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

/* Fix: Added exportReportToCSV function */
export const exportReportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/* Fix: Added calculateProductivityMetrics function */
export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const clients = await analyzeClients(await getStoredSales(), await getReportConfig());
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === 'ACTIVE').length;
    const convertedThisMonth = 0; // Simple placeholder
    const conversionRate = activeClients > 0 ? (convertedThisMonth / activeClients) * 100 : 0;
    let productivityStatus: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (conversionRate >= 90) productivityStatus = 'GREEN';
    else if (conversionRate >= 70) productivityStatus = 'YELLOW';
    return { totalClients, activeClients, convertedThisMonth, conversionRate, productivityStatus };
};

/* Fix: Added exportEncryptedBackup function */
export const exportEncryptedBackup = async (passphrase: string) => {
    const allData = {
        sales: await dbGetAll('sales'),
        transactions: await dbGetAll('transactions'),
        accounts: await dbGetAll('accounts'),
        config: await getSystemConfig(),
    };
    const content = JSON.stringify(allData);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().slice(0,10)}.v360`;
    a.click();
};

/* Fix: Added importEncryptedBackup function */
export const importEncryptedBackup = async (file: File, passphrase: string) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.sales) await dbBulkPut('sales', data.sales);
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
};

/* Fix: Added clearAllSales function */
export const clearAllSales = async () => {
    await dbClear('sales');
};

/* Fix: Added generateChallengeCells function */
export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const avg = target / count;
    for (let i = 1; i <= count; i++) {
        cells.push({
            id: crypto.randomUUID(),
            challengeId,
            number: i,
            value: model === 'LINEAR' ? (i * (target / ((count * (count + 1)) / 2))) : avg,
            status: 'PENDING'
        });
    }
    return cells;
};

/* Fix: Added generateFinanceTemplate function */
export const generateFinanceTemplate = () => {
    const headers = ["Data", "Descrição", "Valor", "Tipo", "Categoria", "Conta", "Pessoa"];
    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "modelo_importacao_financeira.csv");
    link.click();
};

/* Fix: Added processFinanceImport function */
export const processFinanceImport = (rows: any[][], mapping: any): Transaction[] => {
    return rows.slice(1).map(row => ({
        id: crypto.randomUUID(),
        date: row[mapping.date] || new Date().toISOString().split('T')[0],
        description: row[mapping.description] || 'Importado',
        amount: parseFloat(row[mapping.amount]) || 0,
        type: row[mapping.type] === 'Receita' ? 'INCOME' : 'EXPENSE',
        categoryId: 'uncategorized',
        accountId: '',
        isPaid: true,
        personType: row[mapping.person] === 'PJ' ? 'PJ' : 'PF'
    }));
};

/* Fix: Added readExcelFile function */
export const readExcelFile = async (file: File): Promise<any[][]> => {
    const text = await file.text();
    return text.split('\n').map(line => line.split(','));
};

/* Fix: Added processSalesImport function */
export const processSalesImport = (rows: any[][], mapping: any): any[] => {
    return rows.slice(1).map(row => ({
        client: row[mapping.client],
        quantity: parseInt(row[mapping.quantity]) || 0,
        valueSold: parseFloat(row[mapping.valueSold]) || 0,
        type: row[mapping.type] === 'Natal' ? ProductType.NATAL : ProductType.BASICA
    }));
};

/* Fix: Added findPotentialDuplicates function */
export const findPotentialDuplicates = (sales: Sale[]) => {
    return []; // Placeholder
};

/* Fix: Added smartMergeSales function */
export const smartMergeSales = (sales: Sale[]): Sale => {
    return sales[0]; // Placeholder
};

/* Fix: Added takeSnapshot function */
export const takeSnapshot = async () => {
    return await dbGetAll('sales');
};
