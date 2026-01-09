
import React from 'react';
import { SYSTEM_MODULES } from '../config/modulesCatalog';
import { User, AppMode } from '../types';
import { canAccess } from '../services/logic';
import { LayoutDashboard, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
    currentUser: User;
    onNavigate: (route: string, mode: AppMode) => void;
    darkMode: boolean;
}

const HomeDashboard: React.FC<Props> = ({ currentUser, onNavigate, darkMode }) => {
    const accessibleModules = SYSTEM_MODULES.filter(m => canAccess(currentUser, m.key));

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">
            <header>
                <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                    <LayoutDashboard className="text-indigo-500" size={36} />
                    Olá, {currentUser.name.split(' ')[0]}
                </h1>
                <p className="text-gray-500 mt-2 text-lg">Bem-vindo ao seu centro de comando operacional.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accessibleModules.map((mod) => (
                    <button
                        key={mod.key}
                        onClick={() => onNavigate(mod.route, mod.appMode)}
                        className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:shadow-2xl hover:-translate-y-1 active:scale-95 relative overflow-hidden ${
                            darkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-gray-100 shadow-sm'
                        }`}
                    >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg transition-transform group-hover:scale-110 ${mod.color}`}>
                            <mod.icon size={28} />
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-black">{mod.label}</h3>
                                {mod.isBeta && (
                                    <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Beta</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 leading-relaxed font-medium line-clamp-2">
                                {mod.description}
                            </p>
                        </div>

                        <div className="mt-8 flex items-center justify-between text-indigo-500 font-black text-xs uppercase tracking-widest">
                            Acessar Módulo
                            <ArrowRight size={18} className="transition-transform group-hover:translate-x-2" />
                        </div>

                        {/* Background Effect */}
                        <div className={`absolute -bottom-10 -right-10 w-40 h-40 opacity-5 group-hover:opacity-10 transition-opacity rounded-full ${mod.color}`} />
                    </button>
                ))}
            </div>

            <div className={`p-8 rounded-[2.5rem] border bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-900/20 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative`}>
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                    <Sparkles size={160} />
                </div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-2">Precisa de suporte estratégico?</h3>
                    <p className="text-indigo-100 font-medium max-w-md">O Consultor IA Gestor360 está pronto para analisar seus números de vendas e finanças em tempo real.</p>
                </div>
                <button 
                    onClick={() => onNavigate('dashboard', 'SALES')}
                    className="relative z-10 bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                    Falar com Consultor
                </button>
            </div>
        </div>
    );
};

export default HomeDashboard;
