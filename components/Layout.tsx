
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Settings, Menu, X, ShoppingBag, Users, FileText, Wallet, PieChart, Moon, Target, Trophy, Tag, ArrowLeftRight, PiggyBank, List, LogOut, Sun, Palette, ClipboardList, BarChart2, Sparkles, HelpCircle, PartyPopper, CalendarClock, Cloud, MessageCircle, Zap, Trees, Flame, Lock, MessageSquare, Newspaper, Rocket, FlaskConical, Terminal, Snowflake, BookOpen, Calculator, Home } from 'lucide-react';
import { AppMode, User, AppTheme, AppNotification, SystemModules, InternalMessage } from '../types';
import { getSystemConfig, canAccess } from '../services/logic';
import { getMessages } from '../services/internalChat';
import FAB from './FAB';
import NotificationCenter from './NotificationCenter';
import SyncStatus from './SyncStatus';
import Logo from './Logo';
import { AudioService } from '../services/audioService';
import InternalChatSystem from './InternalChatSystem'; 
import { safeInitials } from '../utils/stringUtils';
import BottomNav from './BottomNav';

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
  notifications: AppNotification[];
  onClearAllNotifications: () => void;
}

const THEME_CONFIG: Record<AppTheme, { background: string; sidebar: string; navActive: (mode: AppMode) => string; navInactive: string }> = {
    glass: {
        background: 'bg-slate-950 animate-aurora', 
        sidebar: 'bg-slate-900/90 md:bg-black/30 backdrop-blur-2xl border-r border-white/10 text-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.5)]',
        navActive: (mode) => {
            if (mode === 'SALES') return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
            if (mode === 'WHATSAPP') return 'bg-green-500/20 text-green-300 ring-1 ring-green-500/50';
            if (mode === 'FISCAL') return 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50';
            return 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50';
        },
        navInactive: 'text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200'
    },
    neutral: {
        background: 'bg-slate-50',
        sidebar: 'bg-white border-r border-slate-200 text-slate-700 shadow-sm',
        navActive: (mode) => 'bg-slate-800 text-white shadow-md shadow-slate-900/10',
        navInactive: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all'
    },
    rose: {
        background: 'bg-gradient-to-br from-rose-50 to-orange-50',
        sidebar: 'bg-white/80 backdrop-blur-xl border-r border-rose-100 text-rose-900 shadow-sm',
        navActive: (mode) => 'bg-rose-500 text-white shadow-lg shadow-rose-500/30',
        navInactive: 'text-rose-400 hover:bg-rose-50 hover:text-rose-700 transition-all'
    },
    cyberpunk: {
        background: 'bg-[#050505] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black',
        sidebar: 'bg-black border-r border-pink-500/20 text-cyan-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]',
        navActive: (mode) => 'bg-pink-600/10 border border-pink-500 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]',
        navInactive: 'text-slate-500 hover:text-cyan-300 hover:bg-cyan-900/10 transition-all'
    },
    dark: {
        background: 'bg-slate-950',
        sidebar: 'bg-slate-900 border-r border-slate-800 text-slate-300',
        navActive: (mode) => 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20',
        navInactive: 'text-slate-500 hover:bg-slate-800 hover:text-white transition-all'
    }
};

const Layout: React.FC<LayoutProps> = ({ 
    children, activeTab, setActiveTab, appMode, setAppMode, darkMode, currentTheme, setTheme,
    currentUser, onLogout,
    onNewSale, onNewIncome, onNewExpense, onNewTransfer,
    isAdmin, isDev,
    showSnow, onToggleSnow,
    notifications, onClearAllNotifications
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
      const interval = setInterval(loadMsgs, 15000); 
      return () => clearInterval(interval);
  }, [currentUser, isAdmin]);

  const currentStyle = THEME_CONFIG[currentTheme] || THEME_CONFIG['glass'];
  
  const hasAccess = (mod: string) => canAccess(currentUser, mod);

  const navigate = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  // Sidebar Items
  const salesNavItems = [
    { id: 'home', label: 'Menu Principal', icon: Home, show: true },
    { id: 'dashboard', label: 'Indicadores', icon: LayoutDashboard, show: true },
    { id: 'reports', label: 'Inteligência (BI)', icon: BarChart2, show: hasAccess('reports') },
    { id: 'sales', label: 'Gestão de Vendas', icon: ShoppingCart, show: true },
    { id: 'boletos', label: 'Controle Operacional', icon: ClipboardList, show: true }, 
    { id: 'settings', label: 'Hub de Clientes', icon: Users, show: true }, 
  ];

  const financeNavItems = [
    { id: 'home', label: 'Menu Principal', icon: Home, show: true },
    { id: 'fin_dashboard', label: 'Visão Geral', icon: PieChart, show: true },
    { id: 'fin_receivables', label: 'A Receber', icon: PiggyBank, show: hasAccess('receivables') },
    { id: 'fin_distribution', label: 'Distribuição', icon: ArrowLeftRight, show: hasAccess('distribution') },
    { id: 'fin_transactions', label: 'Extrato', icon: List, show: true }, 
    { id: 'fin_manager', label: 'Contas & Cartões', icon: Wallet, show: true },
    { id: 'fin_categories', label: 'Orçamentos', icon: Tag, show: true },
    { id: 'fin_goals', label: 'Metas', icon: Target, show: true },
    { id: 'fin_challenges', label: 'Desafios', icon: Trophy, show: true },
    { id: 'settings', label: 'Configurações', icon: Settings, show: true },
  ];

  const fiscalNavItems = [
    { id: 'home', label: 'Menu Principal', icon: Home, show: true },
    { id: 'fiscal_main', label: 'Fiscal 360', icon: Calculator, show: true },
    { id: 'settings', label: 'Configurações', icon: Settings, show: true },
  ];

  const getCurrentNavItems = () => {
    if (activeTab === 'home') return [{ id: 'home', label: 'Home', icon: Home, show: true }];
    if (appMode === 'SALES') return salesNavItems.filter(i => i.show);
    if (appMode === 'FINANCE') return financeNavItems.filter(i => i.show);
    if (appMode === 'FISCAL') return fiscalNavItems.filter(i => i.show);
    return [];
  };

  const toggleAppMode = () => {
    const modes: AppMode[] = ['SALES', 'FINANCE'];
    if (hasAccess('fiscal')) modes.push('FISCAL');
    
    const currentIndex = modes.indexOf(appMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];

    setAppMode(nextMode);
    if (nextMode === 'FINANCE') setActiveTab('fin_dashboard');
    else if (nextMode === 'FISCAL') setActiveTab('fiscal_main');
    else setActiveTab('dashboard');
  };

  return (
    <div className={`flex h-[100dvh] overflow-hidden transition-all duration-500 relative ${currentStyle.background}`}>
      
      {/* Sidebar Desktop */}
      <aside className={`fixed md:static inset-y-0 left-0 w-72 z-[80] flex flex-col transition-all duration-500 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${currentStyle.sidebar} md:rounded-r-[2.5rem] md:my-4 md:ml-4 md:h-[calc(100vh-2rem)] shadow-2xl`}>
        <div className={`p-8 flex items-center justify-between border-b border-white/5`}>
          <Logo size="sm" variant="full" lightMode={['glass', 'cyberpunk', 'dark'].includes(currentTheme)} planUser={currentUser} />
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/50 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          {getCurrentNavItems().map((item) => (
            <button 
              key={item.id} 
              onClick={() => navigate(item.id)} 
              className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${activeTab === item.id ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}
            >
                <item.icon size={22} className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-black text-[11px] uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
          
          <div className="pt-6 mt-6 border-t border-white/5">
                <button onClick={() => navigate('university')} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${activeTab === 'university' ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}>
                    <BookOpen size={22}/>
                    <span className="font-black text-[11px] uppercase tracking-widest">Academia 360</span>
                </button>
                {hasAccess('whatsapp') && (
                    <button onClick={() => { setAppMode('WHATSAPP'); navigate('whatsapp_main'); }} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl mt-2 transition-all duration-300 group ${activeTab === 'whatsapp_main' ? 'bg-green-600/20 text-green-400' : currentStyle.navInactive}`}>
                        <MessageCircle size={22}/>
                        <span className="font-black text-[11px] uppercase tracking-widest">WhatsApp MK</span>
                    </button>
                )}
          </div>
        </nav>

        <div className="p-6 border-t border-white/5">
            <button onClick={onLogout} className="w-full flex items-center space-x-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all font-black text-[11px] uppercase tracking-widest">
                <LogOut size={22}/>
                <span>Sair do Sistema</span>
            </button>
        </div>
      </aside>

      {/* Mobile Header Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 md:h-screen">
        <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
                <Menu size={24} />
              </button>
              <div className="hidden md:block">
                  <SyncStatus />
              </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button onClick={toggleAppMode} className={`px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${appMode === 'SALES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : appMode === 'FISCAL' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                {appMode}
            </button>
            <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
            <NotificationCenter notifications={notifications} onNotificationClick={navigate} onClearAll={onClearAllNotifications} />
            <button onClick={() => setIsChatOpen(true)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <MessageSquare size={22} />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-slate-950 animate-pulse">{unreadCount}</span>}
            </button>
          </div>
        </header>

        {/* Padding bottom adicionado para não cobrir conteúdo com a BottomNav em mobile */}
        <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-32 md:pb-10 custom-scrollbar">
           {children}
        </div>
      </main>

      {/* Floating Action Button */}
      <FAB 
        appMode={appMode} 
        onNewSale={onNewSale} 
        onNewIncome={onNewIncome} 
        onNewExpense={onNewExpense} 
        onNewTransfer={onNewTransfer} 
        isMobileView={true}
      />

      {/* Consistência: BottomNav em Mobile (Android/iOS) */}
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={navigate} 
        appMode={appMode} 
        toggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        hasUnreadMessages={unreadCount > 0} 
      />

      {isChatOpen && (
        <InternalChatSystem 
            currentUser={currentUser} 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            darkMode={['glass', 'cyberpunk', 'dark'].includes(currentTheme)}
        />
      )}
    </div>
  );
};

export default Layout;
