
import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Smartphone, Zap, Lock, Code2, CheckSquare, Server, FileText, Download, Activity, Database, Share2, Map, Eye, HardDrive, Cpu, Layers, Braces, Terminal, Construction, Copy, CheckCircle2, Brain, RefreshCw, Wifi, WifiOff, Calculator, AlertTriangle, Play, GitBranch, Trash2, FileOutput, FlaskConical, LayoutTemplate, ShieldAlert } from 'lucide-react';
import { getStoredSales, getFinanceData, hardResetLocalData } from '../services/logic';
import { getPendingSyncs } from '../storage/db';
import { auth, db } from '../services/firebase';
import { getSession } from '../services/auth';

const DevRoadmap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ROADMAP' | 'MAP' | 'DOCS' | 'TOOLS' | 'CODE' | 'PROMPT'>('ROADMAP');
  const [storageUsage, setStorageUsage] = useState<{usage: number, quota: number} | null>(null);
  const [dbStats, setDbStats] = useState({ sales: 0, transactions: 0, syncQueue: 0, size: 'Calc...' });
  const [firebaseStatus, setFirebaseStatus] = useState<string>('CONECTANDO...');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);

  const loadDiagnostics = async () => {
      setIsRefreshing(true);
      setIsSandbox(localStorage.getItem('SYS_ENV') === 'TEST');

      if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          setStorageUsage({ usage: estimate.usage || 0, quota: estimate.quota || 0 });
      }
      
      const s = await getStoredSales();
      const f = await getFinanceData();
      const q = await getPendingSyncs();
      const bytes = new Blob([JSON.stringify({s, f, q})]).size;
      
      setDbStats({ sales: s.length, transactions: f.transactions?.length || 0, syncQueue: q.length, size: (bytes / 1024).toFixed(2) + ' KB' });

      // @ts-ignore
      setFirebaseStatus(db && db.type !== 'mock' ? 'FIREBASE CLOUD ATIVO' : 'MODO LOCAL');
      setIsRefreshing(false);
  };

  useEffect(() => { loadDiagnostics(); }, []);

  const handleHardReset = () => {
    if(confirm('Isso apagará TODOS os dados locais. Tem certeza?')) {
        hardResetLocalData();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
        
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 text-slate-300 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Code2 size={120} /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Terminal className="text-emerald-500" /> Engenharia v2.5.0
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm">Monitoramento Firestore Realtime & BYOK Architecture.</p>
                </div>
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-slate-700">
            <TabBtn id="ROADMAP" label="Roadmap" active={activeTab} onClick={setActiveTab} />
            <TabBtn id="TOOLS" label="Ferramentas" active={activeTab} onClick={setActiveTab} />
            <TabBtn id="CODE" label="Source" active={activeTab} onClick={setActiveTab} />
        </div>

        {activeTab === 'TOOLS' && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DiagCard icon={<Database/>} title="Database Stats" value={`${dbStats.sales} v / ${dbStats.transactions} t`} sub={`Tamanho: ${dbStats.size}`} color="emerald" />
                    <DiagCard icon={<Server/>} title="Cloud Status" value={firebaseStatus} sub="Firestore Persistence" color="blue" />
                    <DiagCard icon={<Cpu/>} title="Sessão" value={getSession()?.role || 'Guest'} sub={isSandbox ? 'Ambiente Isolado' : 'Auth Online'} color="purple" />
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Play size={18} className="text-purple-500" /> Manutenção de Dados
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={loadDiagnostics} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs flex items-center gap-2">
                            <RefreshCw size={14}/> Atualizar Diagnóstico
                        </button>
                        <button onClick={handleHardReset} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-700 ml-auto">
                            <Trash2 size={14}/> Hard Reset Local
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'ROADMAP' && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-8 text-center">
                <Construction size={48} className="mx-auto text-amber-500 mb-4 animate-bounce" />
                <h3 className="text-xl font-bold">Arquitetura V2.5.0 FIREBASE NATIVE</h3>
                <p className="text-sm text-gray-500 mt-2">Remoção completa de pacotes Supabase. Migração para Firestore direta.</p>
            </div>
        )}
    </div>
  );
};

const TabBtn = ({id, label, active, onClick}: any) => (
    <button onClick={() => onClick(id)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${active === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
        {label}
    </button>
);

const DiagCard = ({icon, title, value, sub, color}: any) => (
    <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center gap-4 border-l-4 border-l-${color}-500 shadow-sm`}>
        <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600`}>{icon}</div>
        <div>
            <p className="text-[10px] font-bold uppercase opacity-50">{title}</p>
            <p className="text-lg font-black">{value}</p>
            <p className="text-[10px] opacity-70">{sub}</p>
        </div>
    </div>
);

export default DevRoadmap;
