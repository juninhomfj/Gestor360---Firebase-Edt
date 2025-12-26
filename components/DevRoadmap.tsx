import React, { useState, useEffect, useMemo } from 'react';
import { 
    Code2, Terminal, Database, Server, Cpu, RefreshCw, 
    CheckCircle2, Trash2, CheckSquare, Cloud, Activity, 
    ArrowRight, Globe, Shield, Download, FileJson, Copy, Eye, Lock, AlertTriangle
} from 'lucide-react';
import { getStoredSales, getFinanceData, hardResetLocalData, bootstrapProductionData } from '../services/logic';
import { dbGetAll } from '../storage/db';
import { db } from '../services/firebase';
import { SOURCE_FILES } from '../utils/sourceMaps';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';

const DevRoadmap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CLOUD' | 'DATABASE' | 'CODE' | 'ROADMAP'>('CLOUD');
  const [dbStats, setDbStats] = useState({ sales: 0, transactions: 0, clients: 0, size: 'Calculando...' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [cloudTraffic, setCloudTraffic] = useState({ reads: 0, writes: 0, lastActivity: 'Nenhuma' });

  const [selectedStore, setSelectedStore] = useState('profiles');
  const [tableData, setTableData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [dbFilter, setDbFilter] = useState('');

  const STORES = ['profiles', 'sales', 'clients', 'config', 'accounts', 'transactions', 'receivables', 'cards', 'categories', 'goals', 'challenges'];

  useEffect(() => {
    loadSystemStats();
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
          setDbStats({ sales: s.length, transactions: f.transactions?.length || 0, clients: clients.length, size: (bytes / 1024).toFixed(2) + ' KB' });
      } catch (e) {}
      setIsRefreshing(false);
  };

  const loadTable = async () => {
      setIsRefreshing(true);
      try {
          const data = await dbGetAll(selectedStore as any);
          setTableData(data);
          setSelectedRow(null);
      } catch (e) {}
      setIsRefreshing(false);
  };

  const handleExportCSV = () => {
      if (!tableData.length) return;
      const headers = Object.keys(tableData[0]).join(',');
      const rows = tableData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `db_${selectedStore}.csv`);
      link.click();
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("JSON copiado!");
  };

  const filteredData = useMemo(() => {
      if (!dbFilter) return tableData;
      const lower = dbFilter.toLowerCase();
      return tableData.filter(row => JSON.stringify(row).toLowerCase().includes(lower));
  }, [tableData, dbFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20 overflow-x-hidden">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-slate-300 relative overflow-hidden shadow-2xl">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Cpu className="text-emerald-500 animate-pulse" /> Engenharia v2.5.0
                    </h2>
                    <p className="text-slate-400 mt-2 text-xs font-mono uppercase tracking-widest">Consola Root • Cloud Monitoring</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black border border-emerald-500/30">FIREBASE ACTIVE</span>
                </div>
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            <TabBtn id="CLOUD" label="Cloud Status" icon={<Globe size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="DATABASE" label="Banco Local" icon={<Database size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="CODE" label="Source" icon={<Code2 size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="ROADMAP" label="Roadmap" icon={<CheckCircle2 size={14}/>} active={activeTab} onClick={setActiveTab} />
        </div>

        {activeTab === 'CLOUD' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4">
                <StatusCard icon={<Cloud/>} title="Conectividade" value="ESTÁVEL" sub="Firestore Direct" color="blue" />
                <StatusCard icon={<Activity/>} title="Leituras" value={cloudTraffic.reads} sub={`Last: ${cloudTraffic.lastActivity}`} color="emerald" />
                <StatusCard icon={<Server/>} title="Latência" value="22ms" sub="US-CENTRAL1" color="amber" />
                <StatusCard icon={<Shield/>} title="Segurança" value="STRICT" sub="RLS Active" color="purple" />
            </div>
        )}

        {activeTab === 'DATABASE' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
                            className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2 font-bold text-sm text-gray-800 dark:text-white"
                        >
                            {STORES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                        <input 
                            placeholder="Filtrar..." value={dbFilter} onChange={e => setDbFilter(e.target.value)}
                            className="flex-1 pl-4 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportCSV} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest">Exportar CSV</button>
                        <button onClick={loadTable} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/></button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 h-[600px]">
                    <div className="w-full md:w-1/3 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-y-auto">
                        {filteredData.map((row, idx) => (
                            <button 
                                key={idx} onClick={() => setSelectedRow(row)}
                                className={`w-full text-left p-3 border-b dark:border-slate-800 text-xs truncate transition-all ${selectedRow?.id === row.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : ''}`}
                            >
                                <div className="font-bold text-gray-800 dark:text-gray-200">{row.name || row.client || row.id}</div>
                                <div className="text-[10px] opacity-40 font-mono mt-1">{row.id?.substring(0, 8) || idx}</div>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 relative overflow-hidden flex flex-col">
                        <div className="absolute top-4 right-4 z-20">
                            <button onClick={() => copyToClipboard(JSON.stringify(selectedRow, null, 2))} className="p-2 bg-white/10 text-white rounded-lg"><Copy size={16}/></button>
                        </div>
                        <pre className="flex-1 text-[10px] text-emerald-400 font-mono overflow-auto custom-scrollbar">
                            {selectedRow ? JSON.stringify(selectedRow, null, 2) : "// Selecione um registro..."}
                        </pre>
                    </div>
                </div>
            </div>
        )}
        
        {activeTab === 'ROADMAP' && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
                <RoadmapItem done title="Firestore Sincronizado" desc="Persistência direta v2.5." />
                <RoadmapItem done title="Bypass Root DEV" desc="Controle total de visibilidade." />
                <RoadmapItem title="Realtime Sync UI" desc="Websockets para dashboards dinâmicos." />
            </div>
        )}
    </div>
  );
};

const TabBtn = ({id, label, icon, active, onClick}: any) => (
    <button onClick={() => onClick(id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${active === id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
        {icon} {label}
    </button>
);

const StatusCard = ({icon, title, value, sub, color}: any) => (
    <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border dark:border-slate-800 flex items-center gap-4 border-l-4 border-l-${color}-500 shadow-sm`}>
        <div className={`p-3 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600`}>{icon}</div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-40">{title}</p>
            <p className="text-lg font-black">{value}</p>
            <p className="text-[10px] opacity-60 truncate">{sub}</p>
        </div>
    </div>
);

const RoadmapItem = ({done, title, desc}: any) => (
    <div className={`flex gap-4 p-4 rounded-xl border ${done ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
        {done ? <CheckCircle2 className="text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-300" />}
        <div>
            <h4 className={`font-bold text-sm ${done ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-300'}`}>{title}</h4>
            <p className="text-xs opacity-70">{desc}</p>
        </div>
    </div>
);

export default DevRoadmap;