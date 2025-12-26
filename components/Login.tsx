import React, { useState } from 'react';
import { User } from '../types';
import { login } from '../services/auth';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!identifier || !password) {
        setError('Preencha todos os campos.');
        return;
    }

    setIsLoading(true);
    try {
        const { user, error: authError } = await login(identifier, password);
        if (user) {
            onLoginSuccess(user);
        } else {
            setError(authError || 'Falha na autenticação.');
            setIsLoading(false);
        }
    } catch (e: any) {
        setError('Erro ao conectar com o servidor.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-y-auto bg-slate-950 p-4 md:p-8 font-sans text-slate-200">
        
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-[440px] z-10 animate-pop-in">
            {/* Logo Area */}
            <div className="flex flex-col items-center mb-8">
                <Logo size="xl" variant="full" lightMode />
                <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Ambiente Criptografado
                </div>
            </div>

            {/* Login Card */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-10 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-6 text-center">Acesse sua Conta</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle size={16} className="shrink-0" /> 
                        <span className="font-bold">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail ou Usuário</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                            <input 
                                type="text"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/5 rounded-xl text-white outline-none focus:border-emerald-500/50 focus:ring-4 ring-emerald-500/5 transition-all text-sm"
                                placeholder="exemplo@empresa.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sua Senha</label>
                            <button 
                                type="button"
                                onClick={onRequestReset}
                                className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                            >
                                Esqueci a senha
                            </button>
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                            <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/5 rounded-xl text-white outline-none focus:border-emerald-500/50 focus:ring-4 ring-emerald-500/5 transition-all text-sm"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 shadow-xl shadow-emerald-900/20 border border-emerald-400/20 mt-4"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>Entrar no Sistema <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>
            </div>

            {/* Footer Area */}
            <div className="mt-10 flex flex-col items-center gap-6">
                <BrazilFlag className="scale-110" showSoundToggle={false} />
                
                <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        <span>Desenvolvido com</span>
                        <Heart size={10} className="text-red-500 fill-red-500 animate-pulse" />
                        <span>por <strong>Hypelab</strong></span>
                    </div>
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest">Versão 2.5.0 Stable • Cloud Native</p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Login;