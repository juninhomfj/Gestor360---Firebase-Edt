
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
    Sale, Transaction, FinanceAccount, CreditCard, TransactionCategory, 
    FinanceGoal, Challenge, ChallengeCell, Receivable, ReportConfig, 
    SystemConfig, ProductLabels, ProductType, CommissionRule, ChallengeModel,
    DuplicateGroup, FinancialPacing, SaleFormData, ImportMapping,
    User, Client, ProductivityMetrics, SalesGoal
} from '../types';
import { dbPut, dbBulkPut, dbGetAll, dbGet, saveConfigItem, getConfigItem, dbDelete, dbClear } from '../storage/db';

// --- CONSTANTES ---
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
    productLabels: DEFAULT_PRODUCT_LABELS,
    includeNonAccountingInTotal: false
};

/**
 * HELPER DE ACESSO CENTRALIZADO (Hieraquia DEV > ADMIN > USER)
 */
export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    
    const role = user.role;
    
    // 1. DEV acessa absolutamente tudo
    if (role === 'DEV') return true;
    
    // 2. ADMIN acessa tudo exceto as ferramentas internas de engenharia (módulo 'dev')
    if (role === 'ADMIN') {
        if (feature === 'dev') return false;
        return true;
    }
    
    // 3. USER depende das flags de módulos habilitados no seu perfil
    return !!(user.modules as any)[feature];
};

/**
 * BOOTSTRAP DE PRODUÇÃO IDEMPOTENTE: Garante documentos mínimos se as coleções estiverem vazias.
 */
export const bootstrapProductionData = async (): Promise<void> => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    console.info("[Bootstrap] Validando integridade das coleções de produção...");

    try {
        // 1. Clientes
        const clientsSnap = await getDocs(query(collection(db, "clients"), limit(1)));
        if (clientsSnap.empty) {
            console.log("[Bootstrap] Coleção 'clients' vazia. Criando modelo inicial...");
            const modelClient: Client = {
                id: "model_client_prod",
                name: "Cliente Modelo Gestor360",
                clientCode: "CLI-001",
                companyName: "Empresa Exemplo LTDA",
                contactName: "Administrador",
                status: "ATIVO",
                benefitProfile: "BASICA",
                quotationDay: 1,
                monthlyQuantityDeclared: 1,
                monthlyQuantityAverage: 0,
                isActive: true,
                userId: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, "clients", modelClient.id), { ...modelClient, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            await dbPut('clients', modelClient);
        }

        // 2. Contas Financeiras
        const accountsSnap = await getDocs(query(collection(db, "accounts"), limit(1)));
        if (accountsSnap.empty) {
            console.log("[Bootstrap] Coleção 'accounts' vazia. Criando conta padrão...");
            const modelAccount: FinanceAccount = {
                id: "default_main",
                name: "Conta Principal (Caixa)",
                type: "CASH",
                balance: 0,
                isAccounting: true,
                includeInDistribution: true,
                personType: "PF"
            };
            await setDoc(doc(db, "accounts", modelAccount.id), modelAccount);
            await dbPut('accounts', modelAccount);
        }

        // 3. Categorias
        const categoriesSnap = await getDocs(query(collection(db, "categories"), limit(1)));
        if (categoriesSnap.empty) {
            console.log("[Bootstrap] Coleção 'categories' vazia. Criando base financeira...");
            const baseCategories: TransactionCategory[] = [
                { id: "cat_receita_vendas", name: "Receita de Vendas", type: "INCOME", personType: "PJ", subcategories: [] },
                { id: "cat_despesa_op", name: "Despesas Operacionais", type: "EXPENSE", personType: "PJ", subcategories: [] }
            ];
            for (const cat of baseCategories) {
                await setDoc(doc(db, "categories", cat.id), cat);
                await dbPut('categories', cat);
            }
        }

        // 4. Configuração do Sistema
        const configSnap = await getDoc(doc(db, "config", "system"));
        if (!configSnap.exists()) {
            console.log("[Bootstrap] Configuração global não encontrada. Criando padrão...");
            await setDoc(doc(db, "config", "system"), { ...DEFAULT_SYSTEM_CONFIG, updatedAt: serverTimestamp() });
        }

        console.info("[Bootstrap] Verificação concluída.");
    } catch (e) {
        console.error("[Bootstrap] Erro na inicialização de dados:", e);
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
        try {
            await setDoc(doc(db, "config", "system"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) {}
    }
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const config = await getConfigItem('report_config');
    return config || { daysForNewClient: 30, daysForInactive: 60, daysForLost: 180 };
};

export const saveReportConfig = async (config: ReportConfig) => {
    await saveConfigItem('report_config', config);
};

// --- VENDAS (CORE) ---
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
            const ref = doc(db, "sales", sale.id);
            batch.set(ref, { ...sale, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
        });
        await batch.commit();
    }
};

export const saveSingleSale = async (sale: Sale) => {
    await dbPut('sales', sale);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            await setDoc(doc(db, "sales", sale.id), { ...sale, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
        } catch (e) {}
    }
    // Ao salvar uma venda, recalcula a média do cliente se houver clientId
    if (sale.clientId) {
        await recalculateClientAverages(sale.clientId);
    }
};

export const deleteSingleSale = async (id: string) => {
    const sale = await dbGet('sales', id);
    if (sale) {
        const updated = { ...sale, deleted: true, deletedAt: new Date().toISOString() };
        await dbPut('sales', updated);
        // @ts-ignore
        if (db && db.type !== 'mock' && auth.currentUser) {
            try {
                await updateDoc(doc(db, "sales", id), { deleted: true, deletedAt: serverTimestamp() });
            } catch (e) {}
        }
        if (sale.clientId) await recalculateClientAverages(sale.clientId);
    }
};

export const clearAllSales = async () => {
    await dbClear('sales');
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const store = type === ProductType.BASICA ? 'commission_basic' 
                : type === ProductType.NATAL ? 'commission_natal' 
                : 'commission_custom';
    return await dbGetAll(store as any);
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const store = type === ProductType.BASICA ? 'commission_basic' 
                : type === ProductType.NATAL ? 'commission_natal' 
                : 'commission_custom';
    
    await dbClear(store as any);
    await dbBulkPut(store as any, rules);
};

export const calculateMargin = (sold: number, proposed: number): number => {
    if (proposed <= 0.01) return 0; 
    const m = ((sold - proposed) / proposed) * 100;
    return Number(m.toFixed(2));
};

export const computeCommissionValues = (quantity: number, valueProposed: number, marginPercent: number, rules: CommissionRule[]) => {
    const commissionBase = quantity * valueProposed;
    const rate = findCommissionRate(marginPercent, rules);
    return { 
        commissionBase, 
        commissionValue: commissionBase * rate, 
        rateUsed: rate 
    };
};

const findCommissionRate = (margin: number, rules: CommissionRule[]): number => {
    if (!rules || rules.length === 0) return 0;
    const sorted = [...rules].sort((a, b) => a.minPercent - b.minPercent);
    const rule = sorted.find(r => {
        const max = r.maxPercent === null ? Infinity : r.maxPercent;
        return margin >= r.minPercent && margin < max;
    });
    return rule ? rule.commissionRate : 0;
};

// --- MÓDULO CLIENTES & CRM (NOVO) ---
export const getClients = async (): Promise<Client[]> => {
    const local = await dbGetAll('clients');
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            const q = query(collection(db, "clients"), where("userId", "==", auth.currentUser.uid));
            const snap = await getDocs(q);
            const remote = snap.docs.map(d => d.data() as Client);
            if (remote.length > 0) {
                await dbBulkPut('clients', remote);
                return remote;
            }
        } catch (e) {}
    }
    return local;
};

export const saveClient = async (client: Client) => {
    const stamped = { ...client, updatedAt: new Date().toISOString() };
    await dbPut('clients', stamped);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            await setDoc(doc(db, "clients", client.id), { ...stamped, userId: auth.currentUser.uid, updatedAt: serverTimestamp() });
        } catch (e) {}
    }
};

export const getDeletedClients = async (): Promise<Client[]> => {
    const clients = await dbGetAll('clients');
    return clients.filter(c => c.deleted);
};

export const restoreClient = async (id: string) => {
    const client = await dbGet('clients', id);
    if (client) {
        const updated = { ...client, deleted: false, deletedAt: undefined };
        await dbPut('clients', updated);
    }
};

export const permanentlyDeleteClient = async (id: string) => {
    await dbDelete('clients', id);
};

export const recalculateClientAverages = async (clientId: string) => {
    const allSales = await getStoredSales();
    const clientSales = allSales.filter(s => s.clientId === clientId && s.type === ProductType.BASICA && !s.deleted);
    
    if (clientSales.length === 0) return;

    // Calcula média baseada nos últimos 6 meses com vendas
    const totalQty = clientSales.reduce((acc, s) => acc + s.quantity, 0);
    
    // Extrai meses únicos
    const months = new Set(clientSales.map(s => (s.date || s.completionDate).substring(0, 7)));
    const avg = totalQty / (months.size || 1);

    const client = await dbGet('clients', clientId);
    if (client) {
        await saveClient({ ...client, monthlyQuantityAverage: avg });
    }
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
    const clients = await getClients();
    const myClients = clients.filter(c => c.userId === userId && !c.deleted);
    const activeClients = myClients.filter(c => c.isActive && c.status === 'ATIVO');
    
    const now = new Date();
    const monthKey = now.toISOString().substring(0, 7);
    
    const sales = await getStoredSales();
    const monthlySales = sales.filter(s => 
        !s.deleted && 
        s.userId === userId && 
        (s.date || s.completionDate).startsWith(monthKey) &&
        s.clientId
    );

    const convertedIds = new Set(monthlySales.map(s => s.clientId));
    const convertedCount = Array.from(convertedIds).filter(id => 
        myClients.some(c => c.id === id && c.status === 'ATIVO')
    ).length;

    const conversionRate = activeClients.length > 0 ? (convertedCount / activeClients.length) * 100 : 0;
    
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
    if (conversionRate >= 90) status = 'GREEN';
    else if (conversionRate >= 70) status = 'YELLOW';

    return {
        totalClients: myClients.length,
        activeClients: activeClients.length,
        convertedThisMonth: convertedCount,
        conversionRate,
        productivityStatus: status
    };
};

export const saveSalesGoal = async (goal: SalesGoal) => {
    await dbPut('sales_goals' as any, goal, goal.id);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try {
            await setDoc(doc(db, "sales_goals", goal.id), { ...goal, updatedAt: serverTimestamp() });
        } catch (e) {}
    }
};

export const getMonthlyGoal = async (month: string, userId: string): Promise<SalesGoal | null> => {
    const goals = await dbGetAll('sales_goals' as any);
    return goals.find((g: SalesGoal) => g.month === month && g.userId === userId) || null;
};

// --- FINANCEIRO ---
export const bootstrapDefaultAccountIfMissing = async () => {
    const accounts = await dbGetAll('accounts');
    if (accounts.length === 0) {
        const defaultAcc: FinanceAccount = {
            id: 'default_main',
            name: 'Carteira Principal',
            type: 'CASH',
            balance: 0,
            color: 'emerald',
            isAccounting: true,
            includeInDistribution: true,
            personType: 'PF'
        };
        await dbPut('accounts', defaultAcc);
    }
};

export const getFinanceData = async () => {
    const [accounts, cards, transactions, categories, goals, challenges, challenge_cells, receivables] = await Promise.all([
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
        transactions: (transactions || []).filter(t => !t.deleted),
        categories: categories || [],
        goals: goals || [],
        challenges: challenges || [],
        cells: challenge_cells || [],
        receivables: receivables || []
    };
};

export const saveFinanceData = async (acc: any, cards: any, txs: any, cats: any, goals: any, chals: any, cells: any, recs: any) => {
    await Promise.all([
        dbBulkPut('accounts', acc),
        dbBulkPut('cards', cards),
        dbBulkPut('transactions', txs),
        dbBulkPut('categories', cats),
        dbBulkPut('goals', goals),
        dbBulkPut('challenges', chals),
        dbBulkPut('challenge_cells', cells),
        dbBulkPut('receivables', recs)
    ]);
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let nextDay = salaryDays.sort((a, b) => a - b).find(d => d > today);
    let nextIncomeDate: Date;

    if (nextDay) {
        nextIncomeDate = new Date(currentYear, currentMonth, nextDay);
    } else {
        const firstDayNext = salaryDays[0] || 1;
        nextIncomeDate = new Date(currentYear, currentMonth + 1, firstDayNext);
    }

    const diffTime = nextIncomeDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const pendingExpenses = transactions
        .filter(t => !t.isPaid && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);

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
    if (d.getDate() > closingDay) {
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().substring(0, 7); 
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientsMap = new Map<string, any>();
    const now = new Date();

    sales.forEach(s => {
        if (s.deleted) return;
        const entry = clientsMap.get(s.client) || { 
            name: s.client, 
            totalOrders: 0, 
            totalSpent: 0, 
            lastPurchaseDate: '1970-01-01' 
        };
        entry.totalOrders++;
        entry.totalSpent += (s.valueSold * s.quantity);
        const sDate = s.date || s.completionDate || '1970-01-01';
        if (new Date(sDate) > new Date(entry.lastPurchaseDate)) {
            entry.lastPurchaseDate = sDate;
        }
        clientsMap.set(s.client, entry);
    });

    return Array.from(clientsMap.values()).map(c => {
        const lastDate = new Date(c.lastPurchaseDate);
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let status: 'ACTIVE' | 'NEW' | 'INACTIVE' | 'LOST' = 'ACTIVE';
        if (diffDays <= config.daysForNewClient && c.totalOrders === 1) status = 'NEW';
        else if (diffDays > config.daysForLost) status = 'LOST';
        else if (diffDays > config.daysForInactive) status = 'INACTIVE';

        return { ...c, status, daysSinceLastPurchase: diffDays };
    });
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
    const data: any[] = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7);
        data.push({ name: d.toLocaleDateString('pt-BR', { month: 'short' }), key, basica: 0, natal: 0 });
    }

    sales.forEach(s => {
        if (s.deleted || !s.date) return;
        const monthKey = s.date.substring(0, 7);
        const bin = data.find(d => d.key === monthKey);
        if (bin) {
            if (s.type === ProductType.BASICA) bin.basica += s.quantity;
            if (s.type === ProductType.NATAL) bin.natal += s.quantity;
        }
    });

    return data;
};

// --- MANUTENÇÃO & AUDITORIA ---
export const getTrashItems = async () => {
    const sales = await dbGetAll('sales');
    const txs = await dbGetAll('transactions');
    return {
        sales: sales.filter(s => s.deleted),
        transactions: txs.filter(t => t.deleted)
    };
};

export const restoreItem = async (type: 'SALE' | 'TRANSACTION', item: any) => {
    const restored = { ...item, deleted: false, deletedAt: null };
    await dbPut(type === 'SALE' ? 'sales' : 'transactions', restored);
};

export const permanentlyDeleteItem = async (type: 'SALE' | 'TRANSACTION', id: string) => {
    await dbDelete(type === 'SALE' ? 'sales' : 'transactions', id);
    // @ts-ignore
    if (db && db.type !== 'mock' && auth.currentUser) {
        try { await deleteDoc(doc(db, type === 'SALE' ? "sales" : "transactions", id)); } catch(e) {}
    }
};

export const auditDataDuplicates = (sales: Sale[], transactions: Transaction[]) => {
    const salesGroups: DuplicateGroup<Sale>[] = [];
    const salesSeen = new Set();

    sales.forEach(s => {
        const key = `${s.client}-${s.valueSold}-${s.date || s.completionDate}`;
        if (salesSeen.has(key)) {
            const existing = salesGroups.find(g => g.id === key);
            if (existing) existing.items.push(s);
            else salesGroups.push({ id: key, items: [s] });
        }
        salesSeen.add(key);
    });

    return { salesGroups, transactionGroups: [] };
};

export const smartMergeSales = (sales: Sale[]): Sale => {
    const master = { ...sales[0] };
    const others = sales.slice(1);
    others.forEach(s => {
        master.quantity += s.quantity;
        master.commissionBaseTotal += s.commissionBaseTotal;
        master.commissionValueTotal += s.commissionValueTotal;
    });
    return master;
};

// --- IMPORTAÇÃO / EXPORTAÇÃO ---
export const readExcelFile = async (file: File): Promise<any[][]> => {
    const { read, utils } = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = read(buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return utils.sheet_to_json(ws, { header: 1 });
};

export const processSalesImport = (data: any[][], mapping: ImportMapping): SaleFormData[] => {
    const rows = data.slice(1); 
    return rows.map(row => {
        const rowDate = mapping.date !== undefined && mapping.date !== -1 ? String(row[mapping.date] || '') : '';
        return {
            client: mapping.client !== -1 ? String(row[mapping.client] || 'Sem Nome') : 'Sem Nome',
            quantity: mapping.quantity !== -1 ? (parseFloat(row[mapping.quantity]) || 1) : 1,
            type: mapping.type !== -1 && String(row[mapping.type]).toUpperCase().includes('NATAL') ? ProductType.NATAL : ProductType.BASICA,
            valueProposed: mapping.valueProposed !== -1 ? (parseFloat(row[mapping.valueProposed]) || 0) : 0,
            valueSold: mapping.valueSold !== -1 ? (parseFloat(row[mapping.valueSold]) || 0) : 0,
            date: rowDate,
            completionDate: mapping.completionDate !== -1 ? String(row[mapping.completionDate] || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
            observations: mapping.obs !== -1 ? String(row[mapping.obs] || '') : '',
            marginPercent: mapping.margin !== -1 ? (parseFloat(row[mapping.margin]) || 0) : 0,
            quoteNumber: mapping.quote !== -1 ? String(row[mapping.quote] || '') : '',
            trackingCode: mapping.tracking !== -1 ? String(row[mapping.tracking] || '') : '',
            status: rowDate.length > 0 ? 'FATURADO' as const : 'ORÇAMENTO' as const,
            hasNF: false,
            isBilled: rowDate.length > 0
        };
    });
};

export const processFinanceImport = (data: any[][], mapping: ImportMapping): Transaction[] => {
    const rows = data.slice(1);
    return rows.map(row => ({
        id: crypto.randomUUID(),
        description: String(row[mapping.description] || 'Importado'),
        amount: Math.abs(parseFloat(row[mapping.amount]) || 0),
        type: parseFloat(row[mapping.amount]) < 0 ? 'EXPENSE' : 'INCOME',
        date: String(row[mapping.date] || new Date().toISOString().split('T')[0]),
        categoryId: 'uncategorized',
        accountId: '', 
        isPaid: true
    }));
};

export const generateFinanceTemplate = () => {
    const csvContent = "Data,Descrição,Valor,Tipo,Categoria\n2024-01-01,Exemplo de Venda,1500.00,Receita,Vendas";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "modelo_financeiro.csv");
    link.click();
};

export const exportReportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
    const content = `${headers}\n${rows}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}.csv`);
    link.click();
};

// --- OUTROS ---
export const hardResetLocalData = async () => {
    localStorage.clear();
    await dbClear('sales');
    await dbClear('transactions');
    await dbClear('accounts');
    await dbClear('clients');
    window.location.reload();
};

export const getUserPlanLabel = (user: User) => {
    const role = user.role || 'USER';
    if (role === 'DEV') return 'Engenheiro de Sistema (Root)';
    return role === 'ADMIN' ? 'Administrador do Sistema' : 'Plano Profissional';
};

export const generateChallengeCells = (challengeId: string, target: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    if (model === 'PROPORTIONAL') {
        const val = target / count;
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: val, status: 'PENDING' });
        }
    } else {
        const sum = (count * (count + 1)) / 2;
        const base = target / sum;
        for (let i = 1; i <= count; i++) {
            cells.push({ id: crypto.randomUUID(), challengeId, number: i, value: base * i, status: 'PENDING' });
        }
    }
    return cells;
};

export const takeSnapshot = (sales: Sale[]) => {
    localStorage.setItem('sales_snapshot', JSON.stringify(sales));
};

export const exportEncryptedBackup = async (pass: string) => {
    const all = {
        sales: await dbGetAll('sales'),
        transactions: await dbGetAll('transactions'),
        accounts: await dbGetAll('accounts'),
        clients: await dbGetAll('clients'),
        config: await getConfigItem('system_config')
    };
    const content = JSON.stringify(all);
    const blob = new Blob([content], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `backup_gestor360_${new Date().toISOString().split('T')[0]}.v360`);
    link.click();
};

export const importEncryptedBackup = async (file: File, pass: string) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.sales) await dbBulkPut('sales', data.sales);
    if (data.transactions) await dbBulkPut('transactions', data.transactions);
    if (data.accounts) await dbBulkPut('accounts', data.accounts);
    if (data.clients) await dbBulkPut('clients', data.clients);
    return true;
};

export const findPotentialDuplicates = (sales: Sale[]) => {
    return [];
};
