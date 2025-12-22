
export type AppMode = 'SALES' | 'FINANCE' | 'WHATSAPP';
export type AppTheme = 'glass' | 'neutral' | 'rose' | 'cyberpunk' | 'dark';
export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

// Adding missing type definitions
export type PersonType = 'PF' | 'PJ';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
export type WASpeed = 'FAST' | 'SAFE' | 'SLOW';
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';
export type SyncTable = 'users' | 'sales' | 'accounts' | 'transactions' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'wa_contacts' | 'wa_tags' | 'wa_campaigns' | 'wa_queue' | 'wa_manual_logs' | 'wa_campaign_stats' | 'internal_messages' | 'clients' | 'client_transfer_requests' | 'config';
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';

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

// SystemModules exported as an extension of UserModules to match component imports
export interface SystemModules extends UserModules {}

// UserKeys for AI and automation configuration
export interface UserKeys {
    isGeminiEnabled: boolean;
    // Fixed: Removed geminiApiKey to satisfy centralized management guidelines.
    aiPermissions?: {
        canCreateTransactions: boolean;
        canSearchWeb: boolean;
    };
}

export interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    tel?: string;
    role: UserRole;
    profilePhoto?: string;
    theme: AppTheme;
    userStatus: UserStatus;
    createdAt: string;
    modules: UserModules;
    chat_config: {
        public_access: boolean;
        private_enabled: boolean;
    };
    // Fixed: Removed geminiApiKey as keys are now strictly managed via process.env.API_KEY.
    // Properties used in Layout and Dashboard
    keys?: UserKeys;
    financialProfile?: {
        salaryDays?: number[];
        salaryDay?: number;
    };
    contactVisibility?: 'PUBLIC' | 'PRIVATE';
}

export enum ProductType {
  BASICA = 'BASICA',
  NATAL = 'NATAL',
  CUSTOM = 'CUSTOM'
}

export interface CommissionRule {
  id: string;
  minPercent: number;
  maxPercent: number | null;
  commissionRate: number;
}

export interface SaleFormData {
  client: string;
  clientId?: string;
  quantity: number;
  type: ProductType;
  valueProposed: number;
  valueSold: number;
  date: string;
  completionDate: string;
  observations: string;
  marginPercent: number;
  marketingCampaignId?: string;
  quoteNumber?: string;
  trackingCode?: string;
}

export interface Sale extends SaleFormData {
  id: string;
  commissionBaseTotal: number;
  commissionValueTotal: number;
  commissionRateUsed: number;
  deleted?: boolean;
  deletedAt?: string;
  // Added missing createdAt property
  createdAt?: Date | string;
  boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
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

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    categoryId: string;
    subcategory?: string;
    personType?: 'PF' | 'PJ';
    accountId: string;
    targetAccountId?: string;
    isPaid: boolean;
    attachments?: string[];
    cardId?: string | null;
    updatedAt?: string;
    deleted?: boolean;
    deletedAt?: string;
    // Added missing createdAt property
    createdAt?: Date | string;
}

export interface CreditCard {
    id: string;
    name: string;
    limit: number;
    currentInvoice: number;
    closingDay: number;
    dueDay: number;
    color: string;
    personType?: 'PF' | 'PJ';
}

export interface TransactionCategory {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    personType?: 'PF' | 'PJ';
    subcategories: string[];
    monthlyBudget?: number;
}

export interface FinanceGoal {
    id: string;
    name: string;
    description?: string;
    targetValue: number;
    currentValue: number;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface Challenge {
    id: string;
    name: string;
    targetValue: number;
    depositCount: number;
    model: 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';
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

export interface Receivable {
    id: string;
    description: string;
    value: number;
    date: string;
    status: 'PENDING' | 'EFFECTIVE';
    distributed: boolean;
    deductions?: CommissionDeduction[];
}

export interface CommissionDeduction {
    id: string;
    description: string;
    amount: number;
}

export interface SystemConfig {
    theme?: AppTheme;
    customFavicon?: string;
    appTitle?: string;
    notificationSound?: string;
    alertSound?: string;
    successSound?: string;
    warningSound?: string;
    lastBackupDate?: string;
    includeNonAccountingInTotal?: boolean;
    supportEmail?: string;
    supportTelegram?: string;
    productLabels?: ProductLabels;
    modules?: UserModules;
    globalGoogleClientId?: string;
    globalGoogleApiKey?: string;
}

export interface ProductLabels {
  basica: string;
  natal: string;
  custom: string;
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

export interface SalesTargets {
    basic: number;
    natal: number;
}

export interface InternalMessage {
    id: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    content: string;
    image?: string;
    type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST';
    timestamp: string;
    read: boolean;
    relatedModule?: 'sales' | 'finance' | 'ai';
    readBy?: string[];
}

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'ALERT' | 'MESSAGE';
    source: 'SYSTEM' | 'SALES' | 'FINANCE' | 'WHATSAPP';
    date: string;
    read: boolean;
}

export interface Client {
    id: string;
    name: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    deleted: boolean;
    deletedAt?: string;
    notes?: string;
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

export interface ClientMetric {
    name: string;
    status: 'ACTIVE' | 'NEW' | 'INACTIVE' | 'LOST';
    totalOrders: number;
    totalSpent: number;
    lastPurchaseDate: string;
    daysSinceLastPurchase: number;
}

export interface FinancialPacing {
    daysRemaining: number;
    safeDailySpend: number;
    pendingExpenses: number;
    nextIncomeDate: Date;
}

export interface ImportMapping {
    [key: string]: number;
}

export interface AiUsageStats {
    date: string;
    requestsCount: number;
    inputTokensApprox: number;
    outputTokensApprox: number;
    lastRequestTime: number;
}

export interface DuplicateGroup<T> {
    id: string;
    items: T[];
}

export interface SyncEntry {
    id?: number;
    table: SyncTable;
    type: SyncOperation;
    data: any;
    rowId: string;
    status: 'PENDING' | 'SYNCED' | 'ERROR';
    timestamp: number;
    retryCount: number;
    error?: string;
}

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
    variables?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
    deleted?: boolean;
    deletedAt?: string;
    source?: 'MANUAL' | 'IMPORT';
}

export interface WATag {
    id: string;
    name: string;
    deleted?: boolean;
    updatedAt?: string;
}

export interface WACampaign {
    id: string;
    name: string;
    messageTemplate: string;
    targetTags: string[];
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
    totalContacts: number;
    sentCount: number;
    config: {
        speed: WASpeed;
        startTime: string;
        endTime: string;
    };
    createdAt: string;
    updatedAt: string;
    archived?: boolean;
    deleted?: boolean;
    abTest?: {
        enabled: boolean;
        templateB: string;
    };
    media?: {
        data: string;
        type: WAMediaType;
        name: string;
    };
}

export interface WAMessageQueue {
    id: string;
    campaignId: string;
    contactId: string;
    phone: string;
    message: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    variant: 'A' | 'B';
    sentAt?: string;
    deleted?: boolean;
    media?: {
        data: string;
        type: WAMediaType;
        name: string;
    };
}

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
    messageCopiedAt?: string;
    whatsappOpenedAt?: string;
    messagePastedAt?: string;
    messageSentAt?: string;
    completedAt?: string;
    timeToOpenWhatsApp?: number;
    timeToPaste?: number;
    timeToSend?: number;
    totalInteractionTime?: number;
    userNotes?: string;
    rating?: 1 | 2 | 3 | 4 | 5;
    variant?: 'A' | 'B';
    userReportedError?: {
        type: WhatsAppErrorCode;
        description: string;
        screenshot?: string;
    };
    mediaCopiedAt?: string;
}

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
        mostCommonError?: WhatsAppErrorCode;
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
    financialImpact: {
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

export interface WAInstance {
    id: string;
    name: string;
    status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING';
    batteryLevel?: number;
    createdAt: string;
    phone?: string;
    profilePicUrl?: string;
}

export type WAManualLog = ManualInteractionLog;
