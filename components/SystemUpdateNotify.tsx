
import React from 'react';
import { RefreshCw, ShieldCheck, ArrowRight } from 'lucide-react';

interface SystemUpdateNotifyProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

const SystemUpdateNotify: React.FC<SystemUpdateNotifyProps> = ({ onUpdate, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-6 right-6 md:right-auto md:max-w-md z-[100] animate-in slide-in-from-bottom-10 duration-500">
        <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-3xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] overflow-hidden ring-4 ring-black/5">
            <div className="bg-indigo-600 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest">
                    <ShieldCheck size={16} />
                    Integridade do Sistema
                </div>
                <button onClick={onDismiss} className="text-white/80 hover:text-white transition-colors text-xl font-bold">
                    &times;
                </button>
            </div>
            
            <div className="p-6">
                <h4 className="font-black text-gray-900 dark:text-white text-lg mb-2">Nova versão do sistema detectada.</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed font-medium">
                    Salve seu trabalho e clique no botão abaixo para atualizar. Você não será desconectado.
                </p>

                <button 
                    onClick={onUpdate}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 group"
                >
                    <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                    Atualizar Agora
                    <ArrowRight size={18} />
                </button>
                
                <p className="text-[10px] text-center text-gray-400 mt-4 uppercase font-black tracking-tighter opacity-60">
                    Garante compatibilidade total com as novas regras de acesso.
                </p>
            </div>
        </div>
    </div>
  );
};

export default SystemUpdateNotify;
