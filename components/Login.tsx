
import React, { useState } from 'react';
import { User } from '../types';
import { login, sendMagicLink } from '../services/auth';
import { Lock, Mail, AlertCircle, ArrowRight, Sparkles, Wand2, KeyRound, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import BrazilFlag from './BrazilFlag';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onRequestReset: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onRequestReset }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!identifier) {
        setError('Preencha o seu e-mail/usuário.');
        return;
    }

    setIsLoading(true);

    try {
        if (isMagicLink) {
            if (!identifier.includes('@')) {
                throw new Error("Insira um e-mail válido para o link mágico.");
            }
            await sendMagicLink(identifier);
            setSuccessMsg("Instruções enviadas para seu e-mail! Verifique sua caixa de entrada.");
            setIsLoading(false);
        } else {
            const { user, error: authError } = await login(identifier, password);
            if (user) {
                onLoginSuccess(user);
            } else {
                setError(authError || 'Falha na autenticação.');
                setIsLoading(false);
            }
        }
    } catch (e: any) {
        setError(e.message || 'Erro inesperado.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 md:p-8 animate-aurora font-sans text-slate-200 bg-slate-950">
        <div className="w-full max-w-5xl bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-pop-in flex flex-col md:flex-row relative z-10">
            
            {/* Branding Column */}
            <div className="w-full md:w-5/12 bg-gradient-to-b from-slate-900/50 to-black/50 p-8 md:p-12 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between">
                <div className="relative z-10">
                    <div className="mb-8 transform origin-left hover:scale-105 transition-transform duration-500">
                        <Logo size="xl" variant="full" lightMode />
                    </div>
                    <div className="space-y-4 mt-12 opacity-80">
                        <p className="text-sm italic">"Segurança nativa e alta performance para sua gestão."</p>
                    </div>
                </div>
                <div className="relative z-10 pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        Ambiente Seguro Firestore
                    </div>
                </div>
            </div>

            {/* Form Column */}
            <div className="w-full md:w-7/12 p-8 md:p-16 flex flex-col justify-center bg-white/[0.02]">
                <div className="max-w-md mx-auto w-full">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {isMagicLink ? 'Login via Link Mágico' : 'Acesse seu Painel'}
                        </h2>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl text-xs flex items-center gap-3 mb-6 animate-in fade-in">
                            <AlertCircle size={16} className="shrink-0 text-red-400" /> 
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-xl text-xs flex items-center gap-3 mb-6 animate-in fade-in">
                            <Sparkles size={16} className="shrink-0 text-emerald-400" /> 
                            <span className="font-medium">{successMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5 group">
                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-widest">Identificação</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 text-slate-500" size={18} />
                                <input 
                                    type="text"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        {!isMagicLink && (
                            <div className="space-y-1.5 group">
                                <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-widest">Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
                                    <input 
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500/50 transition-all text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="pt-2 flex flex-col gap-3">
                            {/* 1. BOTÃO ENTRAR PRINCIPAL */}
                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-emerald-900/20 border border-emerald-400/20"
                            >
                                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isMagicLink ? 'Enviar Link de Acesso' : 'Entrar na Plataforma')}
                                <ArrowRight size={16} />
                            </button>

                            {/* 2. LINK MÁGICO ABAIXO DO BOTÃO PRINCIPAL */}
                            <button 
                                type="button"
                                onClick={() => { setIsMagicLink(!isMagicLink); setError(''); setSuccessMsg(''); }}
                                className="w-full py-3 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors border border-white/5 rounded-xl hover:bg-white/5"
                            >
                                {isMagicLink ? <KeyRound size={14}/> : <Wand2 size={14}/>}
                                {isMagicLink ? 'Usar minha senha' : 'Entrar via Link Mágico'}
                            </button>

                            {/* 3. ESQUECI SENHA ABAIXO DO LINK MÁGICO */}
                            <button 
                                type="button"
                                onClick={onRequestReset}
                                className="w-full py-2 text-[11px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wide text-center"
                            >
                                Esqueci minha senha
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
                        <BrazilFlag className="opacity-80" showSoundToggle={false} />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Login;
