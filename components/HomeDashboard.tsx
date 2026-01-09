import React, { useState } from 'react';
import { SYSTEM_MODULES } from '../config/modulesCatalog';
import { User, AppMode } from '../types';
import { canAccess } from '../services/logic';
import { sendMessage } from '../services/internalChat';
import { LayoutDashboard, ArrowRight, Sparkles, Lock, MessageSquare, ShieldCheck, Zap } from 'lucide-react';

interface Props {
    currentUser: User;
    onNavigate: (route: string, mode: AppMode) => void;
    darkMode: boolean;
}

const HomeDashboard: React.FC<Props> = ({ currentUser, onNavigate, darkMode }) => {
    const [isRequesting, setIsRequesting] = useState<string | null>(null);

    const handleContactAdmin = async (modLabel: string) => {
        setIsRequesting(modLabel);
        try {
            await sendMessage(
                currentUser,
                `Olá! Gostaria de solicitar informações e acesso ao módulo: [${modLabel}].`,
                'ACCESS_REQUEST',
                'ADMIN'
            );
            alert(`Sua solicitação para o módulo ${modLabel} foi enviada ao administrador.`);
        } catch (e) {
            alert("Erro ao enviar solicitação.");
        } finally {
            setIsRequesting(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="text-indigo-500" size={36} />
                        Olá, {currentUser.name.split(' ')[0]}
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">Selecione uma ferramenta no seu centro de comando operacional.</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Plataforma Ativa</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SYSTEM_MODULES.map((mod) => {
                    const hasAccess = canAccess(currentUser, mod.key);
                    const isDevModule = mod.key === 'dev';
                    
                    // Se for módulo de DEV e o usuário não for DEV, esconde.
                    if (isDevModule && currentUser.role !== 'DEV') return null;

                    return (
                        <div
                            key={mod.key}
                            className={`group p-8 rounded-[2.5rem] border text-left transition-all relative overflow-hidden flex flex-col h-full ${
                                !hasAccess ? 'opacity-70 grayscale' : ''
                            } ${
                                darkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-gray-100 shadow-sm'
                            } ${hasAccess ? 'hover:shadow-2xl hover:-translate-y-1' : ''}`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg transition-transform group-hover:scale-110 ${mod.color}`}>
                                {hasAccess ? <mod.icon size={28} /> : <Lock size={28} />}
                            </div>
                            
                            <div className="relative z-10 flex-1">
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

                            <div className="mt-8 pt-6 border-t dark:border-slate-800 flex items-center justify-between">
                                {hasAccess ? (
                                    <button
                                        onClick={() => onNavigate(mod.route, mod.appMode)}
                                        className="text-indigo-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"
                                    >
                                        Acessar Módulo
                                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-2" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleContactAdmin(mod.label)}
                                        disabled={isRequesting === mod.label}
                                        className="bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                    >
                                        {isRequesting === mod.label ? "Enviando..." : (
                                            <>
                                                <MessageSquare size={14} /> Contatar Admin
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            <div className={`absolute -bottom-10 -right-10 w-40 h-40 opacity-5 group-hover:opacity-10 transition-opacity rounded-full ${mod.color}`} />
                        </div>
                    );
                })}
            </div>

            <div className={`p-8 rounded-[2.5rem] border bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-900/20 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative`}>
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                    <Sparkles size={160} />
                </div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-2">Acesso Enterprise Gestor360</h3>
                    <p className="text-indigo-100 font-medium max-w-md">Todos os seus módulos de inteligência comercial em um único ecossistema Cloud nativo.</p>
                </div>
                <button 
                    onClick={() => onNavigate('dashboard', 'SALES')}
                    className="relative z-10 bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                    Indicadores Ativos
                </button>
            </div>
        </div>
    );
};

export default HomeDashboard;