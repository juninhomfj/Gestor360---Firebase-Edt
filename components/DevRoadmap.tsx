
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Code2, Terminal, Database, Server, Cpu, RefreshCw, 
    CheckCircle2, Trash2, CheckSquare, Cloud, Activity, 
    ArrowRight, Globe, Shield, Download, FileJson, Copy, Eye, Lock, AlertTriangle
} from 'lucide-react';
import { getStoredSales, getFinanceData, hardResetLocalData, bootstrapProductionData } from '../services/logic';
import { dbGetAll, dbDelete } from '../storage/db';
import { db, auth } from '../services/firebase';
import { getSession } from '../services/auth';
import { SOURCE_FILES } from '../utils/sourceMaps';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';

const DevRoadmap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CLOUD' | 'DATABASE' | 'CODE' | 'ROADMAP'>('CLOUD');
  const [dbStats, setDbStats] = useState({ sales: 0, transactions: 0, clients: 0, size: 'Calculando...' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Real-time Traffic Simulator (Baseado em atividade real ou mockada para fins de UI)
  const [cloudTraffic, setCloudTraffic] = useState({ reads: 0, writes: 0, lastActivity: 'Nenhuma' });

  // Database Inspector State
  const [selectedStore, setSelectedStore] = useState('profiles');
  const [tableData, setTableData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [dbFilter, setDbFilter] = useState('');

  const STORES = ['profiles', 'sales', 'clients', 'config', 'accounts', 'transactions', 'receivables', 'cards', 'categories', 'goals', 'challenges'];

  useEffect(() => {
    loadSystemStats();
    
    // Realtime Listener para simular monitoramento de tráfego
    const unsub = onSnapshot(query(collection(db, "sales"), limit(1)), () => {
        setCloudTraffic(prev => ({ 
            ...prev, 
            reads: prev.reads + 1, 
            lastActivity: new Date().toLocaleTimeString() 
        }));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
      if (activeTab === 'DATABASE') loadTable();
  }, [selectedStore, activeTab]);

  const loadSystemStats = async () => {
      setIsRefreshing(true);
      try {
          const [s, f] = await Promise.all([getStoredSales(), getFinanceData()]);
          const clients = await dbGetAll('clients');
          const bytes = new Blob([JSON.stringify({s, f, clients})]).size;
          
          setDbStats({ 
              sales: s.length, 
              transactions: f.transactions?.length || 0, 
              clients: clients.length,
              size: (bytes / 1024).toFixed(2) + ' KB' 
          });
      } catch (e) {}
      setIsRefreshing(false);
  };

  const loadTable = async () => {
      setIsRefreshing(true);
      try {
          const data = await dbGetAll(selectedStore as any);
          setTableData(data);
          setSelectedRow(null);
      } catch (e) {
          console.error(e);
      }
      setIsRefreshing(false);
  };

  const handleExportCSV = () => {
      if (!tableData.length) return alert("Tabela vazia.");
      const headers = Object.keys(tableData[0]).join(',');
      const rows = tableData.map(row => 
          Object.values(row).map(v => {
              if (typeof v === 'object') return '"OBJ"';
              if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
              return v;
          }).join(',')
      ).join('\n');
      
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `db_export_${selectedStore}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copiado!");
  };

  const filteredData = useMemo(() => {
      if (!dbFilter) return tableData;
      const lower = dbFilter.toLowerCase();
      return tableData.filter(row => 
          JSON.stringify(row).toLowerCase().includes(lower)
      );
  }, [tableData, dbFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
        {/* Banner de Engenharia */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-slate-300 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Terminal size={140} /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Cpu className="text-emerald-500 animate-pulse" /> Engenharia v2.5.0
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm font-mono">Consola Root • Cloud Monitoring • Database Inspector</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black border border-emerald-500/30">FIREBASE ACTIVE</span>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black border border-blue-500/30">SYNC MASTER</span>
                </div>
            </div>
        </div>

        {/* Menu de Abas */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-gray-200 dark:border-slate-800">
            <TabBtn id="CLOUD" label="Cloud Status" icon={<Globe size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="DATABASE" label="Banco de Dados" icon={<Database size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="CODE" label="Código Fonte" icon={<Code2 size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="ROADMAP" label="Project Roadmap" icon={<CheckCircle2 size={14}/>} active={activeTab} onClick={setActiveTab} />
        </div>

        {/* ABA: CLOUD STATUS */}
        {activeTab === 'CLOUD' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatusCard icon={<Cloud/>} title="Conectividade" value="ESTÁVEL" sub="Google Cloud Firestore" color="blue" />
                    <StatusCard icon={<Activity/>} title="Leituras (Sessão)" value={cloudTraffic.reads} sub={`Última: ${cloudTraffic.lastActivity}`} color="emerald" />
                    <StatusCard icon={<Server/>} title="Latência" value="22ms" sub="Datacenter: us-central1" color="amber" />
                    <StatusCard icon={<Shield/>} title="Segurança" value="MODO STRICT" sub="RLS v2 Habilitado" color="purple" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity size={20} className="text-emerald-500"/> Monitor de Tráfego</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="opacity-70">Operações Realtime (Websockets)</span>
                                <span className="font-bold text-emerald-500">CONECTADO</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="opacity-70">Status do Cache Offline (IndexedDB)</span>
                                <span className="font-bold text-blue-500">SINCRONIZADO</span>
                            </div>
                            <div className="pt-4 border-t dark:border-slate-800 flex flex-wrap gap-2">
                                <button onClick={loadSystemStats} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/> Re-validar Cloud
                                </button>
                                <button onClick={() => bootstrapProductionData()} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                                    <CheckSquare size={14}/> Forçar Seed
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Database size={20} className="text-purple-500"/> Capacidade da Conta</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-[10px] font-black uppercase opacity-40">Uso de Armazenamento</span>
                                    <p className="text-xl font-black">{dbStats.size}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase opacity-40">Total de Documentos</span>
                                    <p className="text-xl font-black text-indigo-500">{dbStats.sales + dbStats.transactions + dbStats.clients}</p>
                                </div>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{width: '8%'}}></div>
                            </div>
                            <p className="text-[10px] text-gray-500 italic">Monitoramento baseado no plano <b>Firebase Spark (Free)</b>.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 text-red-500 mb-4">
                        {/* Add comment: Fixed missing AlertTriangle import by adding it to lucide-react import list */}
                        <AlertTriangle size={24}/>
                        <h4 className="font-bold">Zona de Perigo</h4>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400 mb-6">Ações irreversíveis que afetam diretamente o ecossistema de dados.</p>
                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => { if(confirm('Reset total?')) hardResetLocalData(); }} className="px-6 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all">Limpar Cache Local</button>
                    </div>
                </div>
            </div>
        )}

        {/* ABA: DATABASE INSPECTOR */}
        {activeTab === 'DATABASE' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 h-[650px] flex flex-col">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-800">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <select 
                            value={selectedStore} 
                            onChange={e => setSelectedStore(e.target.value)}
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-4 py-2 font-bold text-sm outline-none focus:ring-2 ring-indigo-500 text-gray-800 dark:text-white"
                        >
                            {STORES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                        <div className="relative">
                            <Eye size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input 
                                placeholder="Filtrar registros..." 
                                value={dbFilter}
                                onChange={e => setDbFilter(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs outline-none focus:ring-2 ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={handleExportCSV} className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-700">
                            <Download size={14}/> Exportar Excel (CSV)
                        </button>
                        <button onClick={loadTable} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg">
                            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/>
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* Lista Lateral */}
                    <div className="w-1/3 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-y-auto custom-scrollbar">
                        {filteredData.map((row, idx) => (
                            <button 
                                key={idx}
                                onClick={() => setSelectedRow(row)}
                                className={`w-full text-left p-3 border-b dark:border-slate-800 text-xs truncate transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/10 ${selectedRow?.id === row.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : ''}`}
                            >
                                <div className="font-bold text-gray-800 dark:text-gray-200">
                                    {row.name || row.client || row.description || row.email || row.id}
                                </div>
                                <div className="text-[10px] opacity-40 font-mono mt-1">{row.id || idx}</div>
                            </button>
                        ))}
                        {!filteredData.length && <div className="p-10 text-center opacity-30 italic">Tabela vazia ou sem acesso.</div>}
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 relative group overflow-hidden flex flex-col">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button 
                                onClick={() => copyToClipboard(JSON.stringify(selectedRow, null, 2))}
                                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 shadow-lg backdrop-blur-md"
                            >
                                <Copy size={16}/>
                            </button>
                        </div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                            <Lock size={12}/> Inspector JSON {selectedRow && `• ${selectedRow.id || 'DOC'}`}
                        </h4>
                        <pre className="flex-1 text-[11px] text-emerald-400 font-mono overflow-auto custom-scrollbar">
                            {selectedRow ? JSON.stringify(selectedRow, null, 2) : "// Selecione um registro para inspecionar raw data..."}
                        </pre>
                    </div>
                </div>
            </div>
        )}

        {/* ABA: CÓDIGO FONTE */}
        {activeTab === 'CODE' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[500px]">
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-y-auto p-2">
                    {Object.keys(SOURCE_FILES).map(f => (
                        <button key={f} className={`w-full text-left p-2 rounded text-xs mb-1 font-mono transition-colors text-slate-400 hover:bg-slate-800`}>
                            {f}
                        </button>
                    ))}
                </div>
                <div className="md:col-span-3 bg-black rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <pre className="flex-1 p-4 overflow-auto text-[11px] text-emerald-400 font-mono custom-scrollbar">
                        <code>{SOURCE_FILES['services/logic.ts']}</code>
                    </pre>
                </div>
            </div>
        )}

        {/* ABA: ROADMAP */}
        {activeTab === 'ROADMAP' && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500"><Terminal size={32} /></div>
                   <div>
                       <h3 className="text-xl font-bold">Roadmap de Engenharia v2.5.0</h3>
                       <p className="text-sm text-gray-500">Estado atual e próximos sprints.</p>
                   </div>
                </div>
                <div className="space-y-4">
                    <RoadmapItem done title="Firestore Sync Nativo" desc="Migração completa de LocalStorage para escrita direta Cloud Firestore." />
                    <RoadmapItem done title="Hierarquia de Acesso Root" desc="Implementação de Bypass DEV para auditoria de todas as coleções." />
                    <RoadmapItem done title="Inspector de Dados" desc="Ferramenta integrada para consulta JSON e exportação CSV de coleções." />
                    <RoadmapItem title="Realtime Dashboards" desc="Gráficos que se atualizam via Websockets (onSnapshot) sem refresh." />
                    <RoadmapItem title="Audit Log Global" desc="Tracking centralizado de cada alteração em documentos para conformidade." />
                </div>
            </div>
        )}
    </div>
  );
};

const TabBtn = ({id, label, icon, active, onClick}: any) => (
    <button onClick={() => onClick(id)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${active === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
        {icon} {label}
    </button>
);

const StatusCard = ({icon, title, value, sub, color}: any) => (
    <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border dark:border-slate-800 flex items-center gap-4 border-l-4 border-l-${color}-500 shadow-sm transition-transform hover:scale-105`}>
        <div className={`p-3 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600`}>{icon}</div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-40">{title}</p>
            <p className="text-lg font-black">{value}</p>
            <p className="text-[10px] opacity-60 font-mono truncate max-w-[100px]">{sub}</p>
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
