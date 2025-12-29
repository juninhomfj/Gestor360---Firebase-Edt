
import React from 'react';
import { RefreshCw, Save, ShieldCheck } from 'lucide-react';

interface SystemUpdateNotifyProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

const SystemUpdateNotify: React.FC<SystemUpdateNotifyProps> = ({ onUpdate, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-6 z-[100] max-w-sm animate-in slide-in-from-bottom-10 duration-500">
        <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-2xl shadow-2xl overflow-hidden ring-4 ring-black/5">
            <div className="bg-indigo-600 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <RefreshCw size={18} className="animate-spin-slow" />
                    Atualização Necessária
                </div>
                <button onClick={onDismiss} className="text-white/80 hover:text-white transition-colors text-xl font-bold">
                    &times;
                </button>
            </div>
            
            <div className="p-6">
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Nova versão detectada!</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Salve seu trabalho atual e clique no botão abaixo para atualizar o sistema e garantir que tudo funcione corretamente.
                </p>

                <button 
                    onClick={onUpdate}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    <RefreshCw size={16} /> Atualizar Agora
                </button>
                
                <p className="text-[10px] text-center text-gray-400 mt-4 uppercase font-bold tracking-tighter">
                    O progresso não salvo pode ser perdido.
                </p>
            </div>
        </div>
    </div>
  );
};

export default SystemUpdateNotify;
