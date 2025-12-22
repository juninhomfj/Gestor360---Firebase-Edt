
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

export type SystemModules = UserModules;

export interface User {
    id: string;
    username: string; // Login alternativo único
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
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
    keys?: {
        isGeminiEnabled: boolean;
        aiPermissions?: {
            canCreateTransactions: boolean;
            canSearchWeb: boolean;
        };
    };
    contactVisibility?: 'PUBLIC' | 'PRIVATE';
    financialProfile?: {
        salaryDays?: number[];
    };
}

export type UserKeys = User['keys'];

// --- MÓDULO CLIENTES & CRM ---
export type ClientStatus = 'ATIVO' | 'AZINHO' | 'PROSPECÇÃO' | 'INATIVO' | 'IR_RODIZIO';
export type BenefitProfile = 'BASICA' | 'NATAL' | 'AMBOS';

export interface Client {
    id: string;
    name: string;
    companyName: string;
    contactName: string;
    status: ClientStatus;
    benefitProfile: BenefitProfile;
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
}

export interface CreditCard {
    id: string;
    name: string;
    limit: number;
    currentInvoice: number;
    closingDay: number;
    dueDay: number;
    color: string;
    personType: PersonType;
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
    type: 'INCOME' | 'EXPENSE';
    personType?: 'PF' | 'PJ';
    subcategories: string[];
    monthlyBudget?: number;
}

export interface ProductLabels {
    basica: string;
    natal: string;
    custom: string;
}

export interface SystemConfig {
    theme?: AppTheme;
    modules?: UserModules;
    productLabels?: ProductLabels;
    notificationSound?: string;
    alertSound?: string;
    successSound?: string;
    warningSound?: string;
    includeNonAccountingInTotal?: boolean;
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
export interface SyncEntry { id: number; table: string; type: string; status: 'PENDING' | 'SYNCED' | 'FAILED'; timestamp: number; data: any; rowId: string; retryCount: number; }

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
export interface LogEntry { timestamp: number; level: LogLevel; message: string; details?: any; userAgent?: string; }

export interface WAContact { id: string; name: string; phone: string; tags: string[]; createdAt: string; updatedAt: string; deleted?: boolean; source?: string; variables?: Record<string, string>; deletedAt?: string; }
export interface WATag { id: string; name: string; deleted?: boolean; updatedAt: string; }
export interface WACampaign { id: string; name: string; status: string; totalContacts: number; sentCount: number; messageTemplate: string; targetTags: string[]; config: { speed: WASpeed; startTime: string; endTime: string; }; abTest?: any; media?: any; archived?: boolean; deleted?: boolean; createdAt: string; updatedAt: string; }
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

export interface AiUsageStats {
    date: string;
    requestsCount: number;
    inputTokensApprox: number;
    outputTokensApprox: number;
    lastRequestTime: number;
}

export interface WASyncConfig {
  tablesToSync: string[];
  syncFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MANUAL';
  includeErrorDetails: boolean;
  compressLogsOlderThan: number;
}

export interface WASyncPayload {
    contacts: any[];
    campaigns: any[];
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

export type ImportMapping = Record<string, number>;
export type PersonType = 'PF' | 'PJ';
export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type WASpeed = 'FAST' | 'SAFE' | 'SLOW';
export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';
export interface Challenge { id: string; name: string; targetValue: number; depositCount: number; model: ChallengeModel; createdAt: string; status: 'ACTIVE' | 'COMPLETED'; }
export interface ChallengeCell { id: string; challengeId: string; number: number; value: number; status: 'PENDING' | 'PAID'; paidDate?: string; }

export type SyncTable = 'users' | 'sales' | 'accounts' | 'transactions' | 'clients' | 'client_transfer_requests' | 'commission_basic' | 'commission_natal' | 'commission_custom' | 'config' | 'cards' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'wa_contacts' | 'wa_tags' | 'wa_campaigns' | 'wa_queue' | 'wa_manual_logs' | 'wa_campaign_stats';
