
import React, { useMemo, useState, useEffect } from 'react';
import { Sale, ReportConfig, ProductivityMetrics } from '../types';
import { analyzeClients, analyzeMonthlyVolume, exportReportToCSV, calculateProductivityMetrics } from '../services/logic';
import { AlertTriangle, CheckCircle, UserPlus, Search, Download, Settings, BarChart3, TrendingUp, Users, Filter, Clock, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface ClientReportsProps {
  sales: Sale[];
  config: ReportConfig;
  onOpenSettings: () => void;
  userId: string;
  // Added missing 'darkMode' prop
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

  // --- ANALYTICS ---
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
  
  const recurringClients = metrics.filter(m => m.totalOrders > 2).sort((a,b) => b.totalOrders - a.totalOrders).slice(0, 5);
  const churnRiskClients = metrics.filter(m => m.status === 'INACTIVE').slice(0, 5);

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
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Produtividade & CRM</h1>
            <p className="text-gray-500 dark:text-gray-400">Análise de carteira e conversão mensal</p>
          </div>
          <button 
            onClick={onOpenSettings}
            className="text-gray-500 hover:text-emerald-600 p-2 rounded-lg border border-gray-200 bg-white shadow-sm transition-colors flex items-center gap-2"
          >
            <Settings size={20} /> <span className="hidden md:inline">Parâmetros</span>
          </button>
      </div>

      {/* CRM PRODUCTIVITY SEMAPHORE */}
      {prodMetrics && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors ${getTrafficLightColor(prodMetrics.productivityStatus)}`}>
                          <Activity size={32} className="text-white animate-pulse" />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Status de Produtividade</h3>
                          <p className="text-sm text-gray-500">Conversão da base ativa (Mês Atual)</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                      <div className="text-center md:text-left">
                          <p className="text-[10px] uppercase font-black text-gray-400">Base Ativa</p>
                          <p className="text-2xl font-bold text-gray-800 dark:text-white">{prodMetrics.activeClients}</p>
                      </div>
                      <div className="text-center md:text-left">
                          <p className="text-[10px] uppercase font-black text-gray-400">Vendas (Mês)</p>
                          <p className="text-2xl font-bold text-emerald-500">{prodMetrics.convertedThisMonth}</p>
                      </div>
                      <div className="text-center md:text-left">
                          <p className="text-[10px] uppercase font-black text-gray-400">Conversão</p>
                          <p className={`text-2xl font-bold ${prodMetrics.conversionRate >= 90 ? 'text-emerald-500' : (prodMetrics.conversionRate >= 70 ? 'text-amber-500' : 'text-red-500')}`}>
                              {prodMetrics.conversionRate.toFixed(1)}%
                          </p>
                      </div>
                      <div className="text-center md:text-left">
                          <p className="text-[10px] uppercase font-black text-gray-400">Performance</p>
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-black text-white ${getTrafficLightColor(prodMetrics.productivityStatus)}`}>
                              {prodMetrics.productivityStatus}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Carteira Ativa</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{activeClients}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg text-emerald-600"><CheckCircle size={24}/></div>
            </div>
            <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1">
                <TrendingUp size={12}/> Clientes comprando
            </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-indigo-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Novos (30d)</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{newClients}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-600"><UserPlus size={24}/></div>
            </div>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
                Aquisição recente
            </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-amber-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Risco (Churn)</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{inactiveClients}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-amber-600"><AlertTriangle size={24}/></div>
            </div>
             <p className="text-xs text-amber-600 mt-2 font-medium">
                Sem compra há {config.daysForInactive}+ dias
            </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-red-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Inativos</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{lostClients}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-red-600"><Users size={24}/></div>
            </div>
             <p className="text-xs text-red-600 mt-2 font-medium">
                Perdidos ({config.daysForLost}+ dias)
            </p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <BarChart3 className="text-blue-500"/> Volume de Cestas Faturadas
                  </h3>
                  <div className="flex gap-2">
                      <select 
                        className="text-xs border rounded p-1 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                        value={volumeMonths}
                        onChange={e => setVolumeMonths(Number(e.target.value))}
                      >
                          <option value={3}>Últimos 3 Meses</option>
                          <option value={6}>Últimos 6 Meses</option>
                          <option value={12}>Últimos 12 Meses</option>
                      </select>
                  </div>
              </div>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volumeData}>
                          {/* Fixed missing darkMode variable usage */}
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f0f0f0'}/>
                          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend wrapperStyle={{fontSize: '12px'}} />
                          <Bar isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" dataKey="basica" name="Cestas Básicas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                          <Bar isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" dataKey="natal" name="Cestas de Natal" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Filter className="text-purple-500"/> Distribuição da Carteira
              </h3>
              <div className="flex-1 min-h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            isAnimationActive={true} 
                            animationDuration={1500} 
                            animationEasing="ease-out"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px' }} />
                          <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-8">
                      <div className="text-center">
                          <span className="block text-2xl font-bold text-gray-800 dark:text-white">{totalClients}</span>
                          <span className="text-xs text-gray-500 uppercase">Clientes</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <h3 className="font-bold text-gray-800 dark:text-white text-lg">Gerenciamento da Carteira</h3>
             <div className="flex gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                 </div>
                 
                 <select 
                    className="border border-gray-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                 >
                    <option value="ALL">Todos os Status</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="NEW">Novos</option>
                    <option value="INACTIVE">Risco (Inativos)</option>
                    <option value="LOST">Perdidos</option>
                 </select>

                 <button onClick={handleExportClients} className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                     <Download size={16}/> Exportar Lista
                 </button>
             </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                    <tr>
                        <th className="px-4 py-3 text-left font-bold">Cliente</th>
                        <th className="px-4 py-3 text-center font-bold">Status</th>
                        <th className="px-4 py-3 text-center font-bold">Recência (Dias)</th>
                        <th className="px-4 py-3 text-center font-bold">Frequência</th>
                        <th className="px-4 py-3 text-right font-bold">Valor Monetário (Total)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredMetrics.map((client) => (
                        <tr key={client.name} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                {client.name}
                                <span className="block text-[10px] text-gray-400">Última compra: {new Date(client.lastPurchaseDate).toLocaleDateString()}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                {client.status === 'ACTIVE' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">Ativo</span>}
                                {client.status === 'NEW' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400">Novo</span>}
                                {client.status === 'INACTIVE' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">Risco</span>}
                                {client.status === 'LOST' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400">Perdido</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className={`font-mono font-bold ${client.daysSinceLastPurchase > 60 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {client.daysSinceLastPurchase}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{client.totalOrders} pedidos</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-white">{formatCurrency(client.totalSpent)}</td>
                        </tr>
                    ))}
                    {filteredMetrics.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhum cliente encontrado com os filtros atuais.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ClientReports;
