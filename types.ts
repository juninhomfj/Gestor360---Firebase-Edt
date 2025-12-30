export type AppMode = 'SALES' | 'FINANCE' | 'WHATSAPP';
export type AppTheme = 'glass' | 'neutral' | 'rose' | 'cyberpunk' | 'dark';
export type UserRole = 'DEV' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface UserPermissions {
    sales: boolean;
    finance: boolean;
    whatsapp: boolean;
    crm: boolean;
    ai: boolean;
    dev: boolean;
    reports: boolean;
    news: boolean;
    receivables: boolean;
    distribution: boolean;
    imports: boolean;
    settings: boolean;
}

export interface UserKeys {
    isGeminiEnabled: boolean;
    aiPermissions?: {
        canCreateTransactions: boolean;
        canSearchWeb: boolean;
    };
}

export interface FinancialProfile {
    salaryDays: number[];
    salaryDay?: number;
}

export type UserModules = UserPermissions;

export interface User {
    id: string;
    uid: string;
    username: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    theme: AppTheme;
    userStatus: UserStatus;
    createdAt: string;
    updatedAt: string;
    permissions: UserPermissions;
    profilePhoto?: string;
    tel?: string;
    chat_config?: {
        public_access: boolean;
        private_enabled: boolean;
    };
    keys?: UserKeys;
    modules?: UserModules;
    financialProfile?: FinancialProfile;
    contactVisibility?: 'PUBLIC' | 'PRIVATE';
    fcmToken?: string;
}

export type SystemModules = Partial<UserPermissions>;

export interface ProductLabels {
    basica: string;
    natal: string;
    custom: string;
}

export interface SystemConfig {
    notificationSounds?: {
        enabled: boolean;
        volume: number;
        sound: string;
    };
    notificationSound?: string;
    alertSound?: string;
    successSound?: string;
    warningSound?: string;
    includeNonAccountingInTotal?: boolean;
    bootstrapVersion?: number;
    productLabels?: ProductLabels;
    environment?: string;
    supportEmail?: string;
    supportTelegram?: string;
    fcmServerKey?: string;
    modules?: UserPermissions;
}

export interface UserPreferences {
    theme?: AppTheme;
    hideValues?: boolean;
    lastMode?: AppMode;
    lastTab?: string;
}

export interface NtfyPayload {
    topic: string;
    message: string;
    title?: string;
    priority?: "min" | "low" | "default" | "high" | "urgent";
    tags?: string[];
}

export interface NtfyEvent {
    id: string;
    topic: string;
    title: string;
    message: string;
    priority: 1 | 2 | 3 | 4 | 5;
    tags: string[];
    category: 'SYSTEM' | 'FINANCE' | 'ADMIN';
    timestamp: number;
}

export interface InternalMessage { 
    id: string; 
    senderId: string; 
    senderName: string; 
    recipientId: string; 
    content: string; 
    title?: string; 
    timestamp: string; 
    read: boolean; 
    readBy?: string[]; 
    image?: string; 
    type?: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' | 'SYSTEM'; 
    relatedModule?: 'sales' | 'finance' | 'ai'; 
}

export enum ProductType { BASICA = 'BASICA', NATAL = 'NATAL', CUSTOM = 'CUSTOM' }
export type SaleStatus = 'ORÇAMENTO' | 'PROPOSTA' | 'FATURADO';

export interface Sale { 
    id: string; 
    client: string; 
    clientId?: string; 
    userId?: string; 
    quantity: number; 
    type: ProductType; 
    valueProposed: number; 
    valueSold: number; 
    status: SaleStatus; 
    marginPercent: number; 
    commissionBaseTotal: number; 
    commissionValueTotal: number; 
    commissionRateUsed: number; 
    date?: string; 
    completionDate: string; 
    isBilled: boolean; 
    hasNF: boolean; 
    observations: string; 
    deleted: boolean; 
    deletedAt?: string; 
    createdAt: string; 
    updatedAt?: string; 
    trackingCode?: string; 
    boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
    quoteDate?: string;
}

export interface FinanceAccount { 
    id: string; 
    name: string; 
    type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'INTERNAL'; 
    balance: number; 
    isActive: boolean; 
    isAccounting: boolean; 
    includeInDistribution: boolean; 
    personType?: PersonType; 
    deleted: boolean; 
    userId: string; 
    color?: string;
    createdAt?: string;
}

export interface CreditCard { 
    id: string; 
    name: string; 
    limit: number; 
    currentInvoice: number; 
    closingDay: number; 
    dueDay: number; 
    personType: PersonType; 
    isActive: boolean; 
    deleted: boolean; 
    userId: string; 
    color?: string;
}

export interface Transaction { 
    id: string; 
    description: string; 
    amount: number; 
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; 
    date: string; 
    categoryId: string; 
    accountId: string; 
    isPaid: boolean; 
    personType?: PersonType; 
    deleted: boolean; 
    createdAt: string; 
    userId: string; 
    targetAccountId?: string;
    updatedAt?: string;
    deletedAt?: string;
    attachments?: string[];
    subcategory?: string;
    paymentMethod?: string;
    installments?: number;
    costCenter?: string;
    tags?: string[];
    cardId?: string | null;
}

export interface TransactionCategory { 
    id: string; 
    name: string; 
    type: 'INCOME' | 'EXPENSE' | 'GENERIC'; 
    subcategories: string[]; 
    monthlyBudget?: number; 
    isActive: boolean; 
    deleted: boolean; 
    userId: string; 
    personType?: PersonType;
}

export interface FinanceGoal { 
    id: string; 
    name: string; 
    targetValue: number; 
    currentValue: number; 
    status: 'ACTIVE' | 'COMPLETED'; 
    userId: string; 
    deleted: boolean; 
    description?: string;
}

export interface Challenge { 
    id: string; 
    name: string; 
    targetValue: number; 
    depositCount: number; 
    model: ChallengeModel; 
    status: 'ACTIVE' | 'COMPLETED'; 
    userId: string; 
    deleted: boolean; 
    createdAt?: string;
}

export interface ChallengeCell { 
    id: string; 
    challengeId: string; 
    number: number; 
    value: number; 
    status: 'PENDING' | 'PAID'; 
    userId: string; 
    deleted: boolean; 
    paidDate?: string;
}

export interface Receivable { 
    id: string; 
    description: string; 
    value: number; 
    date: string; 
    status: 'PENDING' | 'EFFECTIVE'; 
    distributed: boolean; 
    userId: string; 
    deleted: boolean; 
    deductions?: CommissionDeduction[]; 
}

export interface CommissionRule { id: string; minPercent: number; maxPercent: number | null; commissionRate: number; isActive: boolean; }
export interface ProductivityMetrics { totalClients: number; activeClients: number; convertedThisMonth: number; conversionRate: number; productivityStatus: 'GREEN' | 'YELLOW' | 'RED'; }
export interface ReportConfig { daysForNewClient: number; daysForInactive: number; daysForLost: number; }

export interface Client { 
    id: string; 
    name: string; 
    status: string; 
    benefitProfile: string; 
    monthlyQuantityDeclared: number; 
    userId: string; 
    createdAt: string; 
    deleted: boolean; 
    updatedAt?: string;
    deletedAt?: string;
    notes?: string;
}

export interface DashboardWidgetConfig { showStats: boolean; showCharts: boolean; showRecents: boolean; showPacing?: boolean; showBudgets?: boolean; }
export interface SalesTargets { basic: number; natal: number; }
export interface ImportMapping { [key: string]: number; }
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
export interface LogEntry { timestamp: number; level: LogLevel; message: string; details?: any; userAgent?: string; }

export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'ALERT';
    source: 'SALES' | 'FINANCE' | 'WHATSAPP' | 'SYSTEM';
    date: string;
    read: boolean;
}

export interface FinancialPacing {
    daysRemaining: number;
    safeDailySpend: number;
    pendingExpenses: number;
    nextIncomeDate: Date;
}

export type PersonType = 'PF' | 'PJ';

export interface SaleFormData {
    client: string;
    quantity: number;
    type: ProductType;
    valueProposed: number;
    valueSold: number;
    marginPercent: number;
    date: string;
    completionDate: string;
    isBilled: boolean;
    observations?: string;
}

export interface AiUsageStats {
    totalTokens: number;
    requestCount: number;
}

export interface DuplicateGroup<T> {
    id: string;
    items: T[];
}

export type SyncTable = 'users' | 'sales' | 'accounts' | 'transactions' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'clients' | 'client_transfer_requests' | 'config';

export interface SyncEntry {
    id: number;
    table: SyncTable;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    data: any;
    rowId: string;
    status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
    timestamp: number;
    retryCount: number;
}

export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';

export interface CommissionDeduction {
    id: string;
    description: string;
    amount: number;
}

export interface WAContact {
    id: string;
    name: string;
    phone: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    deleted: boolean;
    userId: string;
    source?: string;
}

export interface WATag {
    id: string;
    name: string;
    userId: string;
    deleted: boolean;
}

export interface WACampaign {
    id: string;
    name: string;
    messageTemplate: string;
    targetTags: string[];
    status: 'DRAFT' | 'PENDING' | 'SENDING' | 'COMPLETED' | 'FAILED';
    totalContacts: number;
    sentCount: number;
    config: {
        speed: WASpeed;
        startTime: string;
        endTime: string;
    };
    abTest?: {
        enabled: boolean;
        templateB: string;
    };
    media?: {
        data: string;
        type: WAMediaType;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
    deleted: boolean;
    userId: string;
}

export type WASpeed = 'SAFE' | 'FAST' | 'INSTANT';
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export interface WAMessageQueue {
    id: string;
    campaignId: string;
    contactId: string;
    phone: string;
    message: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    variant: 'A' | 'B';
    media?: any;
    deleted: boolean;
    isSeed: boolean;
    userId: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface ManualInteractionLog {
    logId: string;
    campaignId: string;
    contactId: string;
    step: string;
    timestamp: string;
    phone?: string;
    speed?: string;
    messageCopiedAt?: string;
    mediaCopiedAt?: string;
    whatsappOpenedAt?: string;
    completedAt?: string;
}

export interface CampaignStatistics {
    campaignId: string;
    totalContacts: number;
    attempted: number;
    completed: number;
    failed: number;
    skipped: number;
    averageTimePerContact: number;
    errorAnalysis: {
        errorRate: number;
        byType: Record<string, number>;
    };
    performanceBySpeed: Record<string, {
        successRate: number;
        averageTime: number;
    }>;
    financialImpact?: {
        revenue: number;
        salesCount: number;
        conversionRate: number;
    };
    abTestAnalysis?: {
        winner: 'A' | 'B';
        variantA: { count: number; rate: number };
        variantB: { count: number; rate: number };
    };
    stepAnalysis: {
        averageTimeToOpenWhatsApp: number;
        averageTimeToPaste: number;
        averageTimeToSend: number;
    };
    userRatings: {
        average: number;
    };
    insights: Array<{ type: 'WARNING' | 'INFO', message: string }>;
}

export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';

export interface WASyncConfig {
    tablesToSync: SyncTable[];
    syncFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MANUAL';
    includeErrorDetails: boolean;
}

export interface Release {
    version: string;
    date: string;
    title: string;
    type: 'MAJOR' | 'MINOR' | 'PATCH';
    description: string;
    changes: Array<{ type: string; text: string }>;
}

export interface ClientTransferRequest {
    id: string;
    clientId: string;
    fromUserId: string;
    toUserId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    message: string | null;
    createdAt: string;
    updatedAt: string;
}