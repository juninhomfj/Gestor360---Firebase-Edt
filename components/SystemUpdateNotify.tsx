
import React from 'react';
import { RefreshCw, AlertTriangle, Save, ShieldCheck } from 'lucide-react';

interface SystemUpdateNotifyProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

const SystemUpdateNotify: React.FC<SystemUpdateNotifyProps> = ({ onUpdate, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-6 z-[100] max-w-sm animate-in slide-in-from-bottom-10 duration-500">
        <div className="bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-emerald-600 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <RefreshCw size={18} className="animate-spin-slow" />
                    Atualização Disponível
                </div>
                <button onClick={onDismiss} className="text-white/80 hover:text-white transition-colors">
                    <span className="sr-only">Fechar</span>
                    &times;
                </button>
            </div>
            
            <div className="p-5">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                    Uma nova versão do sistema foi detectada. Para garantir a integridade dos seus dados:
                </p>
                
                <ul className="space-y-2 mb-5">
                    <li className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={14} /> 1. Salve seu trabalho atual.
                    </li>
                    <li className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                        <Save size={14} /> 2. Sincronize com a Nuvem.
                    </li>
                    <li className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={14} /> 3. Clique em Atualizar.
                    </li>
                </ul>

                <button 
                    onClick={onUpdate}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCw size={16} /> Atualizar Sistema Agora
                </button>
            </div>
        </div>
    </div>
  );
};

export default SystemUpdateNotify;
