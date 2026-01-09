
// types.ts - Centralized Type Definitions for Gestor360 (v3.2.0)

export type AppMode = 'SALES' | 'FINANCE' | 'WHATSAPP' | 'FISCAL';

export type UserRole = 'USER' | 'ADMIN' | 'DEV';

export type UserStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

export interface UserPermissions {
  // Módulos Principais
  sales: boolean;
  finance: boolean;
  crm: boolean;
  whatsapp: boolean;
  reports: boolean;
  ai: boolean;
  dev: boolean;
  settings: boolean;
  news: boolean;
  fiscal: boolean;
  // Funções Granulares (Enterprise)
  abc_analysis: boolean;
  ltv_details: boolean;
  ai_retention: boolean;
  receivables: boolean;
  distribution: boolean;
  imports: boolean;
  manual_billing: boolean;
  audit_logs: boolean;
}

export interface UserPrefs {
  defaultModule?: string;
}

export type UserModules = UserPermissions;
export type SystemModules = UserPermissions;

export interface UserKeys {
  isGeminiEnabled?: boolean;
}

export type AppTheme = 'glass' | 'neutral' | 'rose' | 'cyberpunk' | 'dark';

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
  profilePhoto: string;
  tel: string;
  keys?: UserKeys;
  prefs?: UserPrefs;
  contactVisibility?: 'PUBLIC' | 'PRIVATE';
  fcmToken?: string;
  financialProfile?: {
    salaryDays?: number[];
    salaryDay?: number;
  };
}

// ... tipos restantes inalterados ...
// --- FISCAL 360 TYPES ---

export type TaxRegime = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO';

export interface Company {
  id: string;
  userId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  uf: string;
  municipio: string;
  enderecoFiscal: string;
  regimeTributario: TaxRegime;
  cnaePrincipal: { codigo: string; descricao: string };
  cnaesSecundarios: { codigo: string; descricao: string }[];
  taxProfileVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalPeriod {
  id: string;
  userId: string;
  companyId: string;
  year: number;
  month: number;
  grossRevenue: number;
  serviceRevenue?: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface TaxEstimate {
  id: string;
  userId: string;
  companyId: string;
  periodId: string;
  regimeTributario: TaxRegime;
  rulesVersion: string;
  items: { label: string; value: number; rate: number }[];
  total: number;
  generatedAt: string;
}

export interface TaxRule {
  id: string;
  regime: TaxRegime;
  version: string;
  effectiveFrom: string;
  tiers: { min: number; max: number; rate: number; label: string }[];
  isActive: boolean;
}

export interface Obligation {
  id: string;
  userId: string;
  companyId: string;
  type: string;
  dueDate: string;
  amount: number;
  recurrence: 'ONCE' | 'MONTHLY' | 'YEARLY';
  status: 'PENDING' | 'PAID';
  notes: string;
  createdAt: string;
}

// --- NOTIFICATIONS & MESSAGING ---

export type NotificationType = 'INFO' | 'ALERT' | 'WARNING';
export type NotificationSource = 'SALES' | 'FINANCE' | 'WHATSAPP' | 'SYSTEM' | 'FISCAL';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  source: NotificationSource;
  date: string;
  read: boolean;
}

export interface InternalMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  image: string;
  type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' | 'SYSTEM';
  timestamp: string;
  read: boolean;
  deleted: boolean;
  relatedModule?: 'sales' | 'finance' | 'ai' | 'fiscal';
  readBy?: string[];
}

export interface CommissionRule {
  id: string;
  minPercent: number;
  maxPercent: number | null;
  commissionRate: number;
  isActive: boolean;
}

export enum ProductType {
  BASICA = 'BASICA',
  NATAL = 'NATAL',
  CUSTOM = 'CUSTOM'
}

export type SaleStatus = 'ORÇAMENTO' | 'FATURADO';

export interface Sale {
  id: string;
  userId: string;
  client: string;
  quantity: number;
  type: ProductType;
  status: SaleStatus;
  valueProposed: number;
  valueSold: number;
  marginPercent: number;
  quoteDate?: string;
  completionDate?: string;
  date?: string;
  isBilled: boolean;
  hasNF: boolean;
  observations: string;
  trackingCode: string;
  commissionBaseTotal: number;
  commissionValueTotal: number;
  commissionRateUsed: number;
  createdAt: string;
  updatedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  clientId?: string;
  boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
}

export interface ReportConfig {
  daysForNewClient: number;
  daysForInactive: number;
  daysForLost: number;
}

export interface ProductivityMetrics {
  totalClients: number;
  activeClients: number;
  convertedThisMonth: number;
  conversionRate: number;
  productivityStatus: 'GREEN' | 'YELLOW' | 'RED';
}

export type PersonType = 'PF' | 'PJ';

export interface FinanceAccount {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'INTERNAL';
  balance: number;
  color: string;
  isAccounting: boolean;
  includeInDistribution: boolean;
  personType: PersonType;
  isActive: boolean;
  deleted: boolean;
  userId: string;
  createdAt: string;
  updatedAt?: string;
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
  isActive: boolean;
  deleted: boolean;
  userId: string;
  createdAt?: string;
}

export interface Transaction { 
    id: string; 
    description: string; 
    amount: number; 
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'IN' | 'OUT'; 
    date: string; 
    realizedAt?: string; 
    categoryId: string; 
    accountId: string; 
    isPaid: boolean; 
    provisioned: boolean; 
    isRecurring: boolean; 
    recurrenceRule?: string; 
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
    reconciled?: boolean;
    reconciledAt?: string;
}

export interface Receivable {
  id: string;
  description: string;
  value: number;
  date: string;
  status: 'PENDING' | 'EFFECTIVE';
  distributed: boolean;
  deductions: CommissionDeduction[];
  userId: string;
  deleted: boolean;
}

export interface CommissionDeduction {
  id: string;
  description: string;
  amount: number;
}

export interface DashboardWidgetConfig {
  showStats: boolean;
  showCharts: boolean;
  showRecents: boolean;
  showPacing: boolean;
  showBudgets: boolean;
  showProjection?: boolean;
}

export interface FinancialPacing {
  daysRemaining: number;
  safeDailySpend: number;
  pendingExpenses: number;
  nextIncomeDate: Date;
}

export interface TransactionCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  personType: PersonType;
  subcategories: string[];
  monthlyBudget: number;
  isActive: boolean;
  deleted: boolean;
  userId: string;
}

export interface ImportMapping {
  [key: string]: number;
}

export interface SystemConfig {
  bootstrapVersion: number;
  isMaintenanceMode?: boolean;
  notificationSounds?: {
    enabled: boolean;
    volume: number;
    sound: string;
  };
  includeNonAccountingInTotal: boolean;
  fcmServerKey?: string;
  ntfyTopic?: string;
  modules?: UserPermissions;
  notificationSound?: string;
  alertSound?: string;
  successSound?: string;
  warningSound?: string;
  theme?: AppTheme;
  supportEmail?: string;
  supportTelegram?: string;
}

export interface SyncEntry {
  id: number;
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  rowId: string;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
  timestamp: number;
  retryCount: number;
}

export type SyncTable = 'users' | 'audit_log' | 'clients' | 'client_transfer_requests' | 'sales' | 'commission_basic' | 'commission_natal' | 'commission_custom' | 'config' | 'accounts' | 'cards' | 'transactions' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'wa_contacts' | 'wa_tags' | 'wa_campaigns' | 'wa_queue' | 'wa_manual_logs' | 'wa_campaign_stats' | 'internal_messages' | 'sync_queue' | 'companies' | 'fiscal_periods' | 'tax_estimates' | 'tax_rules' | 'obligations';

export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';

export interface Challenge {
  id: string;
  name: string;
  targetValue: number;
  depositCount: number;
  model: ChallengeModel;
  createdAt: string;
  status: 'ACTIVE' | 'COMPLETED';
  userId: string;
  deleted: boolean;
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

export interface FinanceGoal {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  status: 'ACTIVE' | 'COMPLETED';
  userId: string;
  deleted: boolean;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  details?: any;
  userAgent: string;
  userId?: string;
  userName?: string;
}

export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';

export interface WAContact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  userId: string;
  source: 'MANUAL' | 'IMPORT';
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
  status: 'DRAFT' | 'PENDING' | 'SENDING' | 'COMPLETED';
  totalContacts: number;
  sentCount: number;
  config: {
    speed: WASpeed;
    startTime: string;
    endTime: string;
  };
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  userId: string;
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
  media?: any;
  deleted: boolean;
  isSeed: boolean;
  userId: string;
}

export interface ManualInteractionLog {
  id: string;
  campaignId: string;
  contactId: string;
  startedAt: string;
  mediaCopiedAt?: string;
  messageCopiedAt?: string;
  whatsappOpenedAt?: string;
  completedAt?: string;
  status: 'COMPLETED' | 'SKIPPED' | 'FAILED';
  notes?: string;
  rating?: number;
  error?: {
    type: string;
    description: string;
  };
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
  errorAnalysis: {
    errorRate: number;
    byType: Record<string, number>;
  };
  performanceBySpeed: Record<string, {
    successRate: number;
    averageTime: number;
  }>;
  stepAnalysis: {
    averageTimeToOpenWhatsApp: number;
    averageTimeToPaste: number;
    averageTimeToSend: number;
  };
  userRatings: {
    average: number;
    byStar: Record<number, number>;
  };
  insights: Array<{
    type: 'WARNING' | 'TIP';
    message: string;
  }>;
  financialImpact?: {
    revenue: number;
    salesCount: number;
    conversionRate: number;
  };
  abTestAnalysis?: {
    winner: 'A' | 'B' | 'DRAW';
    variantA: { count: number; rate: number };
    variantB: { count: number; rate: number };
  };
}

export interface Release {
  version: string;
  date: string;
  title: string;
  type: 'MAJOR' | 'MINOR' | 'PATCH';
  description: string;
  changes: Array<{
    type: 'NEW' | 'FIX' | 'SECURITY' | 'IMPROVE';
    text: string;
  }>;
}

export interface SalesTargets {
  basic: number;
  natal: number;
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

export interface DuplicateGroup<T> {
  id: string;
  items: T[];
}

export type WhatsAppErrorCode = 'BLOCKED_BY_USER' | 'PHONE_NOT_REGISTERED' | 'INVALID_PHONE' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';

export interface WASyncConfig {
  tablesToSync: ('wa_contacts' | 'wa_campaigns' | 'wa_delivery_logs' | 'wa_campaign_stats')[];
  syncFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MANUAL';
  includeErrorDetails: boolean;
}

export type WASpeed = 'SAFE' | 'FAST' | 'INSTANT';
export type WAMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export interface NtfyPayload {
  topic: string;
  message: string;
  title?: string;
  priority?: number;
  tags?: string[];
}
