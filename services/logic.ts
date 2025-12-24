
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    getDoc,
    query, 
    where, 
    writeBatch,
    serverTimestamp,
    limit
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { 
    Sale, Transaction, FinanceAccount, TransactionCategory, 
    Receivable, ReportConfig, SystemConfig, ProductType, CommissionRule, 
    User, Client, CreditCard, ChallengeCell, FinancialPacing, ChallengeModel
} from '../types';

export const DEFAULT_PRODUCT_LABELS = { basica: 'Cesta Básica', natal: 'Cesta de Natal', custom: 'Personalizado' };

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
    daysForNewClient: 30,
    daysForInactive: 60,
    daysForLost: 180
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    theme: 'glass',
    modules: {
        sales: true, finance: true, crm: true, whatsapp: true,
        reports: true, ai: true, dev: false, settings: true,
        news: true, receivables: true, distribution: true, imports: true
    }
};

export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user) return false;
    if (user.role === 'DEV') return true; 
    if (!user.isActive) return false;
    if (user.role === 'ADMIN') return feature !== 'dev';
    return !!(user.permissions as any)[feature];
};

export const calculateFinancialPacing = (balance: number, salaryDays: number[], transactions: Transaction[]): FinancialPacing => {
    const now = new Date();
    const today = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Determine the next income date
    let nextDay = salaryDays.find(d => d > today);
    let nextMonth = currentMonth;
    let nextYear = currentYear;

    if (!nextDay) {
        nextDay = salaryDays[0] || 1;
        nextMonth = (currentMonth + 1) % 12;
        if (nextMonth === 0) nextYear++;
    }

    const nextIncomeDate = new Date(nextYear, nextMonth, nextDay);
    const diffTime = nextIncomeDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate pending obligations until next income
    const pendingExpenses = transactions
        .filter(t => !t.isPaid && t.type === 'EXPENSE' && new Date(t.date) <= nextIncomeDate)
        .reduce((acc, t) => acc + t.amount, 0);

    const safeDailySpend = Math.max(0, (balance - pendingExpenses) / daysRemaining);

    return {
        daysRemaining,
        safeDailySpend,
        pendingExpenses,
        nextIncomeDate
    };
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
    const clientMap = new Map<string, any>();
    const now = new Date();

    sales.forEach(sale => {
        const name = sale.client;
        const saleDate = new Date(sale.date || sale.completionDate);
        
        if (!clientMap.has(name)) {
            clientMap.set(name, {
                name,
                totalOrders: 0,
                totalSpent: 0,
                lastPurchaseDate: saleDate,
                firstPurchaseDate: saleDate
            });
        }

        const stats = clientMap.get(name);
        stats.totalOrders++;
        stats.totalSpent += (sale.valueSold * sale.quantity);
        if (saleDate > stats.lastPurchaseDate) stats.lastPurchaseDate = saleDate;
        if (saleDate < stats.firstPurchaseDate) stats.firstPurchaseDate = saleDate;
    });

    return Array.from(clientMap.values()).map(c => {
        const daysSinceLast = Math.floor((now.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        let status = 'ACTIVE';
        if (daysSinceLast > config.daysForLost) status = 'LOST';
        else if (daysSinceLast > config.daysForInactive) status = 'INACTIVE';
        else if (Math.floor((now.getTime() - c.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)) < config.daysForNewClient) status = 'NEW';

        return {
            ...c,
            status,
            daysSinceLastPurchase: daysSinceLast
        };
    });
};

export const generateChallengeCells = (challengeId: string, targetValue: number, count: number, model: ChallengeModel): ChallengeCell[] => {
    const cells: ChallengeCell[] = [];
    const uid = auth.currentUser?.uid || '';
    
    if (model === 'LINEAR') {
        // Arithmetic Progression: Sum = (n/2) * (a1 + an)
        // Here we want values to grow linearly: factor * (1, 2, 3...)
        const totalSteps = (count / 2) * (1 + count);
        const factor = targetValue / totalSteps;
        for (let i = 1; i <= count; i++) {
            cells.push({
                id: crypto.randomUUID(),
                challengeId,
                number: i,
                value: i * factor,
                status: 'PENDING',
                userId: uid,
                deleted: false
            });
        }
    } else {
        const fixedValue = targetValue / count;
        for (let i = 1; i <= count; i++) {
            cells.push({
                id: crypto.randomUUID(),
                challengeId,
                number: i,
                value: fixedValue,
                status: 'PENDING',
                userId: uid,
                deleted: false
            });
        }
    }
    return cells;
};

// ... Rest of Firebase functions preserved ...

export const bootstrapProductionData = async (): Promise<any> => {
    if (!auth.currentUser) return { success: false, msg: "Usuário não autenticado." };
    const uid = auth.currentUser.uid;
    const stats: any = { created: [], docs: {} };

    const checkAndSeed = async (collName: string, seedData: any, userScoped: boolean = false) => {
        try {
            const collRef = collection(db, collName);
            const q = query(collRef, limit(1));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                const docId = seedData.id || `seed_${collName}_${Date.now()}`;
                const docRef = doc(db, collName, docId);
                
                const finalData = { 
                    ...seedData, 
                    id: docId,
                    userId: userScoped ? uid : "system",
                    isActive: true,
                    deleted: false,
                    isSeed: true,
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
            console.error(`[Bootstrap] Erro em ${collName}:`, e);
        }
    };

    const tables = [
        { name: "config", data: { id: "system", bootstrapVersion: 3 }, scoped: false },
        { name: "profiles", data: { id: uid, role: "USER", isActive: true }, scoped: false },
        { name: "accounts", data: { name: "Conta Principal", balance: 0, isAccounting: true, includeInDistribution: true, type: 'CHECKING' }, scoped: true },
        { name: "categories", data: { name: "Geral", type: "GENERIC", subcategories: [] }, scoped: false },
        { name: "cards", data: { name: "Cartão Padrão", limit: 0, currentInvoice: 0, closingDay: 10, dueDay: 15, color: 'blue', personType: 'PF' }, scoped: true },
        { name: "transactions", data: { description: "Lançamento Inicial", amount: 0, type: "EXPENSE", isPaid: true, date: new Date().toISOString(), categoryId: 'uncategorized', accountId: 'seed' }, scoped: true },
        { name: "receivables", data: { description: "Previsão Inicial", value: 0, status: "PENDING", date: new Date().toISOString(), distributed: false }, scoped: true },
        { name: "clients", data: { name: "Cliente Exemplo", companyName: "Exemplo S/A", status: "ATIVO", benefitProfile: 'AMBOS', monthlyQuantityDeclared: 0, monthlyQuantityAverage: 0, isActive: true }, scoped: true },
        { name: "sales", data: { client: "Cliente Exemplo", quantity: 1, valueSold: 0, valueProposed: 0, type: ProductType.BASICA, status: 'ORÇAMENTO', marginPercent: 0, commissionBaseTotal: 0, commissionValueTotal: 0, commissionRateUsed: 0, completionDate: new Date().toISOString(), isBilled: false, hasNF: false, observations: 'Seed' }, scoped: true },
        { name: "commission_basic", data: { minPercent: 0, maxPercent: null, commissionRate: 0.05 }, scoped: false },
        { name: "commission_natal", data: { minPercent: 0, maxPercent: null, commissionRate: 0.07 }, scoped: false },
        { name: "commission_custom", data: { minPercent: 0, maxPercent: null, commissionRate: 0.10 }, scoped: false },
        { name: "goals", data: { name: "Meta Exemplo", targetValue: 1000, currentValue: 0, status: 'ACTIVE', description: 'Meta inicial' }, scoped: true },
        { name: "challenges", data: { name: "Desafio 52 Semanas", targetValue: 1378, depositCount: 52, model: 'LINEAR', status: 'ACTIVE' }, scoped: true },
        { name: "challenge_cells", data: { challengeId: "seed", number: 1, value: 1, status: "PENDING" }, scoped: true }
    ];

    for (const table of tables) {
        await checkAndSeed(table.name, table.data, table.scoped);
    }

    return stats;
};

export const getStoredSales = async (): Promise<Sale[]> => {
    if (!auth.currentUser) return [];
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "sales"), where("userId", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data,
            deleted: data.deleted === true 
        } as Sale;
    }).filter(s => !s.deleted);
};

export const getFinanceData = async () => {
    if (!auth.currentUser) return { accounts: [], transactions: [], categories: [], cards: [], goals: [], challenges: [], receivables: [], cells: [] };
    const uid = auth.currentUser.uid;
    
    const fetchColl = async (name: string, userScoped = true) => {
        const collRef = collection(db, name);
        const q = userScoped ? query(collRef, where("userId", "==", uid)) : query(collRef);
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, deleted: data.deleted === true, isActive: data.isActive !== false };
        });
    };

    const [acc, tx, cat, card, goal, chal, rec, cells] = await Promise.all([
        fetchColl("accounts"),
        fetchColl("transactions"),
        fetchColl("categories", false),
        fetchColl("cards"),
        fetchColl("goals"),
        fetchColl("challenges"),
        fetchColl("receivables"),
        fetchColl("challenge_cells")
    ]);

    return { 
        accounts: acc as FinanceAccount[], 
        transactions: (tx as Transaction[]).filter(t => !t.deleted), 
        categories: cat as TransactionCategory[], 
        cards: card as CreditCard[], 
        goals: goal as any[], 
        challenges: chal as any[], 
        receivables: rec as Receivable[], 
        cells: cells as any[] 
    };
};

export const saveSingleSale = async (sale: Sale) => {
    if (!auth.currentUser) return;
    const docRef = doc(db, "sales", sale.id);
    await setDoc(docRef, { 
        ...sale, 
        userId: auth.currentUser.uid, 
        deleted: sale.deleted || false,
        updatedAt: serverTimestamp() 
    });
};

export const saveSales = async (sales: Sale[]) => {
    if (!auth.currentUser) return;
    const batch = writeBatch(db);
    const uid = auth.currentUser.uid;
    sales.forEach(sale => {
        const saleRef = doc(db, "sales", sale.id);
        batch.set(saleRef, { 
            ...sale, 
            userId: uid, 
            deleted: sale.deleted || false,
            updatedAt: serverTimestamp() 
        });
    });
    await batch.commit();
};

export const getClients = async (): Promise<Client[]> => {
    if (!auth.currentUser) return [];
    const q = query(collection(db, "clients"), where("userId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, deleted: data.deleted === true, isActive: data.isActive !== false } as Client;
    }).filter(c => !c.deleted && c.isActive);
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

export const saveFinanceData = async (acc: FinanceAccount[], cards: CreditCard[], txs: Transaction[], cats: TransactionCategory[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const batch = writeBatch(db);
    acc.forEach(a => batch.set(doc(db, "accounts", a.id), { ...a, userId: uid, deleted: a.deleted || false, updatedAt: serverTimestamp() }));
    cards.forEach(c => batch.set(doc(db, "cards", c.id), { ...c, userId: uid, deleted: c.deleted || false, updatedAt: serverTimestamp() }));
    txs.forEach(t => batch.set(doc(db, "transactions", t.id), { ...t, userId: uid, deleted: t.deleted || false, updatedAt: serverTimestamp() }));
    await batch.commit();
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
    const col = type === ProductType.BASICA ? "commission_basic" : (type === ProductType.NATAL ? "commission_natal" : "commission_custom");
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
    const col = type === ProductType.BASICA ? "commission_basic" : (type === ProductType.NATAL ? "commission_natal" : "commission_custom");
    const batch = writeBatch(db);
    rules.forEach(r => batch.set(doc(db, col, r.id), r));
    await batch.commit();
};

export const getSystemConfig = async () => {
    const docRef = doc(db, "config", "system_config");
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as SystemConfig;
    return DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (c: SystemConfig) => {
    await setDoc(doc(db, "config", "system_config"), c);
};

export const getInvoiceMonth = (date: string, closingDay: number) => date.substring(0, 7);
export const getTrashItems = async () => ({ sales: [], transactions: [] });
export const hardResetLocalData = () => { localStorage.clear(); window.location.reload(); };
export const getUserPlanLabel = (u: User) => u.role;
export const calculateProductivityMetrics = async (u: string) => ({ totalClients: 0, activeClients: 0, convertedThisMonth: 0, conversionRate: 0, productivityStatus: 'GREEN' as const });
export const getReportConfig = async () => DEFAULT_REPORT_CONFIG;
export const saveReportConfig = async (c: any) => {};
export const exportReportToCSV = (d:any, f:any) => {};
export const readExcelFile = async (f:any) => [];
export const processSalesImport = (a:any, b:any) => [];
export const processFinanceImport = (a:any, b:any) => [];
export const getDeletedClients = async () => [];
export const restoreClient = async (id:string) => {};
export const permanentlyDeleteClient = async (id:string) => {};
export const analyzeMonthlyVolume = (s:any, m:any) => [];
export const exportEncryptedBackup = async (p:string) => {};
export const importEncryptedBackup = async (f:any, p:string) => {};
export const clearAllSales = () => {};
export const restoreItem = async (t:any, i:any) => {};
export const permanentlyDeleteItem = async (t:any, id:string) => {};
export const generateFinanceTemplate = () => {};
export const findPotentialDuplicates = (s:any) => [];
export const smartMergeSales = (s:any) => s[0];
