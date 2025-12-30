
import React, { useState, useEffect, useRef, useMemo } from 'react';

import Layout from './components/Layout';
import Login from './components/Login';
import RequestReset from './components/RequestReset';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard';
import SalesForm from './components/SalesForm';
import SalesList from './components/SalesList';
import BoletoControl from './components/BoletoControl';
import ClientReports from './components/ClientReports';
import WhatsAppModule from './components/WhatsAppModule';
import FinanceDashboard from './components/FinanceDashboard';
import FinanceTransactionsList from './components/FinanceTransactionsList';
import FinanceTransactionForm from './components/FinanceTransactionForm';
import FinanceReceivables from './components/FinanceReceivables';
import FinanceDistribution from './components/FinanceDistribution';
import FinanceManager from './components/FinanceManager';
import FinanceCategories from './components/FinanceCategories';
import FinanceGoals from './components/FinanceGoals';
import FinanceChallenges from './components/FinanceChallenges';
import SettingsHub from './components/SettingsHub';
import ToastContainer, { ToastMessage } from './components/Toast';
import SnowOverlay from './components/SnowOverlay';
import DevRoadmap from './components/DevRoadmap';
import SystemUpdateNotify from './components/SystemUpdateNotify';
import BackupModal from './components/BackupModal';
import BulkDateModal from './components/BulkDateModal';
import ConfirmationModal from './components/ConfirmationModal';

import {
    User, Sale, AppMode, AppTheme, FinanceAccount, Transaction, CreditCard,
    TransactionCategory, FinanceGoal, Challenge, ChallengeCell, Receivable,
    CommissionRule, ReportConfig, SalesTargets, ProductType,
    /* Fix: Added missing SaleFormData import to satisfy handleBulkAddSales signature */
    DashboardWidgetConfig, Client, SaleFormData
} from './types';

// Fix: Corrected imports from services/logic to include all required members
import {
    getStoredSales, getFinanceData, getSystemConfig, getReportConfig,
    getStoredTable, saveFinanceData, saveSingleSale, getClients,
    saveCommissionRules, bootstrapProductionData, saveReportConfig,
    saveSales, canAccess, computeCommissionValues, clearLocalCache,
    ensureNumber
} from './services/logic';

import { reloadSession, logout } from './services/auth';
import { AudioService } from './services/audioService';
import { auth as fbAuth } from './services/firebase';
import { Logger } from './services/logger';

type AuthView = 'LOGIN' | 'REQUEST_RESET' | 'APP' | 'ERROR' | 'LOADING';

const App: React.FC = () => {
    const initRun = useRef(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<AuthView>('LOADING');
    const [authError, setAuthError] = useState<string | null>(null);
    
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isBulkDateModalOpen, setIsBulkDateModalOpen] = useState(false);
    const [isClearLocalModalOpen, setIsClearLocalModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [showSalesForm, setShowSalesForm] = useState(false);
    const [showTxForm, setShowTxForm] = useState(false);
    const [hideValues, setHideValues] = useState(false);

    const [showSnow, setShowSnow] = useState(() => localStorage.getItem('sys_snow_enabled') === 'true');
    const toggleSnow = () => {
        const nextValue = !showSnow;
        setShowSnow(nextValue);
        localStorage.setItem('sys_snow_enabled', String(nextValue));
    };

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
    const [toasts, setSortedToasts] = useState<ToastMessage[]>([]);

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
    const [rulesCustom, setRulesCustom] = useState<CommissionRule[]>([]);
    const [reportConfig, setReportConfig] = useState<ReportConfig>({
        daysForNewClient: 30, daysForInactive: 60, daysForLost: 180
    });
    const [salesTargets, setSalesTargets] = useState<SalesTargets>({ basic: 0, natal: 0 });
    const [dashboardConfig, setDashboardConfig] = useState<DashboardWidgetConfig>({
        showStats: true, showCharts: true, showRecents: true, showPacing: true, showBudgets: true
    });

    // Fix: Implemented addToast helper function to fix "Cannot find name 'addToast'" error on lines 207, 249, 252
    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
    };

    const removeToast = (id: string) => {
        setSortedToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => {
        if (initRun.current) return;
        initRun.current = true;
        const init = async () => {
            try {
                await AudioService.preload();
                const sessionUser = await reloadSession();
                if (sessionUser) {
                    await handleLoginSuccess(sessionUser);
                } else {
                    setAuthView('LOGIN');
                    setLoading(false);
                }
            } catch (e: any) {
                setAuthError("Erro na conexão com Cloud Firestore. Verifique as credenciais.");
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
            await new Promise(r => setTimeout(r, 500));
            await loadDataForUser();
            setAuthView('APP');
        } catch (e) {
            console.error("Erro no bootstrap pós-login", e);
            setAuthView('APP');
        } finally {
            setLoading(false);
        }
    };

    const loadDataForUser = async () => {
        try {
            const [rBasic, rNatal, rCustom] = await Promise.all([
                getStoredTable(ProductType.BASICA).catch(e => { console.error("Rules Basic Load Failed", e); return [] as CommissionRule[]; }),
                getStoredTable(ProductType.NATAL).catch(e => { console.error("Rules Natal Load Failed", e); return [] as CommissionRule[]; }),
                getStoredTable(ProductType.CUSTOM).catch(e => { console.error("Rules Custom Load Failed", e); return [] as CommissionRule[]; })
            ]);
            setRulesBasic(rBasic);
            setRulesNatal(rNatal);
            setRulesCustom(rCustom);

            const results = await Promise.all([
                getStoredSales().catch(e => { console.error("Sales Load Failed", e); return [] as Sale[]; }), 
                getClients().catch(e => { console.error("Clients Load Failed", e); return [] as Client[]; }), 
                getFinanceData().catch(e => { 
                    console.error("Finance Load Failed", e); 
                    return { 
                        accounts: [], transactions: [], cards: [], categories: [], 
                        goals: [], challenges: [], cells: [], receivables: [] 
                    }; 
                }) as Promise<any>,
                getSystemConfig().catch(e => { console.error("Config Load Failed", e); return {} as any; }),
                getReportConfig().catch(e => { console.error("Report Config Load Failed", e); return {} as any; })
            ]);

            const [storedSales, storedClients, finData, sysCfg, rConfig] = results;

            if (sysCfg && sysCfg.theme) setTheme(sysCfg.theme);
            setSales(storedSales || []);
            setClients(storedClients || []);
            
            setAccounts(finData.accounts || []);
            setCards(finData.cards || []);
            setTransactions(finData.transactions || []);
            setCategories(finData.categories || []);
            setGoals(finData.goals || []);
            setChallenges(finData.challenges || []);
            setCells(finData.cells || []);
            setReceivables(finData.receivables || []);
            
            if (rConfig && rConfig.daysForLost) setReportConfig(rConfig as ReportConfig);
            
        } catch (e) {
            Logger.error("Falha crítica ao sincronizar com Firestore.");
            console.error("loadDataForUser critical error", e);
        }
    };

    const handleClearLocalData = async () => {
        setLoading(true);
        try {
            await clearLocalCache();
            window.location.reload();
        } catch (e) {
            addToast('ERROR', 'Erro ao limpar cache local.');
            setLoading(false);
        }
    };

    const handleBulkAddSales = async (newSalesData: SaleFormData[]) => {
        const uid = fbAuth.currentUser?.uid;
        if (!uid) return;
        setLoading(true);
        try {
            const convertedSales: Sale[] = newSalesData.map(data => {
                const rules = data.type === ProductType.NATAL ? rulesNatal : rulesBasic;
                const qty = ensureNumber(data.quantity);
                const valProp = ensureNumber(data.valueProposed);
                const margin = ensureNumber(data.marginPercent);
                const valSold = ensureNumber(data.valueSold);

                const { commissionBase, commissionValue, rateUsed } = computeCommissionValues(qty, valProp, margin, rules);

                return {
                    id: crypto.randomUUID(),
                    userId: uid,
                    client: data.client,
                    quantity: qty,
                    type: data.type,
                    status: data.isBilled ? 'FATURADO' : 'ORÇAMENTO',
                    valueProposed: valProp,
                    valueSold: valSold,
                    marginPercent: margin,
                    commissionBaseTotal: commissionBase,
                    commissionValueTotal: commissionValue,
                    commissionRateUsed: rateUsed,
                    isBilled: data.isBilled,
                    completionDate: data.completionDate,
                    date: data.date,
                    observations: data.observations || "",
                    createdAt: new Date().toISOString(),
                    deleted: false
                } as Sale;
            });

            await saveSales(convertedSales);
            addToast('SUCCESS', `${convertedSales.length} vendas sincronizadas.`);
            await loadDataForUser();
        } catch (e: any) {
            addToast('ERROR', 'Erro ao processar importação.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingScreen />;
    if (authView === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} onRequestReset={() => setAuthView('REQUEST_RESET')} />;
    if (authView === 'REQUEST_RESET') return <RequestReset onBack={() => setAuthView('LOGIN')} />;
    if (authView === 'ERROR') return <div className="p-20 text-center text-red-500">{authError}</div>;

    return (
        <Layout 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            appMode={appMode} 
            setAppMode={setAppMode} 
            darkMode={true}
            currentTheme={theme}
            setTheme={setTheme}
            currentUser={currentUser!}
            onLogout={logout}
            onNewSale={() => setShowSalesForm(true)}
            onNewIncome={() => setShowTxForm(true)}
            onNewExpense={() => setShowTxForm(true)}
            onNewTransfer={() => setShowTxForm(true)}
            isAdmin={isAdmin}
            isDev={isDev}
            showSnow={showSnow}
            onToggleSnow={toggleSnow}
        >
            {activeTab === 'dashboard' && <Dashboard sales={sales} onNewSale={() => setShowSalesForm(true)} darkMode={true} hideValues={hideValues} config={dashboardConfig} onToggleHide={() => setHideValues(!hideValues)} onUpdateConfig={setDashboardConfig} currentUser={currentUser!} salesTargets={salesTargets} onUpdateTargets={setSalesTargets} isAdmin={isAdmin} isDev={isDev} />}
            {activeTab === 'sales' && <SalesList sales={sales} onEdit={(s) => { setEditingSale(s); setShowSalesForm(true); }} onDelete={() => {}} onNew={() => setShowSalesForm(true)} onExportTemplate={() => {}} onClearAll={() => setIsClearLocalModalOpen(true)} onRestore={() => setIsBackupModalOpen(true)} onOpenBulkAdvanced={() => setIsBulkDateModalOpen(true)} onBillBulk={() => {}} onDeleteBulk={() => {}} onBulkAdd={handleBulkAddSales} onRecalculate={() => {}} onNotify={addToast} darkMode={true} />}
            {activeTab === 'boletos' && <BoletoControl sales={sales} onUpdateSale={async (s) => await saveSingleSale(s)} />}
            {activeTab === 'reports' && <ClientReports sales={sales} config={reportConfig} onOpenSettings={() => setActiveTab('settings')} userId={currentUser!.id} darkMode={true} />}
            {activeTab === 'whatsapp_main' && <WhatsAppModule darkMode={true} sales={sales} />}
            {activeTab === 'fin_dashboard' && <FinanceDashboard accounts={accounts} transactions={transactions} cards={cards} receivables={receivables} darkMode={true} hideValues={hideValues} config={dashboardConfig} onToggleHide={() => setHideValues(!hideValues)} onUpdateConfig={setDashboardConfig} onNavigate={setActiveTab} />}
            {activeTab === 'fin_transactions' && <FinanceTransactionsList transactions={transactions} accounts={accounts} categories={categories} onDelete={() => {}} darkMode={true} />}
            {activeTab === 'fin_receivables' && <FinanceReceivables receivables={receivables} onUpdate={() => {}} sales={sales} accounts={accounts} darkMode={true} />}
            {activeTab === 'fin_distribution' && <FinanceDistribution receivables={receivables} accounts={accounts} onDistribute={() => {}} darkMode={true} />}
            {activeTab === 'fin_manager' && <FinanceManager accounts={accounts} cards={cards} transactions={transactions} onUpdate={() => {}} onPayInvoice={() => {}} darkMode={true} />}
            {activeTab === 'fin_categories' && <FinanceCategories categories={categories} onUpdate={() => {}} darkMode={true} />}
            {activeTab === 'fin_goals' && <FinanceGoals goals={goals} onUpdate={() => {}} darkMode={true} />}
            {activeTab === 'fin_challenges' && <FinanceChallenges challenges={challenges} cells={cells} onUpdate={() => {}} darkMode={true} />}
            {activeTab === 'settings' && <SettingsHub rulesBasic={rulesBasic} rulesNatal={rulesNatal} rulesCustom={rulesCustom} reportConfig={reportConfig} onSaveRules={saveCommissionRules} onSaveReportConfig={saveReportConfig} darkMode={true} currentUser={currentUser!} onUpdateUser={setCurrentUser} sales={sales} onUpdateSales={setSales} onNotify={addToast} isAdmin={isAdmin} isDev={isDev} />}
            {activeTab === 'dev_roadmap' && <DevRoadmap />}
            
            <SalesForm isOpen={showSalesForm} onClose={() => { setShowSalesForm(false); setEditingSale(null); }} onSaved={loadDataForUser} initialData={editingSale} />
            <FinanceTransactionForm isOpen={showTxForm} onClose={() => setShowTxForm(false)} onSaved={loadDataForUser} accounts={accounts} cards={cards} categories={categories} />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {showSnow && <SnowOverlay />}
        </Layout>
    );
};

// Fix: Added missing default export for App component to resolve import error in index.tsx
export default App;
