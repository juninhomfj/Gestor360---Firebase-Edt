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
        Logger.info(`Audit: Neve ${nextValue ? 'ativada' : 'desativada'}`);
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
            Logger.info("🚀 Auditoria: Inicializando Aplicação Gestor360");
            try {
                await AudioService.preload();
                const sessionUser = await reloadSession();
                if (sessionUser) {
                    await handleLoginSuccess(sessionUser);
                } else {
                    Logger.info("Audit: Nenhuma sessão ativa. Redirecionando Login.");
                    setAuthView('LOGIN');
                    setLoading(false);
                }
            } catch (e: any) {
                Logger.error("❌ Auditoria: Erro crítico na inicialização", e);
                setAuthError("Erro na conexão com Cloud Firestore. Verifique as credenciais.");
                setAuthView('ERROR');
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleLoginSuccess = async (user: User) => {
        setCurrentUser(user);
        Logger.info(`🔑 Audit: Login bem-sucedido: ${user.name}`);
        try {
            await bootstrapProductionData();
            await new Promise(r => setTimeout(r, 500));
            await loadDataForUser();
            setAuthView('APP');
        } catch (e) {
            Logger.error("Audit: Erro pós-login", e);
            setAuthView('APP');
        } finally {
            setLoading(false);
        }
    };

    const loadDataForUser = async () => {
        Logger.info("📥 Audit: Iniciando sincronização global de dados...");
        try {
            const [rBasic, rNatal, rCustom] = await Promise.all([
                getStoredTable(ProductType.BASICA).catch(e => { Logger.error("Audit: Falha Carregar Rules Basic", e); return [] as CommissionRule[]; }),
                getStoredTable(ProductType.NATAL).catch(e => { Logger.error("Audit: Falha Carregar Rules Natal", e); return [] as CommissionRule[]; }),
                getStoredTable(ProductType.CUSTOM).catch(e => { Logger.error("Audit: Falha Carregar Rules Custom", e); return [] as CommissionRule[]; })
            ]);
            setRulesBasic(rBasic);
            setRulesNatal(rNatal);
            setRulesCustom(rCustom);

            const results = await Promise.all([
                getStoredSales().catch(e => { Logger.error("Audit: Falha Carregar Sales", e); return [] as Sale[]; }), 
                getClients().catch(e => { Logger.error("Audit: Falha Carregar Clients", e); return [] as Client[]; }), 
                getFinanceData().catch(e => { 
                    Logger.error("Audit: Falha Carregar Finance", e); 
                    return { 
                        accounts: [], transactions: [], cards: [], categories: [], 
                        goals: [], challenges: [], cells: [], receivables: [] 
                    }; 
                }) as Promise<any>,
                getSystemConfig().catch(e => { Logger.error("Audit: Falha Carregar Config", e); return {} as any; }),
                getReportConfig().catch(e => { Logger.error("Audit: Falha Carregar Reports", e); return {} as any; })
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
            
            Logger.info("✅ Audit: Sincronização global concluída.");
        } catch (e) {
            Logger.error("🚨 Audit: Falha crítica na sincronização.");
        }
    };

    const handleSaveCommissionRulesInApp = async (type: ProductType, rules: CommissionRule[]) => {
        Logger.info(`💾 Audit: Usuário disparou salvamento de regras [${type}]`);
        try {
            await saveCommissionRules(type, rules);
            if (type === ProductType.BASICA) setRulesBasic(rules);
            else if (type === ProductType.NATAL) setRulesNatal(rules);
            addToast('SUCCESS', `Tabela ${type === ProductType.BASICA ? 'Básica' : 'Natal'} salva com sucesso.`);
            Logger.info(`✅ Audit: Tabela [${type}] atualizada.`);
        } catch (e) {
            Logger.error(`❌ Audit: Erro ao salvar regras [${type}]`, e);
            addToast('ERROR', 'Falha ao sincronizar parâmetros.');
        }
    };

    const handleClearLocalData = async () => {
        Logger.warn("⚠️ Audit: Solicitação manual de limpeza de cache.");
        setLoading(true);
        try {
            await clearLocalCache();
            Logger.info("Audit: Cache limpo. Reiniciando...");
            window.location.reload();
        } catch (e) {
            Logger.error("Audit: Erro ao limpar cache.", e);
            setLoading(false);
        }
    };

    const handleTabChange = (tab: string) => {
        Logger.info(`📍 Audit: Navegação para aba [${tab}]`);
        setActiveTab(tab);
        localStorage.setItem('sys_last_tab', tab);
    };

    const handleModeChange = (mode: AppMode) => {
        Logger.info(`🔄 Audit: Modo de sistema alterado para [${mode}]`);
        setAppMode(mode);
        localStorage.setItem('sys_last_mode', mode);
    };

    if (loading) return <LoadingScreen />;
    if (authView === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} onRequestReset={() => { Logger.info("Audit: Abrindo Recuperação de Senha"); setAuthView('REQUEST_RESET'); }} />;
    if (authView === 'REQUEST_RESET') return <RequestReset onBack={() => { Logger.info("Audit: Voltando p/ Login"); setAuthView('LOGIN'); }} />;
    if (authView === 'ERROR') return <div className="p-20 text-center text-red-500">{authError}</div>;

    return (
        <Layout 
            activeTab={activeTab} 
            setActiveTab={handleTabChange} 
            appMode={appMode} 
            setAppMode={handleModeChange} 
            darkMode={true}
            currentTheme={theme}
            setTheme={(t) => { Logger.info(`🎨 Audit: Tema alterado para [${t}]`); setTheme(t); }}
            currentUser={currentUser!}
            onLogout={() => { Logger.info("🚪 Audit: Logout solicitado."); logout(); }}
            onNewSale={() => { Logger.info("➕ Audit: Clique em Nova Venda"); setShowSalesForm(true); }}
            onNewIncome={() => { Logger.info("➕ Audit: Clique em Nova Receita"); setShowTxForm(true); }}
            onNewExpense={() => { Logger.info("➕ Audit: Clique em Nova Despesa"); setShowTxForm(true); }}
            onNewTransfer={() => { Logger.info("➕ Audit: Clique em Nova Transferência"); setShowTxForm(true); }}
            isAdmin={isAdmin}
            isDev={isDev}
            showSnow={showSnow}
            onToggleSnow={toggleSnow}
        >
            {activeTab === 'dashboard' && <Dashboard sales={sales} onNewSale={() => { Logger.info("➕ Audit: Dashboard > Nova Venda"); setShowSalesForm(true); }} darkMode={true} hideValues={hideValues} config={dashboardConfig} onToggleHide={() => { Logger.info(`👁️ Audit: Visibilidade alternada: ${!hideValues}`); setHideValues(!hideValues); }} onUpdateConfig={setDashboardConfig} currentUser={currentUser!} salesTargets={salesTargets} onUpdateTargets={setSalesTargets} isAdmin={isAdmin} isDev={isDev} />}
            {activeTab === 'sales' && <SalesList sales={sales} onEdit={(s) => { Logger.info(`📝 Audit: Editar Venda [${s.id}]`); setEditingSale(s); setShowSalesForm(true); }} onDelete={() => { Logger.info("🗑️ Audit: Remover Venda"); }} onNew={() => { Logger.info("➕ Audit: SalesList > Nova Venda"); setShowSalesForm(true); }} onExportTemplate={() => { Logger.info("📤 Audit: Exportar Template"); }} onClearAll={() => setIsClearLocalModalOpen(true)} onRestore={() => setIsBackupModalOpen(true)} onOpenBulkAdvanced={() => setIsBulkDateModalOpen(true)} onBillBulk={() => { Logger.info("💸 Audit: Faturar em Lote"); }} onDeleteBulk={() => { Logger.info("🗑️ Audit: Deletar em Lote"); }} onBulkAdd={() => { Logger.info("📦 Audit: Importação em lote"); }} onRecalculate={() => { Logger.info("🧮 Audit: Recalcular Comissões"); }} onNotify={addToast} darkMode={true} />}
            {activeTab === 'boletos' && <BoletoControl sales={sales} onUpdateSale={async (s) => { Logger.info(`📄 Audit: Atualizar Boleto [${s.id}]`); await saveSingleSale(s); }} />}
            {activeTab === 'reports' && <ClientReports sales={sales} config={reportConfig} onOpenSettings={() => handleTabChange('settings')} userId={currentUser!.id} darkMode={true} />}
            {activeTab === 'whatsapp_main' && <WhatsAppModule darkMode={true} sales={sales} />}
            {activeTab === 'fin_dashboard' && <FinanceDashboard accounts={accounts} transactions={transactions} cards={cards} receivables={receivables} darkMode={true} hideValues={hideValues} config={dashboardConfig} onToggleHide={() => setHideValues(!hideValues)} onUpdateConfig={setDashboardConfig} onNavigate={handleTabChange} />}
            {activeTab === 'fin_transactions' && <FinanceTransactionsList transactions={transactions} accounts={accounts} categories={categories} onDelete={() => { Logger.info("🗑️ Audit: Remover Transação"); }} darkMode={true} />}
            {activeTab === 'fin_receivables' && <FinanceReceivables receivables={receivables} onUpdate={() => { Logger.info("📥 Audit: Atualizar Recebíveis"); }} sales={sales} accounts={accounts} darkMode={true} />}
            {activeTab === 'fin_distribution' && <FinanceDistribution receivables={receivables} accounts={accounts} onDistribute={() => { Logger.info("↔️ Audit: Distribuir Lucros"); }} darkMode={true} />}
            {activeTab === 'fin_manager' && <FinanceManager accounts={accounts} cards={cards} transactions={transactions} onUpdate={() => { Logger.info("⚙️ Audit: Atualizar Contas"); }} onPayInvoice={() => { Logger.info("💳 Audit: Pagar Fatura"); }} darkMode={true} />}
            {activeTab === 'fin_categories' && <FinanceCategories categories={categories} onUpdate={() => { Logger.info("🏷️ Audit: Atualizar Categorias"); }} darkMode={true} />}
            {activeTab === 'fin_goals' && <FinanceGoals goals={goals} onUpdate={() => { Logger.info("🎯 Audit: Atualizar Metas"); }} darkMode={true} />}
            {activeTab === 'fin_challenges' && <FinanceChallenges challenges={challenges} cells={cells} onUpdate={() => { Logger.info("🏆 Audit: Atualizar Desafios"); }} darkMode={true} />}
            {activeTab === 'settings' && <SettingsHub rulesBasic={rulesBasic} rulesNatal={rulesNatal} rulesCustom={rulesCustom} reportConfig={reportConfig} onSaveRules={handleSaveCommissionRulesInApp} onSaveReportConfig={saveReportConfig} darkMode={true} currentUser={currentUser!} onUpdateUser={setCurrentUser} sales={sales} onUpdateSales={setSales} onNotify={addToast} isAdmin={isAdmin} isDev={isDev} />}
            {activeTab === 'dev_roadmap' && <DevRoadmap />}
            
            <SalesForm isOpen={showSalesForm} onClose={() => { setShowSalesForm(false); setEditingSale(null); }} onSaved={loadDataForUser} initialData={editingSale} />
            <FinanceTransactionForm isOpen={showTxForm} onClose={() => setShowTxForm(false)} onSaved={loadDataForUser} accounts={accounts} cards={cards} categories={categories} />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {showSnow && <SnowOverlay />}
        </Layout>
    );
};

export default App;
