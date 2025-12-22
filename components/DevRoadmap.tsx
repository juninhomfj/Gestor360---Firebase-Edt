
import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Smartphone, Zap, Lock, Code2, CheckSquare, Server, FileText, Download, Activity, Database, Share2, Map, Eye, HardDrive, Cpu, Layers, Braces, Terminal, Construction, Copy, CheckCircle2, Brain, RefreshCw, Wifi, WifiOff, Calculator, AlertTriangle, Play, GitBranch, Trash2, FileOutput, FlaskConical, LayoutTemplate, ShieldAlert } from 'lucide-react';
import { getStoredSales, getFinanceData, hardResetLocalData, bootstrapProductionData } from '../services/logic';
import { getPendingSyncs } from '../storage/db';
import { auth, db } from '../services/firebase';
import { getSession } from '../services/auth';
import { SOURCE_FILES } from '../utils/sourceMaps';

const DevRoadmap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ROADMAP' | 'TOOLS' | 'CODE'>('ROADMAP');
  const [dbStats, setDbStats] = useState({ sales: 0, transactions: 0, syncQueue: 0, size: 'Calc...' });
  const [firebaseStatus, setFirebaseStatus] = useState<string>('CONECTANDO...');
  const [selectedFile, setSelectedFile] = useState<string>('types.ts');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDiagnostics = async () => {
      setIsRefreshing(true);
      try {
          const s = await getStoredSales();
          const f = await getFinanceData();
          const q = await getPendingSyncs();
          const bytes = new Blob([JSON.stringify({s, f, q})]).size;
          
          setDbStats({ sales: s.length, transactions: f.transactions?.length || 0, syncQueue: q.length, size: (bytes / 1024).toFixed(2) + ' KB' });
          // @ts-ignore
          setFirebaseStatus(db && db.type !== 'mock' ? 'FIREBASE CLOUD ATIVO' : 'MODO LOCAL');
      } catch (e) {}
      setIsRefreshing(false);
  };

  useEffect(() => { loadDiagnostics(); }, []);

  const handleHardReset = () => {
    if(confirm('Isso apagará TODOS os dados locais. Tem certeza?')) {
        hardResetLocalData();
    }
  };

  const handleReRunBootstrap = async () => {
      if(confirm('Deseja re-executar o bootstrap de integridade do banco?')) {
          await bootstrapProductionData();
          loadDiagnostics();
          alert('Integridade validada no Firestore.');
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 text-slate-300 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Code2 size={120} /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Terminal className="text-emerald-500" /> Engenharia v2.5.0</h2>
                    <p className="text-slate-400 mt-2 text-sm">Controle Direto de Infraestrutura e Banco de Dados.</p>
                </div>
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-slate-700">
            <TabBtn id="ROADMAP" label="Roadmap" active={activeTab} onClick={setActiveTab} />
            <TabBtn id="TOOLS" label="Diagnósticos" active={activeTab} onClick={setActiveTab} />
            <TabBtn id="CODE" label="Código Fonte" active={activeTab} onClick={setActiveTab} />
        </div>

        {activeTab === 'TOOLS' && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DiagCard icon={<Database/>} title="Tamanho DB" value={dbStats.size} sub={`${dbStats.sales} vendas / ${dbStats.transactions} tx`} color="emerald" />
                    <DiagCard icon={<Server/>} title="Cloud Status" value={firebaseStatus} sub="Firestore Persistence" color="blue" />
                    <DiagCard icon={<Cpu/>} title="Sessão" value={getSession()?.role || 'Guest'} sub="Auth Online" color="purple" />
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4">
                    <button onClick={loadDiagnostics} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs flex items-center gap-2 hover:scale-105 transition-all">
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/> Atualizar Diagnóstico
                    </button>
                    <button onClick={handleReRunBootstrap} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-emerald-700">
                        <CheckSquare size={14}/> Validar Integridade (Bootstrap)
                    </button>
                    <button onClick={handleHardReset} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-700">
                        <Trash2 size={14}/> Limpar Banco Local
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'CODE' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[500px]">
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-y-auto p-2">
                    {Object.keys(SOURCE_FILES).map(f => (
                        <button key={f} onClick={() => setSelectedFile(f)} className={`w-full text-left p-2 rounded text-xs mb-1 font-mono transition-colors ${selectedFile === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            {f}
                        </button>
                    ))}
                </div>
                <div className="md:col-span-3 bg-black rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <div className="bg-slate-900 p-2 text-[10px] text-slate-500 font-mono flex justify-between">
                        <span>{selectedFile}</span>
                        <span>TypeScript / React / Firestore Native</span>
                    </div>
                    <pre className="flex-1 p-4 overflow-auto text-[11px] text-emerald-400 font-mono custom-scrollbar">
                        <code>{(SOURCE_FILES as any)[selectedFile]}</code>
                    </pre>
                </div>
            </div>
        )}

        {activeTab === 'ROADMAP' && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500"><Construction size={32} /></div>
                   <div>
                       <h3 className="text-xl font-bold">Roadmap de Expansão (v3.0)</h3>
                       <p className="text-sm text-gray-500">Próximos passos da engenharia.</p>
                   </div>
                </div>
                <div className="space-y-4">
                    <RoadmapItem done title="Migração Firebase Nativa" desc="Escrita síncrona aguardando confirmação do banco para consistência organizacional." />
                    <RoadmapItem done title="Novo Motor de Permissões" desc="Hierarquia DEV > ADMIN > USER com bypass de segurança para root." />
                    <RoadmapItem title="Realtime Dashboards" desc="Gráficos que atualizam sem refresh conforme equipe organizacional vende." />
                    <RoadmapItem title="Integração de Contratos" desc="Geração de PDFs dinâmicos com base nos dados da venda e assinatura digital." />
                </div>
            </div>
        )}
    </div>
  );
};

const TabBtn = ({id, label, active, onClick}: any) => (
    <button onClick={() => onClick(id)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${active === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>{label}</button>
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

const RoadmapItem = ({done, title, desc}: any) => (
    <div className={`flex gap-4 p-4 rounded-lg border ${done ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
        {done ? <CheckCircle2 className="text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-300" />}
        <div>
            <h4 className={`font-bold ${done ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-300'}`}>{title}</h4>
            <p className="text-xs opacity-70">{desc}</p>
        </div>
    </div>
);

export default DevRoadmap;
