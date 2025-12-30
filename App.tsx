
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
    DashboardWidgetConfig, Client, SaleFormData
} from './types';

import {
    getStoredSales, getFinanceData, getSystemConfig, getReportConfig,
    getStoredTable, saveFinanceData, saveSingleSale, getClients,
    saveCommissionRules, bootstrapProductionData, saveReportConfig,
    saveSales, canAccess, computeCommissionValues, clearLocalCache
} from './services/logic';

import { reloadSession, logout } from './services/auth';
import { AudioService } from './services/audioService';
import { auth as fbAuth } from './services/firebase';
import { Logger } from './services/logger';

type AuthView = 'LOGIN' | 'REQUEST_RESET' | 'APP' | 'ERROR';

const App: React.FC = () => {
    const initRun = useRef(false);
    const versionCheckFailed = useRef(false);
    const currentVersion = useRef<string>("2.5.2"); 

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<AuthView>('LOGIN');
    const [authError, setAuthError] = useState<string | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isBulkDateModalOpen, setIsBulkDateModalOpen] = useState(false);
    const [isClearLocalModalOpen, setIsClearLocalModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);

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
    const [showSalesForm, setShowSalesForm] = useState(false);
    const [showTxForm, setShowTxForm] = useState(false);
    const [hideValues, setHideValues] = useState(false);

    const [dashboardConfig, setDashboardConfig] = useState<DashboardWidgetConfig>({
        showStats: true, showCharts: true, showRecents: true, showPacing: true, showBudgets: true
    });

    useEffect(() => {
        if (authView !== 'APP' || versionCheckFailed.current) return;
        const checkVersion = async () => {
            try {
                const response = await fetch(`/metadata.json?t=${Date.now()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.version && data.version !== currentVersion.current) {
                        setUpdateAvailable(true);
                    }
                } else {
                    versionCheckFailed.current = true;
                }
            } catch (e) {
                versionCheckFailed.current = true;
            }
        };
        const interval = setInterval(checkVersion, 1000 * 60 * 15);
        checkVersion(); 
        return () => clearInterval(interval);
    }, [authView]);

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
        } catch (e) {}
    };

    const handleBulkAddSales = async (newSalesData: SaleFormData[]) => {
        const uid = fbAuth.currentUser?.uid;
        if (!uid) return;

        try {
            setLoading(true);
            const convertedSales: Sale[] = newSalesData.map(data => {
                const rules = data.type === ProductType.NATAL ? rulesNatal : rulesBasic;
                const { commissionBase, commissionValue, rateUsed } = computeCommissionValues(
                    data.quantity, 
                    data.valueProposed, 
                    data.marginPercent, 
                    rules
                );

                const saleObj: Sale = {
                    id: crypto.randomUUID(),
                    userId: uid,
                    client: data.client,
                    quantity: data.quantity,
                    type: data.type,
                    status: data.isBilled ? 'FATURADO' : 'ORÇAMENTO',
                    valueProposed: data.valueProposed,
                    valueSold: data.valueSold,
                    marginPercent: data.marginPercent,
                    commissionBaseTotal: commissionBase,
                    commissionValueTotal: commissionValue,
                    commissionRateUsed: rateUsed,
                    isBilled: data.isBilled,
                    completionDate: data.completionDate,
                    hasNF: false,
                    observations: data.observations || "",
                    createdAt: new Date().toISOString(),
                    deleted: false
                };

                if (data.date) saleObj.date = data.date;
                if (data.quoteDate) saleObj.quoteDate = data.quoteDate;

                return saleObj;
            });

            await saveSales(convertedSales);
            addToast('SUCCESS', `${convertedSales.length} vendas importadas com sucesso!`);
            await loadDataForUser();
        } catch (e: any) {
            Logger.error("Falha fatal no processamento em massa", { error: e.message });
            addToast('ERROR', `Erro: ${e.message || 'Falha ao salvar dados.'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleClearLocalData = async () => {
        setLoading(true);
        try {
            await clearLocalCache();
            await loadDataForUser();
            addToast('SUCCESS', 'Cache local limpo. Dados recarregados do Firebase.');
        } catch (e) {
            addToast('ERROR', 'Falha ao limpar cache local.');
        } finally {
            setLoading(false);
            setIsClearLocalModalOpen(false);
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
                addToast('INFO', 'Nenhuma venda atende aos critérios.');
                return;
            }

            const updatedItems = toUpdate.map(s => ({ 
                ...s, 
                date: targetDate, 
                isBilled: true,
                updatedAt: new Date().toISOString()
            }));
            await saveSales(updatedItems);
            addToast('SUCCESS', `${updatedItems.length} vendas faturadas.`);
            await loadDataForUser();
        } catch (e) {
            addToast('ERROR', 'Erro no faturamento em massa.');
        } finally {
            setLoading(false);
            setIsBulkDateModalOpen(false);
        }
    };

    const handleExportSalesTemplate = () => {
        const headers = ["Cliente", "Quantidade", "Tipo (BASICA ou NATAL)", "Valor Unitario Proposto", "Valor Total Venda", "Margem (%)", "Data Faturamento (YYYY-MM-DD)", "Data Pedido (YYYY-MM-DD)", "Observacoes"];
        const rows = [
            ["Exemplo Cliente A", "10", "BASICA", "150.00", "1500.00", "5.0", "2024-03-15", "2024-03-01", "Pedido mensal padrão"],
            ["Exemplo Cliente B", "50", "NATAL", "200.00", "10000.00", "8.5", "", "2024-11-20", "Reserva de final de ano"]
        ];
        const content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "modelo_importacao_vendas.csv");
        link.click();
    };

    const handleRecalculateAdvanced = async (includeBilled: boolean, filterType: ProductType | 'ALL', dateFrom: string) => {
        try {
            setLoading(true);
            const targets = sales.filter(s => {
                if (s.deleted) return false;
                if (!includeBilled && s.date) return false;
                if (filterType !== 'ALL' && s.type !== filterType) return false;
                if (dateFrom) {
                    const comp = s.date || s.completionDate || '';
                    if (!comp.startsWith(dateFrom)) return false;
                }
                return true;
            });

            if (targets.length === 0) {
                addToast('INFO', 'Nenhuma venda atende aos filtros para recálculo.');
                return;
            }

            const updatedSales = targets.map(sale => {
                const rules = sale.type === ProductType.NATAL ? rulesNatal : rulesBasic;
                const { commissionBase, commissionValue, rateUsed } = computeCommissionValues(
                    sale.quantity, 
                    sale.valueProposed, 
                    sale.marginPercent, 
                    rules
                );
                return {
                    ...sale,
                    commissionBaseTotal: commissionBase,
                    commissionValueTotal: commissionValue,
                    commissionRateUsed: rateUsed,
                    updatedAt: new Date().toISOString()
                };
            });

            await saveSales(updatedSales);
            await loadDataForUser();
            addToast('SUCCESS', `${updatedSales.length} cálculos atualizados com precisão!`);
        } catch (e) {
            addToast('ERROR', 'Erro no recálculo avançado.');
        } finally {
            setLoading(false);
        }
    };

    const handleSystemRefresh = () => { window.location.reload(); };
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
                        onEdit={(s) => { setEditingSale(s); setShowSalesForm(true); }}
                        onDelete={async (s) => {
                            await saveSingleSale({ ...s, deleted: true });
                            loadDataForUser();
                        }}
                        onNew={() => { setEditingSale(null); setShowSalesForm(true); }}
                        onExportTemplate={handleExportSalesTemplate}
                        onImportFile={async () => {}} // Via onBulkAdd
                        onClearAll={() => setIsClearLocalModalOpen(true)}
                        onRestore={() => setIsBackupModalOpen(true)}
                        onOpenBulkAdvanced={() => setIsBulkDateModalOpen(true)}
                        onUndo={() => {}}
                        onBillSale={async (s, date) => {
                            await saveSingleSale({ ...s, date, isBilled: true });
                            loadDataForUser();
                        }}
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
                        onRecalculate={handleRecalculateAdvanced}
                        onBulkAdd={handleBulkAddSales}
                        hasUndo={false}
                        onNotify={addToast}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
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
                return ( <BoletoControl sales={sales} onUpdateSale={async (s) => { await saveSingleSale(s); loadDataForUser(); }} /> );
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
                            const updated = transactions.map(t => t.id === id ? {...t, deleted: true} : t);
                            await saveFinanceData(accounts, cards, updated, categories);
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
                            await saveFinanceData(accounts, cards, transactions, categories); // Note: receivables saving should be added to saveFinanceData or specific service
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
                        onDistribute={async (receivableId, distributions) => {
                            // Logic for distribution: update receivable to distributed, create transactions
                            // This would be complex in this file, ideally move to financeService
                            loadDataForUser();
                        }} 
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
                        onPayInvoice={async () => { loadDataForUser(); }}
                        darkMode={theme !== 'neutral' && theme !== 'rose'}
                        onNotify={addToast}
                    />
                );
            case 'fin_categories':
                return <FinanceCategories categories={categories} onUpdate={async (cats) => { await saveFinanceData(accounts, cards, transactions, cats); loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_goals':
                return <FinanceGoals goals={goals} onUpdate={async (gls) => { await saveFinanceData(accounts, cards, transactions, categories); /* Meta specific saving here */ loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'fin_challenges':
                return <FinanceChallenges challenges={challenges} cells={cells} onUpdate={async (chals, clls) => { await saveFinanceData(accounts, cards, transactions, categories); /* Challenge specific saving here */ loadDataForUser(); }} darkMode={theme !== 'neutral' && theme !== 'rose'} />;
            case 'settings':
                return (
                    <SettingsHub
                        rulesBasic={rulesBasic} rulesNatal={rulesNatal} rulesCustom={rulesCustom}
                        reportConfig={reportConfig}
                        onSaveRules={async (type, rules) => {
                            try {
                                await saveCommissionRules(type, rules);
                                addToast('SUCCESS', `Tabela ${type} actualizada!`);
                                await loadDataForUser();
                            } catch (e) { addToast('ERROR', 'Erro ao salvar.'); }
                        }}
                        onSaveReportConfig={async (config) => {
                            try {
                                await saveReportConfig(config);
                                setReportConfig(config);
                                addToast('SUCCESS', 'Parâmetros atualizados!');
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
            {showSnow && <SnowOverlay />}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {updateAvailable && ( <SystemUpdateNotify onUpdate={handleSystemRefresh} onDismiss={() => setUpdateAvailable(false)} /> )}
            {showSalesForm && ( <SalesForm isOpen={showSalesForm} onClose={() => { setShowSalesForm(false); setEditingSale(null); }} initialData={editingSale} onSave={saveSingleSale} onSaved={loadDataForUser} /> )}
            {showTxForm && ( <FinanceTransactionForm isOpen={showTxForm} onClose={() => setShowTxForm(false)} accounts={accounts} cards={cards} categories={categories} onSave={async (tx: Transaction) => { await saveFinanceData(accounts, cards, [...transactions, tx], categories); }} onSaved={loadDataForUser} /> )}
            {isBackupModalOpen && ( <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} mode="RESTORE" onSuccess={() => {}} onRestoreSuccess={loadDataForUser} /> )}
            {isBulkDateModalOpen && ( <BulkDateModal isOpen={isBulkDateModalOpen} onClose={() => setIsBulkDateModalOpen(false)} onConfirm={handleBulkUpdateDate} darkMode={theme !== 'neutral' && theme !== 'rose'} /> )}
            {isClearLocalModalOpen && ( <ConfirmationModal isOpen={isClearLocalModalOpen} onClose={() => setIsClearLocalModalOpen(false)} onConfirm={handleClearLocalData} title="Limpar Cache Local?" message="Isso apagará o cache deste navegador. Seus dados no Firebase NÃO serão afetados e serão baixados novamente." type="WARNING" confirmText="Limpar e Sincronizar" /> )}
            <Layout currentUser={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} appMode={appMode} setAppMode={setAppMode} currentTheme={theme} setTheme={setTheme} darkMode={theme !== 'neutral' && theme !== 'rose'} onLogout={logout} onNewSale={() => { setEditingSale(null); setShowSalesForm(true); }} onNewIncome={() => setShowTxForm(true)} onNewExpense={() => setShowTxForm(true)} onNewTransfer={() => setShowTxForm(true)} isAdmin={isAdmin} isDev={isDev} showSnow={showSnow} onToggleSnow={toggleSnow} >
                <div className="md:p-4"> {renderActiveTab()} </div>
            </Layout>
        </div>
    );
};

export default App;
