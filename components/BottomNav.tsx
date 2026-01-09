
import React from 'react';
import { LayoutDashboard, ShoppingCart, Users, MessageCircle, Menu, PieChart, TrendingUp } from 'lucide-react';
import { AppMode } from '../types';

interface BottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    appMode: AppMode;
    toggleMenu: () => void;
    hasUnreadMessages: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({ 
    activeTab, setActiveTab, appMode, toggleMenu, hasUnreadMessages 
}) => {
    const isSales = appMode === 'SALES';

    const items = [
        { 
            id: isSales ? 'dashboard' : 'fin_dashboard', 
            label: 'Home', 
            icon: LayoutDashboard 
        },
        { 
            id: isSales ? 'sales' : 'fin_transactions', 
            label: isSales ? 'Vendas' : 'Extrato', 
            icon: isSales ? ShoppingCart : PieChart 
        },
        { 
            id: 'settings', // Mapeado para o Hub de Clientes/Config
            label: 'CRM', 
            icon: Users 
        },
        { 
            id: 'whatsapp_main', 
            label: 'Whats', 
            icon: MessageCircle 
        },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/80 backdrop-blur-xl border-t border-white/10 safe-pb animate-nav-pop shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-around h-16">
                {items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 relative ${isActive ? (isSales ? 'text-emerald-500' : 'text-blue-500') : 'text-slate-500'}`}
                        >
                            {isActive && (
                                <div className={`absolute top-0 w-8 h-1 rounded-full ${isSales ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`}></div>
                            )}
                            <item.icon size={22} className={`${isActive ? 'scale-110' : ''} transition-transform`} />
                            <span className="text-[10px] font-black uppercase tracking-tighter mt-1">{item.label}</span>
                        </button>
                    );
                })}
                
                {/* Botão de Menu (Abre a Sidebar) */}
                <button
                    onClick={toggleMenu}
                    className="flex flex-col items-center justify-center w-full h-full text-slate-500 relative"
                >
                    <div className="relative">
                        <Menu size={22} />
                        {hasUnreadMessages && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></span>
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter mt-1">Menu</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
