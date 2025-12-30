
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
    deleted: boolean;
    deletedAt?: string;
    notes?: string;
    isSeed?: boolean;
}

export enum ProductType {
  BASICA = 'BASICA',
  NATAL = 'NATAL',
  CUSTOM = 'CUSTOM'
}

export type SaleStatus = 'ORÇAMENTO' | 'PROPOSTA' | 'FATURADO';

export interface SaleFormData {
  client: string;
  clientId?: string;
  quantity: number;
  type: ProductType;
  valueProposed: number;
  valueSold: number;
  marginPercent: number;
  quoteDate?: string;
  completionDate: string;
  date?: string;
  isBilled: boolean;
  observations: string;
}

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
  boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
  trackingCode?: string;
  quoteDate?: string;
  marketingCampaignId?: string;
  isSeed?: boolean;
}

export interface FinanceAccount {
    id: string;
    name: string;
    type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'INTERNAL';
    balance: number;
    isActive: boolean;
    isAccounting: boolean;
    includeInDistribution: boolean;
    personType?: 'PF' | 'PJ';
    color?: string;
    deleted: boolean;
    createdAt: any;
    updatedAt?: any;
    userId: string;
    isSeed?: boolean;
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
    isActive: boolean;
    deleted: boolean;
    userId: string;
    isSeed?: boolean;
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
    deleted: boolean;
    deletedAt?: string;
    updatedAt?: string;
    targetAccountId?: string;
    attachments?: string[];
    cardId?: string | null;
    paymentMethod?: string;
    installments?: number;
    costCenter?: string;
    tags?: string[];
    createdAt: string;
    userId: string;
    isSeed?: boolean;
}

export interface TransactionCategory {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE' | 'GENERIC';
    personType?: 'PF' | 'PJ';
    subcategories: string[];
    monthlyBudget?: number;
    isActive: boolean;
    deleted: boolean;
    isSeed?: boolean;
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
    supportEmail?: string;
    supportTelegram?: string;
    fcmServerKey?: string;
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

export interface CommissionRule { 
    id: string; 
    minPercent: number; 
    maxPercent: number | null; 
    commissionRate: number; 
    isActive: boolean; 
    version?: number;
    updatedAt?: string;
    isSeed?: boolean; 
}

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
    userId: string;
    deleted: boolean;
    isSeed?: boolean;
}

export interface Receivable { id: string; description: string; value: number; date: string; status: 'PENDING' | 'EFFECTIVE'; distributed: boolean; deductions?: CommissionDeduction[]; userId: string; deleted: boolean; isSeed?: boolean; }
export interface FinancialPacing { daysRemaining: number; safeDailySpend: number; pendingExpenses: number; nextIncomeDate: Date; }
export interface DuplicateGroup<T> { id: string; items: T[]; }

export interface AiUsageStats {
    tokensUsed: number;
    requestsCount: number;
    lastRequestAt: string;
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

export type SyncTable = 'users' | 'sales' | 'accounts' | 'transactions' | 'clients' | 'client_transfer_requests' | 'commission_basic' | 'commission_natal' | 'commission_custom' | 'config' | 'cards' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'wa_contacts' | 'wa_tags' | 'wa_campaigns' | 'wa_queue' | 'wa_manual_logs' | 'wa_campaign_stats' | 'internal_messages' | 'audit_log';

export interface SyncEntry { id: number; table: string; type: string; status: 'PENDING' | 'SYNCED' | 'FAILED'; timestamp: number; data: any; rowId: string; retryCount: number; }

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
export interface LogEntry { timestamp: number; level: LogLevel; message: string; details?: any; userAgent?: string; }

export interface WAContact { id: string; name: string; phone: string; tags: string[]; createdAt: string; updatedAt: string; deleted: boolean; source?: string; variables?: Record<string, string>; deletedAt?: string; userId: string; isSeed?: boolean; }
export interface WATag { id: string; name: string; deleted: boolean; updatedAt: string; userId: string; isSeed?: boolean; }
export interface WACampaign { id: string; name: string; status: string; totalContacts: number; sentCount: number; messageTemplate: string; targetTags: string[]; config: { speed: 'FAST' | 'SAFE' | 'SLOW'; startTime: string; endTime: string; }; abTest?: any; media?: any; archived?: boolean; deleted: boolean; createdAt: string; updatedAt: string; userId: string; isSeed?: boolean; }
export interface WAMessageQueue { id: string; campaignId: string; contactId: string; phone: string; message: string; status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'; variant: 'A' | 'B'; media?: any; sentAt?: string; deleted: boolean; isSeed: boolean; userId: string; }

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
    userId: string;
    messageCopiedAt?: string;
    whatsappOpenedAt?: string;
    mediaCopiedAt?: string;
}

export interface CampaignStatistics { campaignId: string; generatedAt: string; totalContacts: number; attempted: number; completed: number; skipped: number; failed: number; averageTimePerContact: number; fastestContactTime: number; slowestContactTime: number; totalCampaignTime: number; stepAnalysis: any; errorAnalysis: any; userRatings: any; insights: any[]; performanceBySpeed: any; financialImpact?: any; abTestAnalysis?: any; }
export interface WAInstance { id: string; name: string; status: string; batteryLevel?: number; createdAt: string; phone?: string; profilePicUrl?: string; }
export interface InternalMessage { id: string; senderId: string; senderName: string; recipientId: string; content: string; timestamp: string; read: boolean; readBy?: string[]; image?: string; type?: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT'; relatedModule?: 'sales' | 'finance' | 'ai'; diagLog?: string; }
export interface AppNotification { id: string; title: string; message: string; type: string; source: string; date: string; }

export type ImportMapping = Record<string, number>;
export type PersonType = 'PF' | 'PJ';

export type WASpeed = 'FAST' | 'SAFE' | 'SLOW';
export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export interface WASyncConfig {
  tablesToSync: string[];
  syncFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MANUAL';
  includeErrorDetails: boolean;
  compressLogsOlderThan: number;
}

export interface WASyncPayload {
    contacts: WAContact[];
    campaigns: WACampaign[];
    deliveryLogs: any[];
    campaignStats: any[];
    syncMetadata: {
        timestamp: string;
        deviceId: string;
        version: string;
        tablesIncluded: string[];
        recordCounts: Record<string, number>;
    };
}

export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';

export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';
export interface Challenge { id: string; name: string; targetValue: number; depositCount: number; model: ChallengeModel; createdAt: string; status: 'ACTIVE' | 'COMPLETED'; userId: string; deleted: boolean; isSeed?: boolean; }
export interface ChallengeCell { id: string; challengeId: string; number: number; value: number; status: 'PENDING' | 'PAID'; paidDate?: string; userId: string; deleted: boolean; isSeed?: boolean; }

export interface ReleaseChange {
    type: 'NEW' | 'FIX' | 'SECURITY' | 'IMPROVE';
    text: string;
}

export interface Release {
    version: string;
    date: string;
    title: string;
    type: 'MAJOR' | 'MINOR' | 'PATCH';
    description: string;
    changes: ReleaseChange[];
}
