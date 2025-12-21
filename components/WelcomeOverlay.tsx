
import React, { useState } from 'react';
import { ShoppingBag, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

interface WelcomeOverlayProps {
  onDismiss: () => void;
}

const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onDismiss }) => {
  const [step, setStep] = useState(1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
            
            <div className="p-8 text-center">
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-emerald-900/20">
                            <ShoppingBag size={40} className="text-emerald-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-3">Bem-vindo ao Vendas360</h1>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            Sua central completa para gestão de vendas e inteligência comercial.
                            Controle comissões, gerencie clientes e acompanhe seu desempenho.
                        </p>
                        <button onClick={() => setStep(2)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                            Começar <ArrowRight size={20}/>
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500">
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                <ShieldCheck size={32} className="text-blue-400 mb-2 mx-auto"/>
                                <h3 className="font-bold text-white">Privacidade</h3>
                                <p className="text-xs text-slate-500">Seus dados ficam salvos apenas no seu dispositivo.</p>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                <Zap size={32} className="text-yellow-400 mb-2 mx-auto"/>
                                <h3 className="font-bold text-white">Rapidez</h3>
                                <p className="text-xs text-slate-500">Interface ágil pensada para o dia a dia.</p>
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm mb-8">
                            Explore o sistema. Quando estiver pronto para organizar suas contas, acesse a aba <strong>Finanças</strong> para um setup específico.
                        </p>
                        <button onClick={onDismiss} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                            Acessar Sistema <ArrowRight size={20}/>
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default WelcomeOverlay;
