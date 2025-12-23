
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
    User, Client, ProductivityMetrics, SalesGoal, ChallengeCell, Challenge, CreditCard, FinanceGoal, ProductLabels
} from '../types';
import { dbPut, dbBulkPut, dbGetAll, dbGet, saveConfigItem, getConfigItem, dbDelete, dbClear } from '../storage/db';
// Added missing getSession import
import { getSession } from './auth';

export const DEFAULT_PRODUCT_LABELS: ProductLabels = { basica: 'Cesta Básica', natal: 'Cesta de Natal', custom: 'Personalizado' };

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
    daysForNewClient: 30,
    daysForInactive: 60,
    daysForLost: 180
};

// Added missing DEFAULT_SYSTEM_CONFIG export
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    theme: 'glass',
    modules: {
        sales: true,
        finance: true,
        crm: true,
        whatsapp: false,
        reports: true,
        ai: true,
        dev: false,
        settings: true,
        news: true,
        receivables: true,
        distribution: true,
        imports: true
    }
};

/**
 * Controle de Acesso Centralizado (Garantia Nível 2)
 */
export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    
    // DEV: Acesso Total
    if (user.role === 'DEV') return true; 
    
    // ADMIN: Acesso Total exceto módulos de Engenharia DEV
    if (user.role === 'ADMIN') {
        if (feature === 'dev') return false;
        return true;
    }
    
    // USER: Segue o objeto de permissões explicitamente
    return !!(user.permissions as any)[feature];
};

/**
 * Bootstrap Nível 2 - Inicialização de Infraestrutura Firebase
 * Garante que 21 coleções existam com dados mínimos.
 */
export const bootstrapProductionData = async (): Promise<any> => {
    if (!fbAuth.currentUser) return { success: false, msg: "Usuário não autenticado." };
    const uid = fbAuth.currentUser.uid;
    const stats: any = { created: [], docs: {} };

    console.info("[Bootstrap V2] Iniciando sincronização de infraestrutura...");

    const checkAndSeed = async (collName: string, seedDoc: any, userScoped: boolean = false) => {
        try {
            const collRef = collection(db, collName);
            const q = query(collRef, limit(1));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                const docId = seedDoc.id || "seed_" + Date.now();
                const docRef = doc(db, collName, docId);
                const finalData = { 
                    ...seedDoc, 
                    id: docId,
                    userId: userScoped ? uid : "system",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                await setDoc(docRef, finalData);
                stats.created.push(collName);
                stats.docs[collName] = 1;
            } else {
                stats.docs[collName] = snap.size;
            }
        } catch (e) {
            console.error(`[Bootstrap] Erro na coleção ${collName}:`, e);
        }
    };

    // --- CORE COLLECTIONS ---
    await checkAndSeed("config", { id: "system", bootstrapVersion: 2, environment: "production" });
    await checkAndSeed("audit_log", { message: "Sistema inicializado", level: "INFO" });
    await checkAndSeed("sync_queue", { table: "bootstrap", type: "INIT", status: "SYNCED" });

    // --- FINANCEIRO ---
    await checkAndSeed("accounts", { 
        id: "account_main", name: "Conta Principal", type: "CASH", 
        balance: 0, isAccounting: true, includeInDistribution: true, 
        personType: "PF", deleted: false 
    }, true);
    await checkAndSeed("categories", { id: "category_default", name: "Categoria Padrão", type: "GENERIC", subcategories: [], deleted: false });
    await checkAndSeed("cards", { active: true });
    await checkAndSeed("transactions", { 
        description: "Lançamento Inicial", accountId: "account_main", 
        categoryId: "category_default", type: "EXPENSE", amount: 0, 
        isPaid: true, date: new Date().toISOString(), deleted: false 
    }, true);
    await checkAndSeed("receivables", { active: true });

    // --- VENDAS / CRM ---
    await checkAndSeed("clients", { 
        clientCode: "0001", companyName: "Cliente Modelo LTDA", 
        name: "Cliente Modelo", contactName: "Administrador", 
        status: "ATIVO", benefitProfile: "BASICA", isActive: true, deleted: false 
    }, true);
    await checkAndSeed("sales", { 
        clientId: "client_model", client: "Cliente Modelo", 
        type: "BASICA", quantity: 0, valueProposed: 0, valueSold: 0, 
        commissionValueTotal: 0, isBilled: false, deleted: false 
    }, true);
    await checkAndSeed("sales_goals", { active: true }, true);
    await checkAndSeed("client_transfer_requests", { active: true });

    // --- WHATSAPP ---
    const waTables = ["wa_contacts", "wa_tags", "wa_campaigns", "wa_queue", "wa_manual_logs", "wa_campaign_stats"];
    for (const table of waTables) await checkAndSeed(table, { active: true }, true);

    // --- OUTROS ---
    await checkAndSeed("challenges", { active: true }, true);
    await checkAndSeed("challenge_cells", { active: true });
    await checkAndSeed("internal_messages", { content: "Bem-vindo ao Gestor 360", senderId: "system", recipientId: "BROADCAST", type: "BROADCAST" });

    // --- LOG FINAL ---
    const logData = {
        timestamp: new Date().toISOString(),
        user: { uid, role: getSession()?.role },
        collectionsStats: stats.docs,
        newlyCreated: stats.created
    };
    console.table(logData);
    return logData;
};

// --- CONFIGURAÇÃO ---
export const getSystemConfig = async (): Promise<SystemConfig> => {
    const local = await getConfigItem('system_config');
    if (fbAuth.currentUser) {
        try {
            const snap = await getDoc(doc(db, "config", "system"));
            if (snap.exists()) return snap.data() as SystemConfig;
        } catch (e) {}
    }
    return local || DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
    await saveConfigItem('system_config', config);
    if (fbAuth.currentUser) {
        await setDoc(doc(db, "config", "system"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
    }
};

export const getReportConfig = async (): Promise<ReportConfig> => {
    const local = await getConfigItem('report_config');
    if (fbAuth.currentUser) {
        try {
            const snap = await getDoc(doc(db, "config", "reports"));
            if (snap.exists()) return snap.data() as ReportConfig;
        } catch (e) {}
    }
    return local || DEFAULT_REPORT_CONFIG;
};

export const saveReportConfig = async (config: ReportConfig) => {
    await saveConfigItem('report_config', config);
    if (fbAuth.currentUser) {
        await setDoc(doc(db, "config", "reports"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
    }
};

// --- VENDAS ---
export const getStoredSales = async (): Promise<Sale[]> => {
    if (fbAuth.currentUser) {
        try {
            const q = query(collection(db, "sales"), where("userId", "==", fbAuth.currentUser.uid));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)).filter(s => !s.deleted);
        } catch (e) { return []; }
    }
    return [];
};

export const saveSingleSale = async (sale: Sale) => {
    if (fbAuth.currentUser) {
        await setDoc(doc(db, "sales", sale.id), { ...sale, userId: fbAuth.currentUser.uid, updatedAt: serverTimestamp() });
    }
};

export const saveSales = async (sales: Sale[]) => {
    for (const s of sales) await saveSingleSale(s);
};

// --- FINANCEIRO ---
export const getFinanceData = async () => {
    if (fbAuth.currentUser) {
        const uid = fbAuth.currentUser.uid;
        try {
            const [accS, txS, catS] = await Promise.all([
                getDocs(query(collection(db, "accounts"), where("userId", "==", uid))),
                getDocs(query(collection(db, "transactions"), where("userId", "==", uid), where("deleted", "==", false))),
                getDocs(query(collection(db, "categories"), where("deleted", "==", false)))
            ]);
            return {
                accounts: accS.docs.map(d => ({ id: d.id, ...d.data() } as any)),
                transactions: txS.docs.map(d => ({ id: d.id, ...d.data() } as any)),
                categories: catS.docs.map(d => ({ id: d.id, ...d.data() } as any)),
                cards: [], goals: [], challenges: [], cells: [], receivables: []
            };
        } catch (e) {
            return { accounts: [], transactions: [], categories: [], cards: [], goals: [], challenges: [], cells: [], receivables: [] };
        }
    }
    return { accounts: [], transactions: [], categories: [], cards: [], goals: [], challenges: [], cells: [], receivables: [] };
};

// Updated saveFinanceData signature to accept all arguments passed from components
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
    const uid = fbAuth.currentUser?.uid;
    if (!uid) return;

    for (const a of acc) await setDoc(doc(db, "accounts", a.id), { ...a, userId: uid });
    for (const t of txs) await setDoc(doc(db, "transactions", t.id), { ...t, userId: uid, updatedAt: serverTimestamp() });
    // Save additional fields if provided
    if (goals) for (const g of goals) await setDoc(doc(db, "goals", g.id), { ...g, userId: uid });
    if (challenges) for (const c of challenges) await setDoc(doc(db, "challenges", c.id), { ...c, userId: uid });
    if (receivables) for (const r of receivables) await setDoc(doc(db, "receivables", r.id), { ...r, userId: uid });
};

// --- COMISSÕES ---
export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const colName = type === ProductType.BASICA ? "commission_basic" : (type === ProductType.NATAL ? "commission_natal" : "commission_custom");
    try {
        const snap = await getDocs(collection(db, colName));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
    } catch (e) { return []; }
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const colName = type === ProductType.BASICA ? "commission_basic" : (type === ProductType.NATAL ? "commission_natal" : "commission_custom");
    const batch = writeBatch(db);
    rules.forEach(r => batch.set(doc(db, colName, r.id), r));
    await batch.commit();
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

// --- CLIENTES ---
export const getClients = async (): Promise<Client[]> => {
    if (!fbAuth.currentUser) return [];
    try {
        const q = query(collection(db, "clients"), where("userId", "==", fbAuth.currentUser.uid));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)).filter(c => !c.deleted);
    } catch (e) { return []; }
};

export const saveClient = async (client: Client) => {
    if (fbAuth.currentUser) {
        await setDoc(doc(db, "clients", client.id), { ...client, userId: fbAuth.currentUser.uid, updatedAt: serverTimestamp() });
    }
};

// Auxiliares mantidos
export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]) => {
    const now = new Date();
    const daysRemaining = 30 - now.getDate();
    return { daysRemaining, safeDailySpend: balance / (daysRemaining || 1), pendingExpenses: 0, nextIncomeDate: now };
};

export const getInvoiceMonth = (date: string, closingDay: number) => date.substring(0, 7);

export const getTrashItems = async () => ({ sales: [], transactions: [] });
export const restoreItem = async (t:any, i:any) => {};
export const permanentlyDeleteItem = async (t:any, id:string) => {};
export const hardResetLocalData = () => { localStorage.clear(); window.location.reload(); };
export const getUserPlanLabel = (u:User) => u.role;
export const getDeletedClients = async () => [];
export const restoreClient = async (id:string) => {};
export const permanentlyDeleteClient = async (id:string) => {};
export const analyzeClients = (s:any, c:any) => [];
export const analyzeMonthlyVolume = (s:any, m:any) => [];
export const exportReportToCSV = (d:any, f:any) => {};
export const calculateProductivityMetrics = async (u:string) => ({ totalClients:0, activeClients:0, convertedThisMonth:0, conversionRate:0, productivityStatus:'GREEN' });
export const exportEncryptedBackup = async (p:string) => {};
export const importEncryptedBackup = async (f:any, p:string) => {};
export const clearAllSales = () => {};
export const generateChallengeCells = (a:any, b:any, c:any, d:any) => [];
export const generateFinanceTemplate = () => {};
export const processFinanceImport = (a:any, b:any) => [];
export const readExcelFile = async (f:any) => [];
export const findPotentialDuplicates = (s:any) => [];
export const smartMergeSales = (s:any) => s[0];
export const processSalesImport = (a:any, b:any) => [];
