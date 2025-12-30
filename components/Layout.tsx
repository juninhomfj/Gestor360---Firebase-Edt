
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Settings, Menu, X, ShoppingBag, Users, FileText, Wallet, PieChart, Moon, Target, Trophy, Tag, ArrowLeftRight, PiggyBank, List, LogOut, Sun, Palette, ClipboardList, BarChart2, Sparkles, HelpCircle, PartyPopper, CalendarClock, Cloud, MessageCircle, Zap, Trees, Flame, Lock, MessageSquare, Newspaper, Rocket, FlaskConical, Terminal, Snowflake } from 'lucide-react';
import { AppMode, User, AppTheme, AppNotification, SystemModules, InternalMessage } from '../types';
// Fix: Removed getUserPlanLabel as it is not exported from services/logic and not used in this component
import { getSystemConfig, canAccess } from '../services/logic';
import { getMessages } from '../services/internalChat';
import FAB from './FAB';
import NotificationCenter from './NotificationCenter';
import SyncStatus from './SyncStatus';
import Logo from './Logo';
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
  isAdmin: boolean;
  isDev: boolean;
  showSnow: boolean;
  onToggleSnow: () => void;
}

const THEME_CONFIG: Record<AppTheme, { background: string; sidebar: string; navActive: (mode: AppMode) => string; navInactive: string }> = {
    glass: {
        background: 'bg-slate-950 animate-aurora', 
        sidebar: 'bg-black/80 md:bg-black/30 backdrop-blur-2xl border-r border-white/10 text-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.5)]',
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
    isAdmin, isDev,
    showSnow, onToggleSnow
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const isDarkTheme = ['glass', 'cyberpunk', 'dark'].includes(currentTheme);
    if (isDarkTheme) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [currentTheme]);

  useEffect(() => {
      const loadMsgs = async () => {
          if (!currentUser) return;
          const msgs = await getMessages(currentUser.id, isAdmin);
          const unread = msgs.filter(m => !m.read && m.recipientId === currentUser.id).length;
          setUnreadCount(unread);
      };
      loadMsgs();
      const interval = setInterval(loadMsgs, 10000); 
      return () => clearInterval(interval);
  }, [currentUser, isAdmin]);

  const currentStyle = THEME_CONFIG[currentTheme] || THEME_CONFIG['glass'];
  
  const hasAccess = (mod: string) => {
      return canAccess(currentUser, mod);
  };

  const navigate = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const salesNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'reports', label: 'Relatórios & BI', icon: BarChart2, show: hasAccess('reports') },
    { id: 'sales', label: 'Minhas Vendas', icon: ShoppingCart, show: true },
    { id: 'boletos', label: 'Tarefas (Envios)', icon: ClipboardList, show: true }, 
    { id: 'settings', label: 'Configurações', icon: Settings, show: true }, 
  ];

  const financeNavItems = [
    { id: 'fin_dashboard', label: 'Visão Geral', icon: PieChart, show: true },
    { id: 'fin_receivables', label: 'A Receber', icon: PiggyBank, show: hasAccess('receivables') },
    { id: 'fin_distribution', label: 'Distribuição', icon: ArrowLeftRight, show: hasAccess('distribution') },
    { id: 'fin_transactions', label: 'Extrato', icon: List, show: true }, 
    { id: 'fin_manager', label: 'Contas & Cartões', icon: Wallet, show: true },
    { id: 'fin_categories', label: 'Categorias', icon: Tag, show: true },
    { id: 'fin_goals', label: 'Metas', icon: Target, show: true },
    { id: 'fin_challenges', label: 'Desafios', icon: Trophy, show: true },
    { id: 'settings', label: 'Configurações', icon: Settings, show: true },
  ];

  let currentNavItems = (appMode === 'SALES' ? salesNavItems : (appMode === 'FINANCE' ? financeNavItems : [])).filter(i => i.show);

  const toggleAppMode = () => {
    setAppMode(appMode === 'SALES' ? 'FINANCE' : 'SALES');
    setActiveTab(appMode === 'SALES' ? 'fin_dashboard' : 'dashboard');
    setIsMobileMenuOpen(false);
  };

  const UserAvatar = () => {
      if (currentUser.profilePhoto) return <img src={currentUser.profilePhoto} className="w-8 h-8 rounded-full object-cover border border-white/20" alt="Avatar"/>;
      return <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold border border-white/20 shadow-sm">{currentUser.name.substring(0, 2).toUpperCase()}</div>;
  };

  return (
    <div className={`flex h-[100dvh] overflow-hidden transition-all duration-500 relative ${currentStyle.background}`}>
      
      {/* Backdrop Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile Drawer */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 z-[70] flex flex-col transition-all duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${currentStyle.sidebar}`}>
        <div className={`p-6 flex items-center justify-between border-b border-white/5`}>
          <Logo size="sm" variant="full" lightMode={['glass', 'cyberpunk', 'dark'].includes(currentTheme)} planUser={currentUser} />
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {currentNavItems.map((item) => (
                <button key={item.id} onClick={() => navigate(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === item.id ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}>
                    <item.icon size={20} />
                    <span className="font-medium text-sm">{item.label}</span>
                </button>
          ))}

          <div className="pt-2 border-t border-white/5 space-y-1">
              <button 
                onClick={onToggleSnow}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 ${showSnow ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Snowflake size={20} className={showSnow ? 'animate-spin-slow' : ''} />
                <span className="font-medium text-sm">Let it Snow ❄️</span>
              </button>

              {hasAccess('whatsapp') && (
                  <button onClick={() => { setAppMode('WHATSAPP'); setActiveTab('whatsapp_main'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-300 border ${appMode === 'WHATSAPP' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500' : 'text-slate-400 hover:bg-white/5'}`}>
                      <MessageCircle size={18} className="mr-3" /> <span className="font-bold text-sm">WhatsApp 360</span>
                  </button>
              )}
              {isDev && (
                  <button onClick={() => { setActiveTab('dev_roadmap'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === 'dev_roadmap' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50' : 'text-slate-400 hover:bg-white/5'}`}>
                      <Terminal size={20} className="text-amber-500" /> <span className="font-bold text-sm text-amber-500">Engenharia v2.5</span>
                  </button>
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
                <UserAvatar />
                <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{currentUser.name}</p>
                    <span className="text-[9px] font-black uppercase text-indigo-500">{currentUser.role}</span>
                </div>
            </div>
            <button onClick={toggleAppMode} className={`w-full py-2 rounded-xl font-bold text-sm border ${appMode === 'SALES' ? 'bg-blue-600 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-lg'}`}>{`Ir para ${appMode === 'SALES' ? 'Finanças' : 'Vendas'}`}</button>
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 text-sm py-2 font-bold"><LogOut size={16} /> Sair</button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden z-10 relative">
        <header className="md:hidden h-16 flex items-center justify-between px-4 z-[50] bg-slate-950 border-b border-white/5 shrink-0">
          <Logo size="xs" variant="full" lightMode />
          <div className="flex items-center gap-3">
              <SyncStatus />
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-2 hover:bg-white/10 rounded-xl transition-all">
                <Menu size={24} />
              </button>
          </div>
        </header>

        {/* This container MUST allow scrolling */}
        <main className="flex-1 overflow-y-auto relative scrollbar-thin scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full pb-32">
            {children}
          </div>
        </main>
        
        {/* FAB position adjustment for mobile */}
        <div className="relative z-[40]">
           <FAB appMode={appMode} onNewSale={onNewSale} onNewIncome={onNewIncome} onNewExpense={onNewExpense} onNewTransfer={onNewTransfer} />
        </div>
      </div>

      {isChatOpen && <InternalChatSystem currentUser={currentUser} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} darkMode={true} />}
    </div>
  );
};

export default Layout;
