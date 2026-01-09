
import React, { useMemo, useState, useEffect } from 'react';
import { Sale, ReportConfig, ProductivityMetrics } from '../types';
import { analyzeClients, analyzeMonthlyVolume, exportReportToCSV, calculateProductivityMetrics, getABCAnalysis, formatCurrency } from '../services/logic';
import { AlertTriangle, CheckCircle, UserPlus, Search, Download, Settings, BarChart3, TrendingUp, Users, Filter, Clock, Activity, MessageCircle, Sparkles, PieChart as PieIcon, Award, Skull } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, Treemap } from 'recharts';
import { optimizeMessage } from '../services/aiService';

interface ClientReportsProps {
  sales: Sale[];
  config: ReportConfig;
  onOpenSettings: () => void;
  userId: string;
  darkMode?: boolean;
}

const ClientReports: React.FC<ClientReportsProps> = ({ sales, config, onOpenSettings, userId, darkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'NEW' | 'INACTIVE' | 'LOST'>('ALL');
  const [volumeMonths, setVolumeMonths] = useState(12);
  const [prodMetrics, setProdMetrics] = useState<ProductivityMetrics | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState<string | null>(null);

  useEffect(() => {
    calculateProductivityMetrics(userId).then(setProdMetrics);
  }, [sales, userId]);

  const metrics = useMemo(() => analyzeClients(sales, config), [sales, config]);
  const abcData = useMemo(() => getABCAnalysis(sales), [sales]);
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

  const handleReactivation = async (clientName: string) => {
      setIsGeneratingMessage(clientName);
      try {
          const baseMsg = `Olá ${clientName.split(' ')[0]}, tudo bem? Notei que faz um tempo que não conversamos sobre suas cestas. Temos novidades incríveis para este mês!`;
          const optimized = await optimizeMessage(baseMsg, 'FRIENDLY');
          const encoded = encodeURIComponent(optimized);
          window.open(`https://web.whatsapp.com/send?text=${encoded}`, '_blank');
      } catch (e) {
          alert("Erro ao gerar sugestão IA. Verifique sua conexão.");
      } finally {
          setIsGeneratingMessage(null);
      }
  };

  const getTrafficLightColor = (status: any) => {
      if (status === 'GREEN') return 'bg-emerald-500';
      if (status === 'YELLOW') return 'bg-amber-500';
      return 'bg-red-500';
  };

  const abcChartData = [
      { name: 'Classe A (70%)', value: abcData.filter(d => d.classification === 'A').length, color: '#10b981' },
      { name: 'Classe B (20%)', value: abcData.filter(d => d.classification === 'B').length, color: '#3b82f6' },
      { name: 'Classe C (10%)', value: abcData.filter(d => d.classification === 'C').length, color: '#94a3b8' }
  ];

  const getChurnRisk = (days: number) => {
    if (days > config.daysForLost) return { label: 'Crítico', color: 'text-red-500', icon: <Skull size={12}/> };
    if (days > config.daysForInactive) return { label: 'Alto', color: 'text-orange-500', icon: <AlertTriangle size={12}/> };
    if (days > config.daysForNewClient) return { label: 'Médio', color: 'text-amber-500', icon: <Clock size={12}/> };
    return { label: 'Baixo', color: 'text-emerald-500', icon: <CheckCircle size={12}/> };
  };

  return (
    <div className="space-y-8 pb-12 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter">Inteligência Comercial</h1>
            <p className="text-gray-500 dark:text-gray-400">BI de Carteira e Classificação de Ativos</p>
          </div>
          <button 
            onClick={onOpenSettings}
            className="w-full md:w-auto text-gray-500 hover:text-emerald-600 p-3 rounded-xl border border-gray-200 bg-white shadow-sm transition-colors flex items-center justify-center gap-2 font-bold"
          >
            <Settings size={20} /> <span>Ajustar Ciclo</span>
          </button>
      </div>

      {/* SEMÁFORO DE PRODUTIVIDADE */}
      {prodMetrics && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg border border-gray-100 dark:border-slate-700">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors shrink-0 ${getTrafficLightColor(prodMetrics.productivityStatus)}`}>
                          <Activity size={32} className="text-white animate-pulse" />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Taxa de Conversão</h3>
                          <p className="text-sm text-gray-500">Performance sobre base ativa</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full flex-1">
                      <KPIMini label="Base Ativa" value={prodMetrics.activeClients} />
                      <KPIMini label="Vendas (Mês)" value={prodMetrics.convertedThisMonth} color="text-emerald-500" />
                      <KPIMini label="Eficiência" value={`${prodMetrics.conversionRate.toFixed(1)}%`} color={prodMetrics.conversionRate >= 70 ? 'text-emerald-500' : 'text-red-500'} />
                      <div className="text-center md:text-left p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 flex flex-col justify-center">
                          <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Status</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black text-white text-center ${getTrafficLightColor(prodMetrics.productivityStatus)}`}>
                              {prodMetrics.productivityStatus}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* CHARTS: ABC & SAÚDE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CURVA ABC */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 min-h-[400px]">
              <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black flex items-center gap-2 text-gray-800 dark:text-white uppercase text-xs tracking-widest">
                      <Award className="text-amber-500" size={18}/> Análise de Curva ABC (Pareto)
                  </h3>
              </div>
              <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={abcData.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                            formatter={(val: number) => formatCurrency(val)}
                          />
                          <Bar dataKey="revenue" name="Faturamento" radius={[8, 8, 0, 0]}>
                              {abcData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.classification === 'A' ? '#10b981' : entry.classification === 'B' ? '#3b82f6' : '#94a3b8'} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-4 flex gap-4 justify-center">
                  {abcChartData.map(d => (
                      <div key={d.name} className="flex items-center gap-2 text-[10px] font-black uppercase">
                          <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                          <span className="text-gray-500">{d.name}</span>
                      </div>
                  ))}
              </div>
          </div>

          {/* PIE STATUS */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col min-h-[400px]">
              <h3 className="font-black mb-8 flex items-center gap-2 text-gray-800 dark:text-white uppercase text-xs tracking-widest">
                  <PieIcon className="text-purple-500" size={18}/> Saúde da Carteira
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
                          <span className="block text-4xl font-black text-gray-900 dark:text-white">{totalClients}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Contas</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* TABLE GESTÃO */}
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <h3 className="font-black text-gray-800 dark:text-white uppercase text-xs tracking-widest">Monitoramento Transacional</h3>
                 <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                     <div className="relative flex-1 sm:w-64">
                        <input 
                            type="text" placeholder="Localizar parceiro..." 
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm bg-white dark:bg-slate-900 outline-none focus:ring-2 ring-indigo-500 transition-all"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                     </div>
                     <select 
                        className="border border-gray-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm bg-white dark:bg-slate-900 outline-none font-bold text-gray-600"
                        value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                     >
                        <option value="ALL">Todos os Ciclos</option>
                        <option value="ACTIVE">Ativos</option>
                        <option value="INACTIVE">Risco</option>
                        <option value="LOST">Perdidos</option>
                     </select>
                     <button onClick={handleExportClients} className="bg-gray-100 dark:bg-slate-700 p-3 rounded-2xl hover:bg-gray-200 transition-all text-gray-500">
                         <Download size={20}/>
                     </button>
                 </div>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b border-gray-100 dark:border-slate-700">
                    <tr>
                        <th className="px-8 py-5 text-left">Parceiro Comercial</th>
                        <th className="px-6 py-5 text-center">Risco Churn</th>
                        <th className="px-6 py-5 text-center">Status</th>
                        <th className="px-6 py-5 text-right">LTV Total</th>
                        <th className="px-6 py-5 text-right">Ticket Médio</th>
                        <th className="px-8 py-5 text-right">Ação Reativa</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                    {filteredMetrics.map((client) => {
                        const abcInfo = abcData.find(a => a.name === client.name);
                        const ticketMedio = client.totalSpent / client.totalOrders;
                        const risk = getChurnRisk(client.daysSinceLastPurchase);
                        return (
                            <tr key={client.name} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl font-black text-[10px] flex items-center justify-center shadow-sm ${abcInfo?.classification === 'A' ? 'bg-emerald-500 text-white' : abcInfo?.classification === 'B' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            {abcInfo?.classification || 'C'}
                                        </div>
                                        <div>
                                            <div className="font-black text-gray-800 dark:text-white text-lg tracking-tight">{client.name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Último Pedido: {new Date(client.lastPurchaseDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-current bg-black/5 ${risk.color}`}>
                                        {risk.icon} {risk.label}
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${client.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                        {client.status}
                                    </span>
                                </td>
                                <td className="px-6 py-6 text-right font-black text-gray-700 dark:text-gray-300">
                                    {formatCurrency(client.totalSpent)}
                                </td>
                                <td className="px-6 py-6 text-right font-bold text-slate-500">
                                    {formatCurrency(ticketMedio)}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    {(client.status === 'INACTIVE' || client.status === 'LOST') ? (
                                        <button 
                                            onClick={() => handleReactivation(client.name)}
                                            disabled={isGeneratingMessage === client.name}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20 active:scale-95 disabled:opacity-50"
                                        >
                                            {isGeneratingMessage === client.name ? <Activity size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                            Recuperar Lead
                                        </button>
                                    ) : (
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity"><CheckCircle size={14}/> Saudável</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

const KPIMini = ({ label, value, color = "text-gray-800 dark:text-white" }: any) => (
    <div className="text-center md:text-left p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 flex flex-col justify-center">
        <p className="text-[10px] uppercase font-black text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
);

export default ClientReports;
