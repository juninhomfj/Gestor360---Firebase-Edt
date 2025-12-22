
export type AppMode = 'SALES' | 'FINANCE' | 'WHATSAPP';
export type AppTheme = 'glass' | 'neutral' | 'rose' | 'cyberpunk' | 'dark';
export type UserRole = 'DEV' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserModules {
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
}

/* Fix: Added SystemModules as an alias for UserModules to resolve Layout.tsx error */
export type SystemModules = UserModules;

export interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean; // Fonte única de bloqueio
    theme: AppTheme;
    userStatus: UserStatus;
    createdAt: string;
    modules: UserModules;
    profilePhoto?: string;
    tel?: string;
    chat_config?: {
        public_access: boolean;
        private_enabled: boolean;
    };
    keys?: UserKeys;
    contactVisibility?: 'PUBLIC' | 'PRIVATE';
    financialProfile?: {
        salaryDays?: number[];
    };
}

/* Fix: Added UserKeys interface */
export interface UserKeys {
    isGeminiEnabled: boolean;
    aiPermissions?: {
        canCreateTransactions: boolean;
        canSearchWeb: boolean;
    };
}

// --- MÓDULO CLIENTES & CRM ---
export type ClientStatus = 'ATIVO' | 'AZINHO' | 'PROSPECÇÃO' | 'INATIVO' | 'IR_RODIZIO';
export type BenefitProfile = 'BASICA' | 'NATAL' | 'AMBOS';

export interface Client {
    id: string;
    name: string;
    clientCode?: string;
    companyName: string;
    contactName: string;
    status: ClientStatus;
    benefitProfile: BenefitProfile;
    quotationDay?: number;
    monthlyQuantityDeclared: number;
    monthlyQuantityAverage: number;
    isActive: boolean;
    userId: string;
    createdAt: string;
    updatedAt: string;
    deleted?: boolean;
    deletedAt?: string;
    notes?: string;
}

export enum ProductType {
  BASICA = 'BASICA',
  NATAL = 'NATAL',
  CUSTOM = 'CUSTOM'
}

export type SaleStatus = 'ORÇAMENTO' | 'PROPOSTA' | 'FATURADO';

/* Fix: Added SaleFormData as an alias for Sale to resolve BoletoControl.tsx error */
export type SaleFormData = Partial<Sale>;

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
  quoteDate?: string;
  isBilled: boolean;
  hasNF: boolean;
  observations: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
  trackingCode?: string;
  /* Fix: Added marketingCampaignId property */
  marketingCampaignId?: string;
}

export interface FinanceAccount {
    id: string;
    name: string;
    type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'INTERNAL';
    balance: number;
    color?: string;
    isAccounting?: boolean;
    includeInDistribution?: boolean;
    personType?: 'PF' | 'PJ';
}

/* Fix: Added CreditCard interface */
export interface CreditCard {
    id: string;
    name: string;
    limit: number;
    currentInvoice: number;
    closingDay: number;
    dueDay: number;
    color?: string;
    personType?: 'PF' | 'PJ';
}

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    categoryId: string;
    accountId: string;
    /* Fix: Added targetAccountId property */
    targetAccountId?: string;
    isPaid: boolean;
    personType?: 'PF' | 'PJ';
    updatedAt?: string;
    deleted?: boolean;
    deletedAt?: string;
    /* Fix: Added attachments property */
    attachments?: string[];
    cardId?: string | null;
    paymentMethod?: string;
    installments?: number;
    costCenter?: string;
    tags?: string[];
    createdAt?: string;
}

export interface TransactionCategory {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    personType?: 'PF' | 'PJ';
    subcategories: string[];
    monthlyBudget?: number;
}

/* Fix: Updated SystemConfig with missing sound and support properties */
export interface SystemConfig {
    theme?: AppTheme;
    modules?: UserModules;
    productLabels?: { basica: string; natal: string; custom: string };
    includeNonAccountingInTotal?: boolean;
    notificationSound?: string;
    alertSound?: string;
    successSound?: string;
    warningSound?: string;
    supportEmail?: string;
    supportTelegram?: string;
}

export interface ReportConfig {
  daysForNewClient: number;
  daysForInactive: number;
  daysForLost: number;
}

export interface DashboardWidgetConfig {
    showStats: boolean;
    showCharts: boolean;
    showRecents: boolean;
    showPacing?: boolean;
    showBudgets?: boolean;
}

export interface SalesTargets { basic: number; natal: number; }
export interface CommissionRule { id: string; minPercent: number; maxPercent: number | null; commissionRate: number; }
export interface ProductivityMetrics { totalClients: number; activeClients: number; convertedThisMonth: number; conversionRate: number; productivityStatus: 'GREEN' | 'YELLOW' | 'RED'; }
export interface SalesGoal { id: string; month: string; targetQuantity: number; targetRevenue: number; userId: string; updatedAt: string; }

/* Fix: Added CommissionDeduction interface */
export interface CommissionDeduction {
    id: string;
    description: string;
    amount: number;
}

export interface Receivable {
    id: string;
    description: string;
    value: number;
    date: string;
    status: 'PENDING' | 'EFFECTIVE';
    distributed: boolean;
    deductions?: CommissionDeduction[];
}

export interface FinancialPacing { daysRemaining: number; safeDailySpend: number; pendingExpenses: number; nextIncomeDate: Date; }
export interface DuplicateGroup<T> { id: string; items: T[]; }

/* Fix: Updated SyncEntry and related types */
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type SyncTable = 'users' | 'sales' | 'accounts' | 'transactions' | 'config' | 'clients' | 'client_transfer_requests' | 'wa_contacts' | 'wa_campaigns' | 'wa_manual_logs' | 'wa_campaign_stats' | 'internal_messages';

export interface SyncEntry {
    id: number;
    table: string;
    type: string;
    status: 'PENDING' | 'SYNCED' | 'FAILED';
    timestamp: number;
    data: any;
    rowId: string;
    retryCount: number;
}

/* Fix: Updated LogEntry and LogLevel */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    details?: any;
    userAgent?: string;
}

export interface WAContact {
    id: string;
    name: string;
    phone: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    deleted?: boolean;
    deletedAt?: string;
    source?: string;
    /* Fix: Added variables property */
    variables?: Record<string, string>;
}

export interface WATag { id: string; name: string; deleted?: boolean; updatedAt: string; }

/* Fix: Updated WACampaign with missing properties */
export interface WACampaign {
    id: string;
    name: string;
    status: string;
    totalContacts: number;
    sentCount: number;
    messageTemplate: string;
    targetTags: string[];
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
    archived?: boolean;
    deleted?: boolean;
    createdAt: string;
    updatedAt: string;
}

/* Fix: Updated WAMessageQueue with missing properties */
export interface WAMessageQueue {
    id: string;
    campaignId: string;
    contactId: string;
    phone: string;
    message: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    variant: 'A' | 'B';
    media?: {
        data: string;
        type: WAMediaType;
        name: string;
    };
    sentAt?: string;
    deleted?: boolean;
}

export interface WAManualLog extends ManualInteractionLog {}

/* Fix: Updated ManualInteractionLog with many missing properties */
export interface ManualInteractionLog {
    id: string;
    campaignId: string;
    contactId: string;
    phone: string;
    startedAt: string;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    messageLength: number;
    tags: string[];
    campaignSpeed: WASpeed;
    deviceInfo: {
        userAgent: string;
        platform: string;
        isMobile: boolean;
    };
    completedAt?: string;
    messageCopiedAt?: string;
    mediaCopiedAt?: string;
    whatsappOpenedAt?: string;
    messagePastedAt?: string;
    messageSentAt?: string;
    timeToOpenWhatsApp?: number;
    timeToPaste?: number;
    timeToSend?: number;
    totalInteractionTime?: number;
    userReportedError?: {
        type: WhatsAppErrorCode;
        description: string;
        screenshot?: string;
    };
    userNotes?: string;
    rating?: 1 | 2 | 3 | 4 | 5;
    variant?: 'A' | 'B';
}

/* Fix: Updated CampaignStatistics with missing properties */
export interface CampaignStatistics {
    campaignId: string;
    generatedAt: string;
    totalContacts: number;
    attempted: number;
    completed: number;
    skipped: number;
    failed: number;
    averageTimePerContact: number;
    fastestContactTime: number;
    slowestContactTime: number;
    totalCampaignTime: number;
    stepAnalysis: {
        averageTimeToOpenWhatsApp: number;
        averageTimeToPaste: number;
        averageTimeToSend: number;
        bottlenecks: string[];
    };
    errorAnalysis: {
        totalErrors: number;
        byType: Record<string, number>;
        mostCommonError?: string;
        errorRate: number;
    };
    userRatings: {
        average: number;
        distribution: Record<number, number>;
    };
    insights: Array<{
        type: 'SUGGESTION' | 'WARNING' | 'RECOMMENDATION';
        message: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
    performanceBySpeed: Record<string, any>;
    financialImpact?: {
        revenue: number;
        salesCount: number;
        conversionRate: number;
    };
    abTestAnalysis?: {
        variantA: { count: number; success: number; rate: number };
        variantB: { count: number; success: number; rate: number };
        winner: 'A' | 'B' | 'TIE' | 'INCONCLUSIVE';
    };
}

export interface WAInstance { id: string; name: string; status: string; batteryLevel?: number; createdAt: string; phone?: string; profilePicUrl?: string; }

/* Fix: Updated InternalMessage with senderName property */
export interface InternalMessage {
    id: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    content: string;
    timestamp: string;
    read: boolean;
    readBy?: string[];
    image?: string;
    type?: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST';
    relatedModule?: 'sales' | 'finance' | 'ai';
}

export interface AppNotification { id: string; title: string; message: string; type: string; source: string; date: string; }

/* Fix: Updated ClientTransferRequest with missing properties */
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

/* Fix: Added missing types */
export type ImportMapping = Record<string, number>;
export type PersonType = 'PF' | 'PJ';
export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type WASpeed = 'FAST' | 'SAFE' | 'SLOW';
export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';

export interface WASyncConfig {
    tablesToSync: string[];
    syncFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MANUAL';
    includeErrorDetails: boolean;
    compressLogsOlderThan: number;
}

export interface WASyncPayload {
    contacts: WAContact[];
    campaigns: WACampaign[];
    deliveryLogs: ManualInteractionLog[];
    campaignStats: CampaignStatistics[];
    syncMetadata: {
        timestamp: string;
        deviceId: string;
        version: string;
        tablesIncluded: string[];
        recordCounts: Record<string, number>;
    };
}

/* Fix: Added AiUsageStats interface */
export interface AiUsageStats {
    date: string;
    requestsCount: number;
    inputTokensApprox: number;
    outputTokensApprox: number;
    lastRequestTime: number;
}

/* Fix: Added ProductLabels type */
export type ProductLabels = {
    basica: string;
    natal: string;
    custom: string;
};

/* Fix: Added FinanceGoal interface */
export interface FinanceGoal {
    id: string;
    name: string;
    description: string;
    targetValue: number;
    currentValue: number;
    status: 'ACTIVE' | 'COMPLETED';
}

/* Fix: Added Challenge and ChallengeCell interfaces */
export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';
export interface Challenge {
    id: string;
    name: string;
    targetValue: number;
    depositCount: number;
    model: ChallengeModel;
    createdAt: string;
    status: 'ACTIVE' | 'COMPLETED';
}
export interface ChallengeCell {
    id: string;
    challengeId: string;
    number: number;
    value: number;
    status: 'PENDING' | 'PAID';
    paidDate?: string;
}
