
import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';

import Layout from './components/Layout';
import Login from './components/Login';
import RequestReset from './components/RequestReset';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard'; // Mantido estático para LCP rápida
import ToastContainer, { ToastMessage } from './components/Toast';
import SnowOverlay from './components/SnowOverlay';

// Importação Dinâmica (Lazy Loading) para módulos secundários
const SalesForm = lazy(() => import('./components/SalesForm'));
const SalesList = lazy(() => import('./components/SalesList'));
const BoletoControl = lazy(() => import('./components/BoletoControl'));
const ClientReports = lazy(() => import('./components/ClientReports'));
const WhatsAppModule = lazy(() => import('./components/WhatsAppModule'));
const FinanceDashboard = lazy(() => import('./components/FinanceDashboard'));
const FinanceTransactionsList = lazy(() => import('./components/FinanceTransactionsList'));
const FinanceTransactionForm = lazy(() => import('./components/FinanceTransactionForm'));
const FinanceReceivables = lazy(() => import('./components/FinanceReceivables'));
const FinanceDistribution = lazy(() => import('./components/FinanceDistribution'));
const FinanceManager = lazy(() => import('./components/FinanceManager'));
const FinanceCategories = lazy(() => import('./components/FinanceCategories'));
const FinanceGoals = lazy(() => import('./components/FinanceGoals'));
const FinanceChallenges = lazy(() => import('./components/FinanceChallenges'));
const SettingsHub = lazy(() => import('./components/SettingsHub'));
const DevRoadmap = lazy(() => import('./components/DevRoadmap'));
const BackupModal = lazy(() => import('./components/BackupModal'));
const BulkDateModal = lazy(() => import('./components/BulkDateModal'));

import {
    User, Sale, AppMode, AppTheme, FinanceAccount, Transaction, CreditCard,
    TransactionCategory, FinanceGoal, Challenge, ChallengeCell, Receivable,
    CommissionRule, ReportConfig, SalesTargets, ProductType,
    DashboardWidgetConfig, Client
} from './types';

import {
    getStoredSales, getFinanceData, getSystemConfig, getReportConfig,
    getStoredTable, saveSingleSale, getClients,
    saveCommissionRules, bootstrapProductionData, saveReportConfig,
    canAccess, handleSoftDelete
} from './services/logic';

import { reloadSession, logout } from './services/auth';
import { AudioService } from './services/audioService';
import { Logger } from './services/logger';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';

type AuthView = 'LOGIN' | 'REQUEST_RESET' | 'APP' | 'ERROR' | 'LOADING' | 'BLOCKED';

// Loader minimalista para transições de módulos lazy
const ModuleLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
        <Loader2 className="text-indigo-500 animate-spin mb-4" size={40} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Preparando Ambiente...</p>
    </div>
);

const App: React.FC = () => {
    const initRun = useRef(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<AuthView>('LOADING');
    const [authError, setAuthError] = useState<string | null>(null);
    
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isClearLocalModalOpen, setIsClearLocalModalOpen] = useState(false);
    const [isBulkDateModalOpen, setIsBulkDateModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [showSalesForm, setShowSalesForm] = useState(false);
    const [showTxForm, setShowTxForm] = useState(false);
    const [hideValues, setHideValues] = useState(false);
    const [showSnow, setShowSnow] = useState(() => localStorage.getItem('sys_snow_enabled') === 'true');
    
    const [toasts, setSortedToasts] = useState<ToastMessage[]>([]);

    const { isDev, isAdmin } = useMemo(() => {
        if (!currentUser) return { isDev: false, isAdmin: false };
        return {
            isDev: currentUser.role === 'DEV',
            isAdmin: currentUser.role === 'DEV' || currentUser.role === 'ADMIN'
        };
    }, [currentUser]);

    const [appMode, setAppMode] = useState<AppMode>(
        () => (localStorage.getItem('sys_last_mode') as AppMode) || 'SALES'
    );
    const [activeTab, setActiveTab] = useState(
        () => localStorage.getItem('sys_last_tab') || 'dashboard'
    );
    const [theme, setTheme] = useState<AppTheme>('glass');

    const [sales, setSales] = useState<Sale[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [goals, setGoals] = useState<FinanceGoal[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [cells, setCells] = useState<ChallengeCell[]>([]);
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [rulesBasic, setRulesBasic] = useState<CommissionRule[]>([]);
    const [rulesNatal, setRulesNatal] = useState<CommissionRule[]>([]);
    const [reportConfig, setReportConfig] = useState<ReportConfig>({
        daysForNewClient: 30, daysForInactive: 60, daysForLost: 180
    });
    const [salesTargets, setSalesTargets] = useState<SalesTargets>({ basic: 0, natal: 0 });
    const [dashboardConfig, setDashboardConfig] = useState<DashboardWidgetConfig>({
        showStats: true, showCharts: true, showRecents: true, showPacing: true, showBudgets: true
    });

    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
    };

    const removeToast = (id: string) => {
        setSortedToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleSaveCommissionRulesInApp = async (type: ProductType, rules: CommissionRule[]) => {
        try {
            await saveCommissionRules(type, rules);
            if (type === ProductType.BASICA) setRulesBasic(rules);
            else if (type === ProductType.NATAL) setRulesNatal(rules);
            addToast('SUCCESS', 'Tabela de comissões atualizada!');
        } catch (e: any) {
            addToast('ERROR', e.message);
        }
    };

    useEffect(() => {
        if (initRun.current) return;
        initRun.current = true;
        const init = async () => {
            Logger.info("🚀 Auditoria: Inicializando Aplicação Gestor360 v2.5.3");
            try {
                await AudioService.preload();
                const sessionUser = await reloadSession();
                if (sessionUser) {
                    if (!sessionUser.isActive || sessionUser.userStatus === 'INACTIVE') {
                        setAuthView('BLOCKED');
                        setLoading(false);
                    } else {
                        await handleLoginSuccess(sessionUser);
                    }
                } else {
                    setAuthView('LOGIN');
                    setLoading(false);
                }
            } catch (e: any) {
                setAuthError("Erro na conexão Cloud Firestore.");
                setAuthView('ERROR');
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleLoginSuccess = async (user: User) => {
        setCurrentUser(user);
        try {
            await bootstrapProductionData();
            await loadDataForUser();
            setAuthView('APP');
        } catch (e) {
            setAuthView('APP');
        } finally {
            setLoading(false);
        }
    };

    const loadDataForUser = async () => {
        try {
            const [rBasic, rNatal] = await Promise.all([
                getStoredTable(ProductType.BASICA),
                getStoredTable(ProductType.NATAL)
            ]);
            setRulesBasic(rBasic);
            setRulesNatal(rNatal);

            const [storedSales, storedClients, finData, sysCfg, rConfig] = await Promise.all([
                getStoredSales(), 
                getClients(), 
                getFinanceData(),
                getSystemConfig(),
                getReportConfig()
            ]);

            if (sysCfg?.theme) setTheme(sysCfg.theme);
            
            setSales(storedSales || []);
            setClients(storedClients || []);
            setAccounts(finData.accounts || []);
            setCards(finData.cards || []);
            setTransactions(finData.transactions || []);
            setCategories(finData.categories || []);
            setGoals(finData.goals || []);
            setReceivables(finData.receivables || []);
            
            if (rConfig?.daysForLost) setReportConfig(rConfig as ReportConfig);
        } catch (e) {
            Logger.error("🚨 Audit: Falha na sincronização de dados.", e);
        }
    };

    if (loading) return <LoadingScreen />;
    if (authView === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} onRequestReset={() => setAuthView('REQUEST_RESET')} />;
    if (authView === 'REQUEST_RESET') return <RequestReset onBack={() => setAuthView('LOGIN')} />;
    if (authView === 'ERROR') return <div className="p-20 text-center text-red-500 font-bold">{authError}</div>;

    if (authView === 'BLOCKED') {
        return (
            <div className="h-screen bg-[#020617] flex items-center justify-center p-6 text-center animate-in fade-in">
                <div className="bg-slate-900 border-2 border-red-500/50 p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(239,68,68,0.2)] max-w-sm w-full">
                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-500 ring-4 ring-red-500/20">
                        <ShieldAlert size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Acesso Bloqueado</h2>
                    <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">
                        Sua licença de uso está inativa. Entre em contato com o suporte.
                    </p>
                    <button onClick={logout} className="w-full py-4 bg-slate-800 hover:bg-red-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl transition-all uppercase text-[10px] tracking-[0.2em]">
                        <LogOut size={16}/> Sair do Sistema
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Layout 
            activeTab={activeTab} 
            setActiveTab={(t) => { setActiveTab(t); localStorage.setItem('sys_last_tab', t); }} 
            appMode={appMode} 
            setAppMode={(m) => { setAppMode(m); localStorage.setItem('sys_last_mode', m); }} 
            darkMode={true}
            currentTheme={theme}
            setTheme={setTheme}
            currentUser={currentUser!}
            onLogout={() => logout()}
            onNewSale={() => setShowSalesForm(true)}
            onNewIncome={() => setShowTxForm(true)}
            onNewExpense={() => setShowTxForm(true)}
            onNewTransfer={() => setShowTxForm(true)}
            isAdmin={isAdmin}
            isDev={isDev}
            showSnow={showSnow}
            onToggleSnow={() => { setShowSnow(!showSnow); localStorage.setItem('sys_snow_enabled', String(!showSnow)); }}
        >
            <Suspense fallback={<ModuleLoader />}>
                {activeTab === 'dashboard' && <Dashboard sales={sales} onNewSale={() => setShowSalesForm(true)} darkMode={true} hideValues={hideValues} config={dashboardConfig} onToggleHide={() => setHideValues(!hideValues)} onUpdateConfig={setDashboardConfig} currentUser={currentUser!} salesTargets={salesTargets} onUpdateTargets={setSalesTargets} isAdmin={isAdmin} isDev={isDev} />}
                {activeTab === 'sales' && <SalesList sales={sales} onEdit={(s) => { setEditingSale(s); setShowSalesForm(true); }} onDelete={(s) => handleSoftDelete('sales', s.id).then(loadDataForUser)} onNew={() => setShowSalesForm(true)} onClearAll={() => setIsClearLocalModalOpen(true)} onRestore={() => setIsBackupModalOpen(true)} onOpenBulkAdvanced={() => setIsBulkDateModalOpen(true)} onBillBulk={() => {}} onDeleteBulk={() => {}} onBulkAdd={() => {}} onRecalculate={() => {}} onNotify={addToast} darkMode={true} />}
                {activeTab === 'boletos' && <BoletoControl sales={sales} onUpdateSale={async (s) => { await saveSingleSale(s); }} />}
                {activeTab === 'reports' && <ClientReports sales={sales} config={reportConfig} onOpenSettings={() => setActiveTab('settings')} userId={currentUser!.id} darkMode={true} />}
                {activeTab === 'whatsapp_main' && <WhatsAppModule darkMode={true} sales={sales} />}
                {activeTab === 'fin_dashboard' && <FinanceDashboard accounts={accounts} transactions={transactions} cards={cards} receivables={receivables} darkMode={true} hideValues={hideValues} config={dashboardConfig} onToggleHide={() => setHideValues(!hideValues)} onUpdateConfig={setDashboardConfig} onNavigate={setActiveTab} />}
                {activeTab === 'fin_transactions' && <FinanceTransactionsList transactions={transactions} accounts={accounts} categories={categories} onDelete={(id) => handleSoftDelete('transactions', id).then(loadDataForUser)} darkMode={true} />}
                {activeTab === 'fin_receivables' && <FinanceReceivables receivables={receivables} onUpdate={() => loadDataForUser()} sales={sales} accounts={accounts} darkMode={true} />}
                {activeTab === 'fin_distribution' && <FinanceDistribution receivables={receivables} accounts={accounts} onDistribute={() => loadDataForUser()} darkMode={true} />}
                {activeTab === 'fin_manager' && <FinanceManager accounts={accounts} cards={cards} transactions={transactions} onUpdate={() => loadDataForUser()} onPayInvoice={() => {}} darkMode={true} />}
                {activeTab === 'fin_categories' && <FinanceCategories categories={categories} onUpdate={() => loadDataForUser()} darkMode={true} />}
                {activeTab === 'fin_goals' && <FinanceGoals goals={goals} onUpdate={() => loadDataForUser()} darkMode={true} />}
                {activeTab === 'fin_challenges' && <FinanceChallenges challenges={challenges} cells={cells} onUpdate={() => loadDataForUser()} darkMode={true} />}
                {activeTab === 'settings' && <SettingsHub rulesBasic={rulesBasic} rulesNatal={rulesNatal} reportConfig={reportConfig} onSaveRules={handleSaveCommissionRulesInApp} onSaveReportConfig={saveReportConfig} darkMode={true} currentUser={currentUser!} onUpdateUser={setCurrentUser} sales={sales} onUpdateSales={setSales} onNotify={addToast} isAdmin={isAdmin} isDev={isDev} />}
                {activeTab === 'dev_roadmap' && <DevRoadmap />}
            </Suspense>
            
            <Suspense fallback={null}>
                {showSalesForm && <SalesForm isOpen={showSalesForm} onClose={() => { setShowSalesForm(false); setEditingSale(null); }} onSaved={loadDataForUser} initialData={editingSale} />}
                {showTxForm && <FinanceTransactionForm isOpen={showTxForm} onClose={() => setShowTxForm(false)} onSaved={loadDataForUser} accounts={accounts} cards={cards} categories={categories} />}
                {isBackupModalOpen && <BackupModal isOpen={isBackupModalOpen} mode="RESTORE" onClose={() => setIsBackupModalOpen(false)} onSuccess={() => {}} onRestoreSuccess={loadDataForUser} />}
                {isClearLocalModalOpen && <BackupModal isOpen={isClearLocalModalOpen} mode="CLEAR" onClose={() => setIsClearLocalModalOpen(false)} onSuccess={() => {}} onRestoreSuccess={loadDataForUser} />}
                {isBulkDateModalOpen && <BulkDateModal isOpen={isBulkDateModalOpen} onClose={() => setIsBulkDateModalOpen(false)} onConfirm={() => {}} darkMode={true} />}
            </Suspense>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {showSnow && <SnowOverlay />}
        </Layout>
    );
};

export default App;
