
import React, { useMemo, useState, useEffect } from 'react';
import { Sale, ReportConfig, ProductivityMetrics } from '../types';
// Fix: Added missing CRM analysis exports from services/logic
import { analyzeClients, analyzeMonthlyVolume, exportReportToCSV, calculateProductivityMetrics } from '../services/logic';
import { AlertTriangle, CheckCircle, UserPlus, Search, Download, Settings, BarChart3, TrendingUp, Users, Filter, Clock, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface ClientReportsProps {
  sales: Sale[];
  config: ReportConfig;
  onOpenSettings: () => void;
  userId: string;
  darkMode?: boolean;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const ClientReports: React.FC<ClientReportsProps> = ({ sales, config, onOpenSettings, userId, darkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'NEW' | 'INACTIVE' | 'LOST'>('ALL');
  const [volumeMonths, setVolumeMonths] = useState(12);
  const [prodMetrics, setProdMetrics] = useState<ProductivityMetrics | null>(null);

  useEffect(() => {
    calculateProductivityMetrics(userId).then(setProdMetrics);
  }, [sales, userId]);

  const metrics = useMemo(() => analyzeClients(sales, config), [sales, config]);
  const volumeData = useMemo(() => analyzeMonthlyVolume(sales, volumeMonths), [sales, volumeMonths]);

  const filteredMetrics = metrics.filter(m => {
    if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    return true;
  });

  const totalClients = metrics.length;
  const lostClients = metrics.filter(m => m.status === 'LOST').length;
  const newClients = metrics.filter(m => m.status === 'NEW').length;
  const activeClients = metrics.filter(m => m.status === 'ACTIVE').length;
  const inactiveClients = metrics.filter(m => m.status === 'INACTIVE').length;
  
  const statusData = [
      { name: 'Ativos', value: activeClients, color: '#10b981' },
      { name: 'Novos', value: newClients, color: '#6366f1' },
      { name: 'Risco', value: inactiveClients, color: '#f59e0b' },
      { name: 'Perdidos', value: lostClients, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const handleExportClients = () => {
      const data = metrics.map(m => ({
          Nome: m.name,
          Status: m.status,
          Pedidos: m.totalOrders,
          TotalGasto: m.totalSpent.toFixed(2),
          UltimaCompra: new Date(m.lastPurchaseDate).toLocaleDateString(),
          DiasSemComprar: m.daysSinceLastPurchase
      }));
      exportReportToCSV(data, 'relatorio_clientes_crm');
  };

  const getTrafficLightColor = (status: any) => {
      if (status === 'GREEN') return 'bg-emerald-500';
      if (status === 'YELLOW') return 'bg-amber-500';
      return 'bg-red-500';
  };

  return (
    <div className="space-y-8 pb-12 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Produtividade CRM</h1>
            <p className="text-gray-500 dark:text-gray-400">Análise de carteira e conversão</p>
          </div>
          <button 
            onClick={onOpenSettings}
            className="w-full md:w-auto text-gray-500 hover:text-emerald-600 p-3 rounded-xl border border-gray-200 bg-white shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Settings size={20} /> <span>Ajustar Parâmetros</span>
          </button>
      </div>

      {/* SEMÁFORO DE PRODUTIVIDADE */}
      {prodMetrics && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors shrink-0 ${getTrafficLightColor(prodMetrics.productivityStatus)}`}>
                          <Activity size={32} className="text-white animate-pulse" />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Performance Mensal</h3>
                          <p className="text-sm text-gray-500">Conversão sobre base ativa</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full flex-1">
                      <div className="text-center md:text-left p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50">
                          <p className="text-[10px] uppercase font-black text-gray-400">Base Ativa</p>
                          <p className="text-2xl font-bold text-gray-800 dark:text-white">{prodMetrics.activeClients}</p>
                      </div>
                      <div className="text-center md:text-left p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50">
                          <p className="text-[10px] uppercase font-black text-gray-400">Vendas (Mês)</p>
                          <p className="text-2xl font-bold text-emerald-500">{prodMetrics.convertedThisMonth}</p>
                      </div>
                      <div className="text-center md:text-left p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50">
                          <p className="text-[10px] uppercase font-black text-gray-400">Taxa</p>
                          <p className={`text-2xl font-bold ${prodMetrics.conversionRate >= 70 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {prodMetrics.conversionRate.toFixed(1)}%
                          </p>
                      </div>
                      <div className="text-center md:text-left p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50">
                          <p className="text-[10px] uppercase font-black text-gray-400">Status</p>
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-black text-white ${getTrafficLightColor(prodMetrics.productivityStatus)}`}>
                              {prodMetrics.productivityStatus}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
            { label: 'Carteira Ativa', value: activeClients, icon: CheckCircle, color: 'emerald' },
            { label: 'Novos (30d)', value: newClients, icon: UserPlus, color: 'indigo' },
            { label: 'Risco (Churn)', value: inactiveClients, icon: AlertTriangle, color: 'amber' },
            { label: 'Perdidos', value: lostClients, icon: Users, color: 'red' }
        ].map((kpi, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden">
                <div className={`absolute right-0 top-0 h-full w-1 bg-${kpi.color}-500`}></div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">{kpi.label}</p>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{kpi.value}</p>
                    </div>
                    <div className={`bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20 p-2 rounded-lg text-${kpi.color}-600`}><kpi.icon size={24}/></div>
                </div>
            </div>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 min-h-[400px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                      <BarChart3 className="text-blue-500"/> Volume Histórico
                  </h3>
                  <select 
                    className="w-full sm:w-auto text-xs border rounded-lg p-2 bg-gray-50 dark:bg-slate-900"
                    value={volumeMonths}
                    onChange={e => setVolumeMonths(Number(e.target.value))}
                  >
                      <option value={6}>6 Meses</option>
                      <option value={12}>12 Meses</option>
                  </select>
              </div>
              <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volumeData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f0f0f0'}/>
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                          <Bar dataKey="basica" name="Básica" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="natal" name="Natal" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col min-h-[400px]">
              <h3 className="font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-white">
                  <Filter className="text-purple-500"/> Saúde da Carteira
              </h3>
              <div className="flex-1 relative">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                          </Pie>
                          <Tooltip />
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-10">
                      <div className="text-center">
                          <span className="block text-3xl font-black">{totalClients}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Total</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* TABLE GESTÃO */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <h3 className="font-bold text-gray-800 dark:text-white">Monitoramento de Contas</h3>
                 <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                     <div className="relative flex-1 sm:w-64">
                        <input 
                            type="text" placeholder="Filtrar cliente..." 
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 outline-none"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
                     </div>
                     <select 
                        className="border border-gray-200 dark:border-slate-700 rounded-xl py-3 px-4 text-sm bg-white dark:bg-slate-900 outline-none"
                        value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                     >
                        <option value="ALL">Todos os Status</option>
                        <option value="ACTIVE">Ativos</option>
                        <option value="INACTIVE">Risco</option>
                        <option value="LOST">Perdidos</option>
                     </select>
                     <button onClick={handleExportClients} className="bg-gray-100 dark:bg-slate-700 p-3 rounded-xl hover:bg-gray-200 transition-all">
                         <Download size={16}/>
                     </button>
                 </div>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100 dark:border-slate-700">
                    <tr>
                        <th className="px-6 py-4 text-left">Cliente</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Recência (Dias)</th>
                        <th className="px-6 py-4 text-right">LTV</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                    {filteredMetrics.map((client) => (
                        <tr key={client.name} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="font-bold text-gray-800 dark:text-white">{client.name}</div>
                                <div className="text-[10px] text-gray-400">Última venda: {new Date(client.lastPurchaseDate).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${client.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {client.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                                {client.daysSinceLastPurchase}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-gray-800 dark:text-white">
                                {formatCurrency(client.totalSpent)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ClientReports;
