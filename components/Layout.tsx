
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Settings, Menu, X, ShoppingBag, Users, FileText, Wallet, PieChart, Moon, Target, Trophy, Tag, ArrowLeftRight, PiggyBank, List, LogOut, Sun, Palette, ClipboardList, BarChart2, Sparkles, HelpCircle, PartyPopper, CalendarClock, Cloud, MessageCircle, Zap, Trees, Flame, Lock, MessageSquare, Newspaper, Rocket, FlaskConical, Terminal } from 'lucide-react';
import { AppMode, User, AppTheme, AppNotification, SystemModules, InternalMessage } from '../types';
import { getSystemConfig, canAccess, getUserPlanLabel } from '../services/logic';
import { getMessages } from '../services/internalChat';
import FAB from './FAB';
import NotificationCenter from './NotificationCenter';
import SyncStatus from './SyncStatus';
import InstallPwa from './InstallPwa'; 
import Logo from './Logo';
import confetti from 'canvas-confetti';
import { AudioService } from '../services/audioService';
import InternalChatSystem from './InternalChatSystem'; 

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  darkMode: boolean; 
  currentTheme: AppTheme; 
  setTheme: (theme: AppTheme) => void;
  currentUser: User;
  onLogout: () => void;
  onNewSale: () => void;
  onNewIncome: () => void;
  onNewExpense: () => void;
  onNewTransfer: () => void;
  notifications?: AppNotification[];
  onNotificationClick?: (notif: AppNotification) => void;
  onClearNotifications?: () => void;
  isAdmin: boolean;
  isDev: boolean;
}

const THEME_CONFIG: Record<AppTheme, { background: string; sidebar: string; navActive: (mode: AppMode) => string; navInactive: string }> = {
    glass: {
        background: 'bg-slate-950 animate-aurora', 
        sidebar: 'bg-black/30 backdrop-blur-2xl border-r border-white/10 text-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.5)]',
        navActive: (mode) => mode === 'SALES' 
            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md' 
            : (mode === 'WHATSAPP' ? 'bg-green-500/20 text-green-300 ring-1 ring-green-500/50' : 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'),
        navInactive: 'text-slate-400 hover:bg-white/5 hover:text-white transition-colors'
    },
    neutral: {
        background: 'bg-slate-50',
        sidebar: 'bg-white border-r border-slate-200 text-slate-700 shadow-sm',
        navActive: (mode) => 'bg-slate-800 text-white shadow-md shadow-slate-900/10',
        navInactive: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    },
    rose: {
        background: 'bg-gradient-to-br from-rose-50 to-orange-50',
        sidebar: 'bg-white/80 backdrop-blur-xl border-r border-rose-100 text-rose-900 shadow-sm',
        navActive: (mode) => 'bg-rose-500 text-white shadow-lg shadow-rose-500/30',
        navInactive: 'text-rose-400 hover:bg-rose-50 hover:text-rose-700'
    },
    cyberpunk: {
        background: 'bg-[#050505] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black',
        sidebar: 'bg-black border-r border-pink-500/20 text-cyan-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]',
        navActive: (mode) => 'bg-pink-600/10 border border-pink-500 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]',
        navInactive: 'text-slate-500 hover:text-cyan-300 hover:bg-cyan-900/10'
    },
    dark: {
        background: 'bg-slate-950',
        sidebar: 'bg-slate-900 border-r border-slate-800 text-slate-300',
        navActive: (mode) => 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20',
        navInactive: 'text-slate-500 hover:bg-slate-800 hover:text-white'
    }
};

const Layout: React.FC<LayoutProps> = ({ 
    children, activeTab, setActiveTab, appMode, setAppMode, darkMode, currentTheme, setTheme,
    currentUser, onLogout,
    onNewSale, onNewIncome, onNewExpense, onNewTransfer,
    notifications = [], onNotificationClick = (_: AppNotification) => {}, onClearNotifications,
    isAdmin, isDev
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [sysModules, setSysModules] = React.useState<SystemModules>({ sales: true, finance: true, ai: true, imports: true, receivables: true, distribution: true, whatsapp: false, reports: true, news: true, crm: true, dev: false });
  const [requestModal, setRequestModal] = useState<{ isOpen: boolean, module: string }>({ isOpen: false, module: '' });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    const isDarkTheme = ['glass', 'cyberpunk', 'dark'].includes(currentTheme);
    if (isDarkTheme) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    getSystemConfig().then(cfg => { if(cfg.modules) setSysModules(prev => ({ ...prev, ...cfg.modules })); });
    setIsSandbox(localStorage.getItem('SYS_ENV') === 'TEST');
  }, [currentTheme]);

  useEffect(() => {
      const loadMsgs = async () => {
          if (!currentUser) return;
          const msgs = await getMessages(currentUser.id, isAdmin);
          const unread = msgs.filter(m => {
              if (!m.read && m.recipientId === currentUser.id) return true;
              if (m.recipientId === 'BROADCAST' && (!m.readBy || !m.readBy.includes(currentUser.id))) return true;
              return false;
          }).length;
          setUnreadCount(unread);
      };
      loadMsgs();
      const interval = setInterval(loadMsgs, 10000); 
      return () => clearInterval(interval);
  }, [currentUser, isAdmin]);

  const currentStyle = THEME_CONFIG[currentTheme] || THEME_CONFIG['glass'];
  
  /**
   * Helper de permissão que respeita a hierarquia normalizada
   */
  const hasAccess = (mod: any) => {
      if (isDev) return true; // DEV acessa tudo
      if (isAdmin) return true; // ADMIN acessa quase tudo (filtros manuais por módulo)
      return sysModules[mod as keyof SystemModules] !== false && canAccess(currentUser, mod);
  };

  const isUserAiEnabled = (currentUser.keys?.isGeminiEnabled === true && hasAccess('ai')) || isAdmin;

  const handleSmartNotificationClick = (notif: AppNotification) => {
      if (onNotificationClick) onNotificationClick(notif);
      if (notif.source === 'SALES') { setAppMode('SALES'); setActiveTab('sales'); } 
      else if (notif.source === 'FINANCE') { setAppMode('FINANCE'); setActiveTab('fin_dashboard'); }
      else if (notif.type === 'MESSAGE') setIsChatOpen(true);
  };

  const salesNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(hasAccess('reports') ? [{ id: 'reports', label: 'Relatórios & BI', icon: BarChart2 }] : []),
    { id: 'sales', label: 'Minhas Vendas', icon: ShoppingCart },
    ...(isUserAiEnabled ? [{ id: 'ai_consultant', label: 'Consultor IA', icon: Sparkles }] : []),
    { id: 'boletos', label: 'Tarefas (Envios)', icon: ClipboardList }, 
  ];

  const financeNavItems = [
    { id: 'fin_dashboard', label: 'Visão Geral', icon: PieChart },
    ...(hasAccess('reports') ? [{ id: 'fin_reports', label: 'Relatórios Financeiros', icon: BarChart2 }] : []),
    ...(sysModules.receivables ? [{ id: 'fin_receivables', label: 'A Receber', icon: PiggyBank }] : []),
    ...(sysModules.distribution ? [{ id: 'fin_distribution', label: 'Distribuição', icon: ArrowLeftRight }] : []),
    { id: 'fin_transactions', label: 'Extrato', icon: List }, 
    { id: 'fin_pending', label: 'Contas a Pagar', icon: CalendarClock }, 
    { id: 'fin_manager', label: 'Contas & Cartões', icon: Wallet },
    { id: 'fin_categories', label: 'Categorias', icon: Tag },
    { id: 'fin_goals', label: 'Metas', icon: Target },
    { id: 'fin_challenges', label: 'Desafios', icon: Trophy },
    ...(isUserAiEnabled ? [{ id: 'ai_consultant', label: 'Consultor IA', icon: Sparkles }] : []),
  ];

  let currentNavItems = appMode === 'SALES' ? salesNavItems : (appMode === 'FINANCE' ? financeNavItems : [{ id: 'whatsapp_main', label: 'Painel WhatsApp', icon: MessageCircle }]);

  const toggleAppMode = () => {
    if (hasAccess('sales') && hasAccess('finance')) {
        setAppMode(appMode === 'SALES' ? 'FINANCE' : 'SALES');
        setActiveTab(appMode === 'SALES' ? 'fin_dashboard' : 'dashboard');
    } else {
        setRequestModal({ isOpen: true, module: appMode === 'SALES' ? 'Financeiro' : 'Vendas' });
    }
  };

  const UserAvatar = ({ size = 'md' }: any) => {
      const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'md' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
      if (currentUser.profilePhoto) return <img src={currentUser.profilePhoto} className={`${sizeClass} rounded-full object-cover border border-white/20`} alt="Avatar"/>;
      return <div className={`${sizeClass} rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold border border-white/20 shadow-sm`}>{currentUser.name.substring(0, 2).toUpperCase()}</div>;
  };

  return (
    <div className={`flex h-[100dvh] overflow-hidden transition-all duration-500 relative ${currentStyle.background} ${currentTheme === 'neutral' ? 'font-sans' : ''}`}>
      
      {/* Sidebar Desktop */}
      <aside className={`hidden md:flex flex-col w-64 z-20 transition-colors duration-300 ${currentStyle.sidebar}`}>
        <div className={`p-6 flex items-center justify-between border-b border-white/5`}>
          <Logo size="sm" variant="full" lightMode={['glass', 'cyberpunk', 'dark'].includes(currentTheme)} planUser={currentUser} />
          <NotificationCenter notifications={notifications} onNotificationClick={handleSmartNotificationClick} onClearAll={onClearNotifications} />
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {currentNavItems.map((item) => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === item.id ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}>
                    <item.icon size={20} />
                    <span className="font-medium text-sm">{item.label}</span>
                </button>
          ))}

          <div className="pt-2 border-t border-white/5 space-y-2">
              {hasAccess('whatsapp') && (
                  <button onClick={() => { setAppMode('WHATSAPP'); setActiveTab('whatsapp_main'); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-300 border ${appMode === 'WHATSAPP' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500' : 'text-slate-400 hover:bg-white/5'}`}>
                      <MessageCircle size={18} className="mr-3" /> <span className="font-bold text-sm">WhatsApp 360</span>
                  </button>
              )}
              {isDev && (
                  <button onClick={() => setActiveTab('dev_roadmap')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === 'dev_roadmap' ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}>
                      <Terminal size={20} className="text-amber-500" /> <span className="font-bold text-sm text-amber-500">Engenharia Admin</span>
                  </button>
              )}
              {isAdmin && (
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === 'settings' ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}><Settings size={20} /> <span className="font-medium text-sm">Configurações</span></button>
              )}
          </div>
        </nav>

        <div className={`p-4 border-t border-white/5 space-y-3`}>
            <div className="px-2 flex justify-between items-center">
                <SyncStatus />
                <button onClick={() => setIsChatOpen(true)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                    <MessageSquare size={20} /> {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
            </div>
            <div className="flex items-center gap-3 px-2">
                <UserAvatar size="md" />
                <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">@{currentUser.username}</p>
                    <span className="text-[9px] font-black uppercase text-indigo-500">{currentUser.role}</span>
                </div>
            </div>
            <button onClick={toggleAppMode} className={`w-full py-2 rounded-xl font-bold text-sm border ${appMode === 'SALES' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>{`Ir para ${appMode === 'SALES' ? 'Finanças' : 'Vendas'}`}</button>
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 text-sm py-2"><LogOut size={16} /> Sair</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden z-10">
        {isSandbox && <div className="bg-amber-500 text-white text-[10px] font-bold text-center py-1 z-50 flex justify-center items-center gap-2"><FlaskConical size={12}/> AMBIENTE DE TESTE (SANDBOX) - DADOS NÃO SERÃO SALVOS NA NUVEM</div>}

        <header className="md:hidden h-16 flex items-center justify-between px-4 z-20 bg-slate-950 border-b border-white/5">
          <Logo size="xs" variant="full" lightMode />
          <div className="flex items-center gap-3">
              <SyncStatus />
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white"><Menu size={24} /></button>
          </div>
        </header>

        {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-[200] bg-slate-950 overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
                    <Logo size="sm" variant="full" lightMode />
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white"><X size={28} /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setAppMode('SALES'); setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={`p-3 rounded-xl font-bold flex flex-col items-center border ${appMode === 'SALES' ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-900'}`}><ShoppingCart size={20}/> Vendas</button>
                        <button onClick={() => { setAppMode('FINANCE'); setActiveTab('fin_dashboard'); setIsMobileMenuOpen(false); }} className={`p-3 rounded-xl font-bold flex flex-col items-center border ${appMode === 'FINANCE' ? 'bg-blue-600 border-blue-500' : 'bg-slate-900'}`}><PieChart size={20}/> Finanças</button>
                    </div>
                    {currentNavItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-4 rounded-xl transition-all ${activeTab === item.id ? 'bg-white/10 text-white' : 'text-slate-400'}`}><item.icon size={20} /><span className="font-medium">{item.label}</span></button>
                    ))}
                    <div className="pt-4 border-t border-white/10 space-y-4">
                        {hasAccess('whatsapp') && <button onClick={() => { setAppMode('WHATSAPP'); setActiveTab('whatsapp_main'); setIsMobileMenuOpen(false); }} className="w-full flex items-center p-4 bg-emerald-600/10 text-emerald-500 rounded-xl font-bold"><MessageCircle size={20} className="mr-3"/> WhatsApp 360</button>}
                        {isDev && <button onClick={() => { setActiveTab('dev_roadmap'); setIsMobileMenuOpen(false); }} className="w-full flex items-center p-4 bg-amber-600/10 text-amber-500 rounded-xl font-bold"><Terminal size={20} className="mr-3"/> Engenharia Admin</button>}
                        {isAdmin && <button onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} className="w-full flex items-center p-4 text-slate-400"><Settings size={20} className="mr-3"/> Configurações</button>}
                        <button onClick={onLogout} className="w-full flex items-center p-4 text-red-500 font-bold border border-red-500/20 rounded-xl mt-4"><LogOut size={20} className="mr-3"/> Sair</button>
                    </div>
                </div>
            </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8 relative scrollbar-thin">
          {children}
        </main>
        <FAB appMode={appMode} onNewSale={onNewSale} onNewIncome={onNewIncome} onNewExpense={onNewExpense} onNewTransfer={onNewTransfer} />
      </div>

      {requestModal.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-700">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3"><Lock size={32} className="text-gray-400" /></div>
                      <h3 className="text-xl font-bold text-white">Acesso Bloqueado</h3>
                      <p className="text-sm text-gray-500 mt-2">Você não tem permissão para o módulo <strong>{requestModal.module}</strong>.</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setRequestModal({isOpen: false, module: ''})} className="flex-1 py-3 border border-slate-700 rounded-lg font-bold text-gray-400">Cancelar</button>
                      <button onClick={() => { setRequestModal({isOpen: false, module: ''}); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold">Solicitar</button>
                  </div>
              </div>
          </div>
      )}

      {isChatOpen && <InternalChatSystem currentUser={currentUser} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} darkMode={true} />}
    </div>
  );
};

export default Layout;
