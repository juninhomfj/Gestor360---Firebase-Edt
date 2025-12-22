
import React, { useState, useEffect, useRef, useMemo } from 'react';

import Layout from './components/Layout';
import Login from './components/Login';
import RequestReset from './components/RequestReset';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard';
import SalesForm from './components/SalesForm';
import FinanceDashboard from './components/FinanceDashboard';
import FinanceTransactionForm from './components/FinanceTransactionForm';
import SettingsHub from './components/SettingsHub';
import ToastContainer, { ToastMessage } from './components/Toast';
import PasswordReset from './components/PasswordReset';
import SnowOverlay from './components/SnowOverlay';
import DevRoadmap from './components/DevRoadmap';

import {
    User,
    Sale,
    AppMode,
    AppTheme,
    FinanceAccount,
    Transaction,
    CreditCard,
    TransactionCategory,
    FinanceGoal,
    Challenge,
    ChallengeCell,
    Receivable,
    CommissionRule,
    ReportConfig,
    SalesTargets,
    ProductType,
    DashboardWidgetConfig,
    Client
} from './types';

import {
    getStoredSales,
    getFinanceData,
    getSystemConfig,
    getReportConfig,
    getStoredTable,
    bootstrapDefaultAccountIfMissing,
    saveFinanceData,
    saveSingleSale,
    getClients,
    saveClient
} from './services/logic';

import { reloadSession, logout } from './services/auth';
import { AudioService } from './services/audioService';

type AuthView = 'LOGIN' | 'REQUEST_RESET' | 'RESET_PASSWORD' | 'APP';

const App: React.FC = () => {
    const initRun = useRef(false);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<AuthView>('LOGIN');

    /**
     * Resolvendo flags de permissão com herança:
     * DEV herda TUDO.
     * ADMIN herda USER.
     */
    const { isDev, isAdmin } = useMemo(() => {
        if (!currentUser) return { isDev: false, isAdmin: false };
        const role = currentUser.role || 'USER';
        return {
            isDev: role === 'DEV',
            isAdmin: role === 'DEV' || role === 'ADMIN'
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
        daysForNewClient: 30,
        daysForInactive: 60,
        daysForLost: 180
    });

    const [salesTargets, setSalesTargets] = useState<SalesTargets>({
        basic: 0,
        natal: 0
    });

    const [showSalesForm, setShowSalesForm] = useState(false);
    const [showTxForm, setShowTxForm] = useState(false);

    const [dashboardConfig, setDashboardConfig] = useState<DashboardWidgetConfig>({
        showStats: true,
        showCharts: true,
        showRecents: true,
        showPacing: true,
        showBudgets: true
    });

    const [hideValues, setHideValues] = useState(false);

    useEffect(() => {
        if (initRun.current) return;
        initRun.current = true;

        const init = async () => {
            try {
                await bootstrapDefaultAccountIfMissing();
                await AudioService.preload();

                const session = await reloadSession();
                if (session) {
                    await handleLoginSuccess(session);
                } else {
                    setAuthView('LOGIN');
                    setLoading(false);
                }
            } catch (e) {
                console.error('[INIT ERROR]', e);
                setLoading(false);
            }
        };

        init();
    }, []);

    const handleLoginSuccess = async (user: User) => {
        setCurrentUser(user);
        await bootstrapExampleData(user.id);
        await loadDataForUser();
        setAuthView('APP');
        setLoading(false);
    };

    const bootstrapExampleData = async (userId: string) => {
        const existingClients = await getClients();
        if (existingClients.length === 0) {
            const exampleClient: Client = {
                id: 'client_modelo_1',
                name: "Cliente Modelo LTDA",
                companyName: "Cliente Modelo LTDA",
                contactName: "Responsável Teste",
                status: 'ATIVO',
                benefitProfile: 'BASICA',
                quotationDay: 10,
                monthlyQuantityDeclared: 50,
                monthlyQuantityAverage: 0,
                isActive: true,
                userId: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await saveClient(exampleClient);
        }
    };

    const loadDataForUser = async () => {
        const sysConfig = await getSystemConfig();
        if (sysConfig.theme) setTheme(sysConfig.theme);

        const [
            storedSales,
            storedClients,
            finData,
            rBasic,
            rNatal,
            rCustom,
            rConfig
        ] = await Promise.all([
            getStoredSales(),
            getClients(),
            getFinanceData(),
            getStoredTable(ProductType.BASICA),
            getStoredTable(ProductType.NATAL),
            getStoredTable(ProductType.CUSTOM),
            getReportConfig()
        ]);

        setSales(storedSales);
        setClients(storedClients);
        setAccounts(finData.accounts || []);
        setCards(finData.cards || []);
        setTransactions(finData.transactions || []);
        setCategories(finData.categories || []);
        setGoals(finData.goals || []);
        setChallenges(finData.challenges || []);
        setCells(finData.cells || []);
        setReceivables(finData.receivables || []);

        setRulesBasic(rBasic);
        setRulesNatal(rNatal);
        setRulesCustom(rCustom);
        setReportConfig(rConfig);
    };

    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
    };

    const removeToast = (id: string) =>
        setSortedToasts(prev => prev.filter(t => t.id !== id));

    if (loading) return <LoadingScreen />;

    if (authView === 'LOGIN')
        return (
            <Login
                onLoginSuccess={handleLoginSuccess}
                onRequestReset={() => setAuthView('REQUEST_RESET')}
            />
        );

    if (authView === 'REQUEST_RESET')
        return <RequestReset onBack={() => setAuthView('LOGIN')} />;

    if (authView === 'RESET_PASSWORD' && currentUser)
        return (
            <PasswordReset
                userId={currentUser.id}
                onSuccess={() => setAuthView('APP')}
            />
        );

    if (!currentUser)
        return (
            <Login
                onLoginSuccess={handleLoginSuccess}
                onRequestReset={() => setAuthView('REQUEST_RESET')}
            />
        );

    return (
        <div className={theme}>
            <SnowOverlay />
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {showSalesForm && (
                <SalesForm
                    isOpen={showSalesForm}
                    onClose={() => setShowSalesForm(false)}
                    onSave={saveSingleSale}
                    onSaved={loadDataForUser}
                />
            )}

            {showTxForm && (
                <FinanceTransactionForm
                    isOpen={showTxForm}
                    onClose={() => setShowTxForm(false)}
                    accounts={accounts}
                    cards={cards}
                    categories={categories}
                    onSave={async (tx: Transaction) => {
                        await saveFinanceData(
                            accounts,
                            cards,
                            [...transactions, tx],
                            categories,
                            goals,
                            challenges,
                            cells,
                            receivables
                        );
                    }}
                    onSaved={loadDataForUser}
                />
            )}

            <Layout
                currentUser={currentUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                appMode={appMode}
                setAppMode={setAppMode}
                currentTheme={theme}
                setTheme={setTheme}
                darkMode={theme !== 'neutral' && theme !== 'rose'}
                onLogout={logout}
                onNewSale={() => setShowSalesForm(true)}
                onNewIncome={() => setShowTxForm(true)}
                onNewExpense={() => setShowTxForm(true)}
                onNewTransfer={() => setShowTxForm(true)}
                notifications={[]}
                isAdmin={isAdmin}
                isDev={isDev}
            >
                <div className="p-4">
                    {activeTab === 'dashboard' && (
                        <Dashboard
                            sales={sales}
                            onNewSale={() => setShowSalesForm(true)}
                            darkMode={theme !== 'neutral' && theme !== 'rose'}
                            config={dashboardConfig}
                            hideValues={hideValues}
                            onToggleHide={() => setHideValues(!hideValues)}
                            onUpdateConfig={setDashboardConfig}
                            currentUser={currentUser}
                            salesTargets={salesTargets}
                            onUpdateTargets={setSalesTargets}
                            isAdmin={isAdmin}
                            isDev={isDev}
                        />
                    )}

                    {activeTab === 'settings' && (
                        <SettingsHub
                            rulesBasic={rulesBasic}
                            rulesNatal={rulesNatal}
                            rulesCustom={rulesCustom}
                            reportConfig={reportConfig}
                            onSaveRules={(type, rules) => {
                                // Logic
                            }}
                            onSaveReportConfig={setReportConfig}
                            darkMode={theme !== 'neutral' && theme !== 'rose'}
                            currentUser={currentUser}
                            onUpdateUser={setCurrentUser}
                            sales={sales}
                            onUpdateSales={setSales}
                            onNotify={addToast}
                            onThemeChange={setTheme}
                            isAdmin={isAdmin}
                            isDev={isDev}
                        />
                    )}

                    {activeTab === 'fin_dashboard' && (
                        <FinanceDashboard
                            accounts={accounts}
                            transactions={transactions}
                            cards={cards}
                            hideValues={hideValues}
                            onToggleHide={() => setHideValues(!hideValues)}
                            config={dashboardConfig}
                            onUpdateConfig={setDashboardConfig}
                            onNavigate={setActiveTab}
                            darkMode={theme !== 'neutral' && theme !== 'rose'}
                        />
                    )}

                    {activeTab === 'dev_roadmap' && isDev && <DevRoadmap />}
                </div>
            </Layout>
        </div>
    );
};

export default App;
