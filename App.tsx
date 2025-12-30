
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
            addToast('ERROR', `Erro na sincronia: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUpdateDate = async (targetDate: string, filterType: ProductType | 'ALL', launchDateFrom: string, onlyEmpty: boolean) => {
        setLoading(true);
        try {
            const toUpdate = sales.filter(s => {
                if (filterType !== 'ALL' && s.type !== filterType) return false;
                if (onlyEmpty && s.date) return false;
                const launchDate = (s.date || s.completionDate || s.createdAt).split('T')[0];
                return launchDate >= launchDateFrom;
            });
            if (toUpdate.length === 0) {
                addToast('INFO', 'Nenhuma venda encontrada.');
                setLoading(false);
                return;
            }
            const updatedItems = toUpdate.map(s => ({ ...s, date: targetDate, isBilled: true }));
            await saveSales(updatedItems);
            addToast('SUCCESS', `${updatedItems.length} faturadas.`);
            await loadDataForUser();
        } catch (e) { addToast('ERROR', 'Falha no lote.'); } finally { setLoading(false); setIsBulkDateModalOpen(false); }
    };

    const handleRecalculateAdvanced = async (includeBilled: boolean, filterType: ProductType | 'ALL', dateFrom: string) => {
        setLoading(true);
        try {
            const targets = sales.filter(s => {
                if (!includeBilled && s.date) return false;
                if (filterType !== 'ALL' && s.type !== filterType) return false;
                if (dateFrom && (s.date || s.completionDate || '').substring(0, 10) < dateFrom) return false;
                return true;
            });
            const updated = targets.map(s => {
                const rules = s.type === ProductType.NATAL ? rulesNatal : rulesBasic;
                const { commissionBase, commissionValue, rateUsed } = computeCommissionValues(s.quantity, s.valueProposed, s.marginPercent, rules);
                return { ...s, commissionBaseTotal: commissionBase, commissionValueTotal: commissionValue, commissionRateUsed: rateUsed };
            });
            await saveSales(updated);
            await loadDataForUser();
            addToast('SUCCESS', `${updated.length} cálculos auditados.`);
        } finally { setLoading(false); }
    };

    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
    };
    const removeToast = (id: string) => setSortedToasts(prev => prev.filter(t => t.id !== id));

    if (authView === 'LOADING' || loading) return <LoadingScreen />;

    if (authView === 'ERROR') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-white">
                <div className="max-w-md p-8 bg-slate-900 border border-red-50 rounded-3xl shadow-2xl">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Falha Crítica Firestore</h1>
                    <p className="opacity-60 mb-8">{authError}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition-all">Reiniciar Sistema</button>
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
                return <Dashboard sales={sales} onNewSale={() => setShowSalesForm(true)} darkMode={theme !== 'neutral' && theme !== 'rose'} config={dashboardConfig} hideValues={hideValues} onToggleHide={() => setHideValues(!hideValues)} onUpdateConfig={setDashboardConfig} currentUser={currentUser} salesTargets={salesTargets} onUpdateTargets={setSalesTargets} isAdmin={isAdmin} isDev={isDev} />;
            case 'sales':
                return (
                    <SalesList
                        sales={sales}
                        onEdit={(s) => { setEditingSale(s); setShowSalesForm(true); }}
                        onDelete={async (s) => { await saveSingleSale({ ...s, deleted: true }); loadDataForUser(); }}
                        onNew={() => { setEditingSale(null); setShowSalesForm(true); }}
                        onExportTemplate={() => {}} 
                        onClearAll={() => setIsClearLocalModalOpen(true)}
                        onRestore={() => setIsBackupModalOpen(true)}
                        onOpenBulkAdvanced={() => setIsBulkDateModalOpen(true)}
                        onBillBulk={async (ids, date) => {
                            const toUpdate = sales.filter(s => ids.includes(s.id)).map(s => ({ ...s, date, isBilled: true }));
                            await saveSales(toUpdate);
                            loadDataForUser();
                        }}
                        onDeleteBulk={async (ids) => {
                            const toUpdate = sales.filter(s => ids.includes(s.id)).map(s => ({ ...s, deleted: true }));
                            await saveSales(toUpdate);
                            loadDataForUser();
                        }}
                        onBulkAdd={handleBulkAddSales}
                        onRecalculate={handleRecalculateAdvanced}
                        onNotify={addToast}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                    />
                );
            case 'reports':
                return ( <ClientReports sales={sales} config={reportConfig} onOpenSettings={() => setActiveTab('settings')} userId={currentUser.id} darkMode={theme !== 'neutral' && theme !== 'rose'} /> );
            case 'boletos':
                return ( <BoletoControl sales={sales} onUpdateSale={async (s) => { await saveSingleSale(s); loadDataForUser(); }} /> );
            case 'settings':
                return ( <SettingsHub rulesBasic={rulesBasic} rulesNatal={rulesNatal} rulesCustom={rulesCustom} reportConfig={reportConfig} onSaveRules={async (type, rules) => { await saveCommissionRules(type, rules); loadDataForUser(); }} onSaveReportConfig={async (config) => { await saveReportConfig(config); setReportConfig(config); }} darkMode={theme !== 'neutral' && theme !== 'rose'} currentUser={currentUser} onUpdateUser={setCurrentUser} sales={sales} onUpdateSales={setSales} onNotify={addToast} onThemeChange={setTheme} isAdmin={isAdmin} isDev={isDev} /> );
            case 'fin_dashboard':
                return ( <FinanceDashboard accounts={accounts} transactions={transactions} cards={cards} receivables={receivables} hideValues={hideValues} onToggleHide={() => setHideValues(!hideValues)} config={dashboardConfig} onUpdateConfig={setDashboardConfig} onNavigate={setActiveTab} darkMode={theme !== 'neutral' && theme !== 'rose'} /> );
            case 'fin_manager':
                return ( <FinanceManager accounts={accounts} cards={cards} transactions={transactions} onUpdate={async (acc, trans, crds) => { await saveFinanceData(acc, crds, trans, categories, goals, challenges, receivables); loadDataForUser(); }} onPayInvoice={async () => {}} darkMode={theme !== 'neutral' && theme !== 'rose'} onNotify={addToast} /> );
            case 'fin_transactions':
                return ( <FinanceTransactionsList transactions={transactions} accounts={accounts} categories={categories} onDelete={async (id) => { const updated = transactions.map(t => t.id === id ? {...t, deleted: true} : t); await saveFinanceData(accounts, cards, updated, categories, goals, challenges, receivables); loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} /> );
            case 'fin_categories':
                return <FinanceCategories categories={categories} onUpdate={async (cats) => { await saveFinanceData(accounts, cards, transactions, cats, goals, challenges, receivables); loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_receivables':
                return <FinanceReceivables receivables={receivables} onUpdate={async (recs) => { await saveFinanceData(accounts, cards, transactions, categories, goals, challenges, recs); loadDataForUser(); }} sales={sales} accounts={accounts} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_goals':
                return <FinanceGoals goals={goals} onUpdate={async (gls) => { await saveFinanceData(accounts, cards, transactions, categories, gls, challenges, receivables); loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_challenges':
                return <FinanceChallenges challenges={challenges} cells={cells} onUpdate={async (chals, clls) => { await saveFinanceData(accounts, cards, transactions, categories, goals, chals, receivables); loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'dev_roadmap':
                return isDev ? <DevRoadmap /> : null;
            default:
                return <div className="p-8 text-center text-gray-500">Módulo em desenvolvimento.</div>;
        }
    };

    return (
        <div className={theme}>
            {showSnow && <SnowOverlay />}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {showSalesForm && ( <SalesForm isOpen={showSalesForm} onClose={() => { setShowSalesForm(false); setEditingSale(null); }} initialData={editingSale} onSave={saveSingleSale} onSaved={loadDataForUser} /> )}
            {showTxForm && ( <FinanceTransactionForm isOpen={showTxForm} onClose={() => setShowTxForm(false)} accounts={accounts} cards={cards} categories={categories} onSave={async (tx: Transaction) => { await saveFinanceData(accounts, cards, [...transactions, tx], categories, goals, challenges, receivables); }} onSaved={loadDataForUser} /> )}
            {isBackupModalOpen && ( <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} mode="RESTORE" onSuccess={() => {}} onRestoreSuccess={loadDataForUser} /> )}
            {isBulkDateModalOpen && ( <BulkDateModal isOpen={isBulkDateModalOpen} onClose={() => setIsBulkDateModalOpen(false)} onConfirm={handleBulkUpdateDate} darkMode={theme !== 'neutral' && theme !== 'rose'} /> )}
            {isClearLocalModalOpen && ( <ConfirmationModal isOpen={isClearLocalModalOpen} onClose={() => setIsClearLocalModalOpen(false)} onConfirm={() => { handleClearLocalData(); }} title="Resetar Banco de Dados Local?" message="Isso limpará seu cache temporário para forçar o download dos dados da nuvem. Use apenas para resolver erros de sincronia." type="WARNING" /> )}
            <Layout currentUser={currentUser!} activeTab={activeTab} setActiveTab={setActiveTab} appMode={appMode} setAppMode={setAppMode} currentTheme={theme} setTheme={setTheme} darkMode={theme !== 'neutral' && theme !== 'rose'} onLogout={logout} onNewSale={() => { setEditingSale(null); setShowSalesForm(true); }} onNewIncome={() => setShowTxForm(true)} onNewExpense={() => setShowTxForm(true)} onNewTransfer={() => setShowTxForm(true)} isAdmin={isAdmin} isDev={isDev} showSnow={showSnow} onToggleSnow={toggleSnow} >
                <div className="md:p-4"> {renderActiveTab()} </div>
            </Layout>
        </div>
    );
};

export default App;
