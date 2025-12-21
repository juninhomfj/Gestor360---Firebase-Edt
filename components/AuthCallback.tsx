
import React, { useEffect } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getSupabase } from '../services/supabase';
import Logo from './Logo';

interface AuthCallbackProps {
    onComplete: () => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onComplete }) => {
    const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = React.useState('');

    useEffect(() => {
        const handleCallback = async () => {
            const supabase = getSupabase();
            if (!supabase) {
                setStatus('error');
                setErrorMsg('Supabase não disponível.');
                return;
            }

            // O Supabase processa o fragmento da URL automaticamente via getSession()
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                setStatus('error');
                setErrorMsg(error.message);
            } else if (data.session) {
                setStatus('success');
                setTimeout(() => onComplete(), 1500);
            } else {
                setStatus('error');
                setErrorMsg('Nenhuma sessão encontrada no link.');
            }
        };

        handleCallback();
    }, [onComplete]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
                <Logo size="lg" className="mb-8 mx-auto" />
                
                {status === 'loading' && (
                    <div className="space-y-4">
                        <Loader2 className="mx-auto text-emerald-500 animate-spin" size={40} />
                        <h2 className="text-xl font-bold text-white">Validando Link...</h2>
                        <p className="text-slate-400 text-sm">Aguarde enquanto autenticamos seu acesso.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-4 animate-in fade-in">
                        <CheckCircle className="mx-auto text-emerald-500" size={40} />
                        <h2 className="text-xl font-bold text-white">Autenticado!</h2>
                        <p className="text-slate-400 text-sm">Redirecionando para o painel...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-4 animate-in shake">
                        <AlertTriangle className="mx-auto text-red-500" size={40} />
                        <h2 className="text-xl font-bold text-white">Falha no Link</h2>
                        <p className="text-red-400 text-sm">{errorMsg}</p>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold mt-4"
                        >
                            Voltar ao Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthCallback;
