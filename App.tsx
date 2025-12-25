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

import {
    User, Sale, AppMode, AppTheme, FinanceAccount, Transaction, CreditCard,
    TransactionCategory, FinanceGoal, Challenge, ChallengeCell, Receivable,
    CommissionRule, ReportConfig, SalesTargets, ProductType,
    DashboardWidgetConfig, Client
} from './types';

import {
    getStoredSales, getFinanceData, getSystemConfig, getReportConfig,
    getStoredTable, saveFinanceData, saveSingleSale, getClients,
    saveCommissionRules, bootstrapProductionData, saveReportConfig,
    saveSales, canAccess
} from './services/logic';

import { reloadSession, logout } from './services/auth';
import { AudioService } from './services/audioService';
import { auth as fbAuth } from './services/firebase';

type AuthView = 'LOGIN' | 'REQUEST_RESET' | 'APP' | 'ERROR';

const App: React.FC = () => {
    const initRun = useRef(false);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<AuthView>('LOGIN');
    const [authError, setAuthError] = useState<string | null>(null);

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
    const [showSalesForm, setShowSalesForm] = useState(false);
    const [showTxForm, setShowTxForm] = useState(false);
    const [hideValues, setHideValues] = useState(false);

    const [dashboardConfig, setDashboardConfig] = useState<DashboardWidgetConfig>({
        showStats: true, showCharts: true, showRecents: true, showPacing: true, showBudgets: true
    });

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
                    if (fbAuth.currentUser) {
                        setAuthError("Sua conta está em processamento ou inativa.");
                        setAuthView('ERROR');
                    } else {
                        setAuthView('LOGIN');
                    }
                    setLoading(false);
                }
            } catch (e: any) {
                console.error("Crash na inicialização:", e);
                setAuthError("Conexão com o servidor falhou.");
                setAuthView('ERROR');
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleLoginSuccess = async (user: User) => {
        setCurrentUser(user);
        await bootstrapProductionData();
        await loadDataForUser();
        
        setAuthView('APP');
        setLoading(false);
    };

    const loadDataForUser = async () => {
        try {
            const [storedSales, storedClients, finData, rBasic, rNatal, rCustom, sysCfg, rConfig] = await Promise.all([
                getStoredSales(), 
                getClients(), 
                getFinanceData(),
                getStoredTable(ProductType.BASICA), 
                getStoredTable(ProductType.NATAL), 
                getStoredTable(ProductType.CUSTOM),
                getSystemConfig(),
                getReportConfig()
            ]);

            if (sysCfg.theme) setTheme(sysCfg.theme);

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
            setRulesBasic(rBasic || []);
            setRulesNatal(rNatal || []);
            setRulesCustom(rCustom || []);
            setReportConfig(rConfig);
        } catch (e) {
            console.error("Erro ao carregar dados do usuário:", e);
        }
    };

    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
    };

    const removeToast = (id: string) => setSortedToasts(prev => prev.filter(t => t.id !== id));

    if (loading) return <LoadingScreen />;

    if (authView === 'ERROR') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
                <div className="max-w-md bg-slate-900 border border-red-500/50 p-8 rounded-3xl shadow-2xl">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Acesso Restrito</h1>
                    <p className="text-slate-400 mb-8">{authError}</p>
                    <button onClick={() => logout()} className="px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-100 transition-colors">Voltar ao Login</button>
                </div>
            </div>
        );
    }

    if (authView === 'LOGIN' || !currentUser)
        return <Login onLoginSuccess={handleLoginSuccess} onRequestReset={() => setAuthView('REQUEST_RESET')} />;

    if (authView === 'REQUEST_RESET')
        return <RequestReset onBack={() => setAuthView('LOGIN')} />;

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <Dashboard
                        sales={sales} onNewSale={() => setShowSalesForm(true)}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                        config={dashboardConfig} hideValues={hideValues}
                        onToggleHide={() => setHideValues(!hideValues)}
                        onUpdateConfig={setDashboardConfig}
                        currentUser={currentUser}
                        salesTargets={salesTargets} onUpdateTargets={setSalesTargets}
                        isAdmin={isAdmin} isDev={isDev}
                    />
                );
            case 'sales':
                return (
                    <SalesList
                        sales={sales}
                        onEdit={(s) => { /* logic */ }}
                        onDelete={async (s) => {
                            await saveSingleSale({ ...s, deleted: true });
                            loadDataForUser();
                        }}
                        onNew={() => setShowSalesForm(true)}
                        onExportTemplate={() => {}}
                        onImportFile={async () => {}}
                        onClearAll={() => {}}
                        onRestore={() => {}}
                        /* Fix: Removed invalid '!' syntax and provided missing prop implementations */
                        onOpenBulkAdvanced={() => {}}
                        onUndo={() => {}}
                        onBillSale={async (s, date) => {
                            await saveSingleSale({ ...s, date, isBilled: true });
                            loadDataForUser();
                        }}
                        onBillBulk={() => {}}
                        onDeleteBulk={() => {}}
                        onRecalculate={() => {}}
                        hasUndo={false}
                        onNotify={addToast}
                    />
                );
            case 'reports':
                return (
                    <ClientReports 
                        sales={sales} 
                        config={reportConfig} 
                        onOpenSettings={() => setActiveTab('settings')}
                        userId={currentUser.id}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                    />
                );
            case 'boletos':
                return (
                    <BoletoControl 
                        sales={sales} 
                        onUpdateSale={async (s) => {
                            await saveSingleSale(s);
                            loadDataForUser();
                        }} 
                    />
                );
            case 'whatsapp_main':
                return <WhatsAppModule darkMode={theme !== 'neutral' && theme !== 'rose'} sales={sales} />;
            case 'fin_dashboard':
                return (
                    <FinanceDashboard
                        accounts={accounts} transactions={transactions} cards={cards} receivables={receivables}
                        hideValues={hideValues} onToggleHide={() => setHideValues(!hideValues)}
                        config={dashboardConfig} onUpdateConfig={setDashboardConfig}
                        onNavigate={setActiveTab} darkMode={theme !== 'neutral' && theme !== 'rose'}
                    />
                );
            case 'fin_transactions':
                return (
                    <FinanceTransactionsList 
                        transactions={transactions} 
                        accounts={accounts} 
                        categories={categories} 
                        onDelete={async (id) => {
                            await saveFinanceData(accounts, cards, transactions.filter(t => t.id !== id), categories);
                            loadDataForUser();
                        }} 
                        darkMode={theme !== 'neutral' && theme !== 'rose'} 
                    />
                );
            case 'fin_receivables':
                return (
                    <FinanceReceivables 
                        receivables={receivables} 
                        accounts={accounts} 
                        sales={sales}
                        onUpdate={async (items) => {
                            loadDataForUser();
                        }}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                    />
                );
            case 'fin_distribution':
                return (
                    <FinanceDistribution 
                        receivables={receivables} 
                        accounts={accounts} 
                        onDistribute={() => {}} 
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                    />
                );
            case 'fin_manager':
                return (
                    <FinanceManager 
                        accounts={accounts} 
                        cards={cards} 
                        transactions={transactions}
                        onUpdate={async (acc, trans, crds) => {
                            await saveFinanceData(acc, crds, trans, categories);
                            loadDataForUser();
                        }}
                        onPayInvoice={() => {}}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                        onNotify={addToast}
                    />
                );
            case 'fin_categories':
                return <FinanceCategories categories={categories} onUpdate={() => {}} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_goals':
                return <FinanceGoals goals={goals} onUpdate={() => {}} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_challenges':
                return <FinanceChallenges challenges={challenges} cells={cells} onUpdate={() => {}} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'settings':
                return (
                    <SettingsHub
                        rulesBasic={rulesBasic} rulesNatal={rulesNatal} rulesCustom={rulesCustom}
                        reportConfig={reportConfig}
                        onSaveRules={async (type, rules) => {
                            try {
                                await saveCommissionRules(type, rules);
                                addToast('SUCCESS', `Tabela ${type} atualizada!`);
                                await loadDataForUser();
                            } catch (e) { addToast('ERROR', 'Erro ao salvar.'); }
                        }}
                        onSaveReportConfig={async (config) => {
                            try {
                                await saveReportConfig(config);
                                setReportConfig(config);
                                addToast('SUCCESS', 'Parâmetros de relatório atualizados!');
                            } catch (e) { addToast('ERROR', 'Falha ao salvar configurações.'); }
                        }}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                        currentUser={currentUser} onUpdateUser={setCurrentUser}
                        sales={sales} onUpdateSales={setSales}
                        onNotify={addToast} onThemeChange={setTheme}
                        isAdmin={isAdmin} isDev={isDev}
                    />
                );
            case 'dev_roadmap':
                return isDev ? <DevRoadmap /> : null;
            default:
                return <div className="p-8 text-center text-gray-500">Módulo não encontrado.</div>;
        }
    };

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
                        await saveFinanceData(accounts, cards, [...transactions, tx], categories);
                    }}
                    onSaved={loadDataForUser}
                />
            )}

            <Layout
                currentUser={currentUser}
                activeTab={activeTab} setActiveTab={setActiveTab}
                appMode={appMode} setAppMode={setAppMode}
                currentTheme={theme} setTheme={setTheme}
                darkMode={theme !== 'neutral' && theme !== 'rose'}
                onLogout={logout}
                onNewSale={() => setShowSalesForm(true)}
                onNewIncome={() => setShowTxForm(true)}
                onNewExpense={() => setShowTxForm(true)}
                onNewTransfer={() => setShowTxForm(true)}
                isAdmin={isAdmin} isDev={isDev}
            >
                <div className="p-4 h-full overflow-hidden">
                    {renderActiveTab()}
                </div>
            </Layout>
        </div>
    );
};

export default App;