
import React, { useState } from 'react';
import { SYSTEM_MODULES } from '../config/modulesCatalog';
import { User, AppMode } from '../types';
import { canAccess } from '../services/logic';
import { updateUser } from '../services/auth';
import { LayoutDashboard, ArrowRight, Sparkles, CheckCircle, Info, Home } from 'lucide-react';

interface Props {
    currentUser: User;
    onNavigate: (route: string, mode: AppMode) => void;
    darkMode: boolean;
}

const HomeDashboard: React.FC<Props> = ({ currentUser, onNavigate, darkMode }) => {
    const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem("sys_onboarded_v1") !== "true");
    const [selectedDefault, setSelectedDefault] = useState("home");
    const [isSaving, setIsSaving] = useState(false);

    const isDev = currentUser.role === 'DEV';
    
    // Regras de visibilidade para o onboarding
    const moduleOptions = SYSTEM_MODULES.filter(mod => {
        if (isDev) return true; // DEV vê tudo
        // ADMIN/USER vê apenas o que tem acesso, ocultando sempre o módulo 'dev'
        return canAccess(currentUser, mod.key) && mod.key !== 'dev';
    });

    const accessibleModules = SYSTEM_MODULES.filter(m => canAccess(currentUser, m.key));

    const handleFinishOnboarding = async () => {
        setIsSaving(true);
        try {
            // Salva preferência no campo CANÔNICO
            await updateUser(currentUser.id, { 
                prefs: { 
                    ...currentUser.prefs, 
                    defaultModule: selectedDefault 
                } 
            });
            
            localStorage.setItem("sys_onboarded_v1", "true");
            setShowOnboarding(false);

            // Redireciona se não for "home"
            if (selectedDefault !== "home") {
                const targetMod = SYSTEM_MODULES.find(m => m.route === selectedDefault);
                if (targetMod) {
                    onNavigate(targetMod.route, targetMod.appMode);
                }
            }
        } catch (e) {
            alert("Erro ao salvar preferência. Tente novamente.");
        } finally {
            setIsSaving(false);
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
                    <p className="text-gray-500 mt-2 text-lg">Bem-vindo ao seu centro de comando operacional.</p>
                </div>
                {/* Badge de Status Cloud */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Sessão Segura Cloud</span>
                </div>
            </header>

            {/* Widget de Onboarding (Primeiro Acesso) */}
            {showOnboarding && (
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                        <Sparkles size={120} />
                    </div>
                    
                    <div className="relative z-10 max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Primeiro Acesso</span>
                            <h2 className="text-2xl font-black tracking-tight">Configure sua Experiência</h2>
                        </div>
                        <p className="text-indigo-100 font-medium text-sm mb-8 leading-relaxed">
                            Como você prefere começar? Escolha qual tela o sistema deve abrir automaticamente assim que você entrar. Você pode mudar isso depois no seu perfil.
                        </p>

                        <div className="flex flex-col sm:flex-row items-end gap-4">
                            <div className="flex-1 w-full">
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">Tela Inicial do Sistema</label>
                                <div className="relative">
                                    <select 
                                        value={selectedDefault}
                                        onChange={(e) => setSelectedDefault(e.target.value)}
                                        className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 font-bold text-white outline-none focus:ring-2 ring-white/30 transition-all appearance-none"
                                    >
                                        <option value="home" className="text-indigo-900">Dashboard Geral (Menu)</option>
                                        {moduleOptions.map(m => (
                                            <option key={m.key} value={m.route} className="text-indigo-900">{m.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                        <ArrowRight size={18} className="rotate-90" />
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleFinishOnboarding}
                                disabled={isSaving}
                                className="w-full sm:w-auto bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? "Gravando..." : "Definir e Continuar"}
                                <CheckCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
