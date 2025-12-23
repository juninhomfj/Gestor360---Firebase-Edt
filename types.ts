
export type AppMode = 'SALES' | 'FINANCE' | 'WHATSAPP';
export type AppTheme = 'glass' | 'neutral' | 'rose' | 'cyberpunk' | 'dark';
export type UserRole = 'DEV' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

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

/**
 * Added UserKeys interface for AI configuration
 */
export interface UserKeys {
    isGeminiEnabled: boolean;
    aiPermissions?: {
        canCreateTransactions: boolean;
        canSearchWeb: boolean;
    };
}

/**
 * Added FinancialProfile interface for user finance settings
 */
export interface FinancialProfile {
    salaryDays: number[];
    salaryDay?: number;
}

/**
 * Added UserModules as an alias for UserPermissions
 */
export type UserModules = UserPermissions;

export interface User {
    id: string;
    uid: string; // Firebase Auth UID
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
    // Added missing properties found in components
    modules?: UserModules;
    financialProfile?: FinancialProfile;
    contactVisibility?: 'PUBLIC' | 'PRIVATE';
}

// Interfaces auxiliares mantidas para compatibilidade
export type SystemModules = Partial<UserPermissions>;

// --- MÓDULO CLIENTES & CRM ---
export type ClientStatus = 'ATIVO' | 'AZINHO' | 'PROSPECÇÃO' | 'INATIVO' | 'IR_RODIZIO';
export type BenefitProfile = 'BASICA' | 'NATAL' | 'AMBOS';

export interface Client {
    id: string;
    clientCode?: string;
    name: string;
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
  deleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
  trackingCode?: string;
  quoteDate?: string;
  marketingCampaignId?: string;
}

/**
 * Added SaleFormData for bulk import operations
 */
export type SaleFormData = Partial<Sale>;

export interface FinanceAccount {
    id: string;
    name: string;
    type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'INTERNAL';
    balance: number;
    isAccounting: boolean;
    includeInDistribution: boolean;
    personType?: 'PF' | 'PJ';
    color?: string;
    deleted?: boolean;
    createdAt?: any;
}

export interface CreditCard {
    id: string;
    name: string;
    limit: number;
    currentInvoice: number;
    closingDay: number;
    dueDay: number;
    color: string;
    personType: 'PF' | 'PJ';
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
    personType?: 'PF' | 'PJ';
    subcategory?: string;
    deleted?: boolean;
    deletedAt?: string;
    updatedAt?: string;
    targetAccountId?: string;
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
    type: 'INCOME' | 'EXPENSE' | 'GENERIC';
    personType?: 'PF' | 'PJ';
    subcategories: string[];
    monthlyBudget?: number;
    deleted?: boolean;
}

export interface ProductLabels {
    basica: string;
    natal: string;
    custom: string;
}

export interface SystemConfig {
    theme?: AppTheme;
    modules?: UserPermissions;
    productLabels?: ProductLabels;
    notificationSound?: string;
    alertSound?: string;
    successSound?: string;
    warningSound?: string;
    includeNonAccountingInTotal?: boolean;
    bootstrapVersion?: number;
    environment?: string;
    initializedAt?: any;
    // Added missing properties found in components
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

export interface CommissionDeduction {
    id: string;
    description: string;
    amount: number;
}

export interface ProductivityMetrics { totalClients: number; activeClients: number; convertedThisMonth: number; conversionRate: number; productivityStatus: 'GREEN' | 'YELLOW' | 'RED'; }
export interface SalesGoal { id: string; month: string; targetQuantity: number; targetRevenue: number; userId: string; updatedAt: string; }

export interface FinanceGoal {
    id: string;
    name: string;
    description: string;
    targetValue: number;
    currentValue: number;
    status: 'ACTIVE' | 'COMPLETED';
}

export interface Receivable { id: string; description: string; value: number; date: string; status: 'PENDING' | 'EFFECTIVE'; distributed: boolean; deductions?: CommissionDeduction[]; }
export interface FinancialPacing { daysRemaining: number; safeDailySpend: number; pendingExpenses: number; nextIncomeDate: Date; }
export interface DuplicateGroup<T> { id: string; items: T[]; }

/**
 * Added SyncTable type for database operations
 */
export type SyncTable = 'users' | 'sales' | 'accounts' | 'transactions' | 'clients' | 'client_transfer_requests' | 'commission_basic' | 'commission_natal' | 'commission_custom' | 'config' | 'cards' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'wa_contacts' | 'wa_tags' | 'wa_campaigns' | 'wa_queue' | 'wa_manual_logs' | 'wa_campaign_stats' | 'internal_messages' | 'audit_log';

export interface SyncEntry { id: number; table: string; type: string; status: 'PENDING' | 'SYNCED' | 'FAILED'; timestamp: number; data: any; rowId: string; retryCount: number; }

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
export interface LogEntry { timestamp: number; level: LogLevel; message: string; details?: any; userAgent?: string; }

export interface WAContact { id: string; name: string; phone: string; tags: string[]; createdAt: string; updatedAt: string; deleted?: boolean; source?: string; variables?: Record<string, string>; deletedAt?: string; }
export interface WATag { id: string; name: string; deleted?: boolean; updatedAt: string; }
export interface WACampaign { id: string; name: string; status: string; totalContacts: number; sentCount: number; messageTemplate: string; targetTags: string[]; config: { speed: 'FAST' | 'SAFE' | 'SLOW'; startTime: string; endTime: string; }; abTest?: any; media?: any; archived?: boolean; deleted?: boolean; createdAt: string; updatedAt: string; }
export interface WAMessageQueue { id: string; campaignId: string; contactId: string; phone: string; message: string; status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'; variant: 'A' | 'B'; media?: any; sentAt?: string; deleted?: boolean; }

export interface ManualInteractionLog { 
    id: string; 
    campaignId: string; 
    contactId: string; 
    phone: string; 
    startedAt: string; 
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED'; 
    messageLength: number; 
    tags: string[]; 
    campaignSpeed: string; 
    deviceInfo: any; 
    completedAt?: string; 
    totalInteractionTime?: number; 
    userReportedError?: any; 
    userNotes?: string; 
    rating?: 1|2|3|4|5; 
    variant?: 'A'|'B';
    messageCopiedAt?: string;
    mediaCopiedAt?: string;
    whatsappOpenedAt?: string;
    messagePastedAt?: string;
    messageSentAt?: string;
    timeToOpenWhatsApp?: number;
    timeToPaste?: number;
    timeToSend?: number;
}

export interface CampaignStatistics { campaignId: string; generatedAt: string; totalContacts: number; attempted: number; completed: number; skipped: number; failed: number; averageTimePerContact: number; fastestContactTime: number; slowestContactTime: number; totalCampaignTime: number; stepAnalysis: any; errorAnalysis: any; userRatings: any; insights: any[]; performanceBySpeed: any; financialImpact?: any; abTestAnalysis?: any; }
export interface WAInstance { id: string; name: string; status: string; batteryLevel?: number; createdAt: string; phone?: string; profilePicUrl?: string; }
export interface InternalMessage { id: string; senderId: string; senderName: string; recipientId: string; content: string; timestamp: string; read: boolean; readBy?: string[]; image?: string; type?: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST'; relatedModule?: 'sales' | 'finance' | 'ai'; }
export interface AppNotification { id: string; title: string; message: string; type: string; source: string; date: string; }
export interface ClientTransferRequest { id: string; clientId: string; fromUserId: string; toUserId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; message: string | null; createdAt: string; updatedAt: string; }

export type ImportMapping = Record<string, number>;
export type PersonType = 'PF' | 'PJ';

/**
 * Added WASpeed type for WhatsApp campaigns
 */
export type WASpeed = 'FAST' | 'SAFE' | 'SLOW';

/**
 * Added WhatsAppErrorCode for feedback reporting
 */
export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';

/**
 * Added WAMediaType for campaign media attachments
 */
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

/**
 * Added WASyncConfig for WhatsApp settings
 */
export interface WASyncConfig {
    tablesToSync: string[];
    syncFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MANUAL';
    includeErrorDetails: boolean;
    compressLogsOlderThan: number;
}

/**
 * Added WASyncPayload for sync operations
 */
export interface WASyncPayload {
    contacts: WAContact[];
    campaigns: WACampaign[];
    deliveryLogs: any[];
    campaignStats: CampaignStatistics[];
    syncMetadata: {
        timestamp: string;
        deviceId: string;
        version: string;
        tablesIncluded: string[];
        recordCounts: Record<string, number>;
    };
}

/**
 * Added AudioType for system events
 */
export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';

export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';
export interface Challenge { id: string; name: string; targetValue: number; depositCount: number; model: ChallengeModel; createdAt: string; status: 'ACTIVE' | 'COMPLETED'; }
export interface ChallengeCell { id: string; challengeId: string; number: number; value: number; status: 'PENDING' | 'PAID'; paidDate?: string; }

/**
 * Added AiUsageStats for tracking AI quotas
 */
export interface AiUsageStats {
    date: string;
    requestsCount: number;
    inputTokensApprox: number;
    outputTokensApprox: number;
    lastRequestTime: number;
}
