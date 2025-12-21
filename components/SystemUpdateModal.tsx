
import React, { useEffect, useState } from 'react';
import { Cloud, Database, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';

interface SystemUpdateModalProps {
  isOpen: boolean;
  message: string;
  progress: number;
}

const FUNNY_MESSAGES = [
    "Contando moedas...",
    "Verificando se o café está quente...",
    "Alimentando a IA com dados frescos...",
    "Calibrando margens de lucro...",
    "Sincronizando satélites...",
    "Organizando as gavetas do banco de dados...",
    "Trazendo seus dados de volta do futuro..."
];

const SystemUpdateModal: React.FC<SystemUpdateModalProps> = ({ isOpen, message, progress }) => {
  const [funnyMsg, setFunnyMsg] = useState(FUNNY_MESSAGES[0]);

  useEffect(() => {
      if (isOpen) {
          const interval = setInterval(() => {
              setFunnyMsg(FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)]);
          }, 3000);
          return () => clearInterval(interval);
      }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
                <div className="w-20 h-20 bg-blue-500/10 dark:bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <Cloud size={40} className="text-blue-500 animate-pulse" />
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1">
                        <RefreshCw size={20} className="text-emerald-500 animate-spin" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Atualizando Sistema</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    {message}
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 mb-3 overflow-hidden border border-gray-300 dark:border-slate-600">
                    <div 
                        className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[pulse_1s_infinite]"></div>
                    </div>
                </div>
                
                <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">
                    <span>Iniciando</span>
                    <span>{progress}%</span>
                    <span>Concluído</span>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    <p className="text-xs text-blue-600 dark:text-blue-300 italic flex items-center justify-center gap-2">
                        <ShieldCheck size={14}/> {funnyMsg}
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SystemUpdateModal;
