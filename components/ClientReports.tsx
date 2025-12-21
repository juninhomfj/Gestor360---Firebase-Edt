
import React, { useMemo, useState } from 'react';
import { Sale, ClientMetric, ProductType, ReportConfig } from '../types';
import { analyzeClients, analyzeMonthlyVolume, exportReportToCSV } from '../services/logic';
import { AlertTriangle, CheckCircle, UserPlus, Search, Download, Settings, BarChart3, TrendingUp, Users, Filter, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface ClientReportsProps {
  sales: Sale[];
  config: ReportConfig;
  onOpenSettings: () => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const ClientReports: React.FC<ClientReportsProps> = ({ sales, config, onOpenSettings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'NEW' | 'INACTIVE' | 'LOST'>('ALL');
  const [volumeMonths, setVolumeMonths] = useState(12);

  // --- ANALYTICS ---
  const metrics = useMemo(() => analyzeClients(sales, config), [sales, config]);
  const volumeData = useMemo(() => analyzeMonthlyVolume(sales, volumeMonths), [sales, volumeMonths]);

  // Filtered Clients for Table
  const filteredMetrics = metrics.filter(m => {
    if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    return true;
  });

  // KPIs
  const totalClients = metrics.length;
  const lostClients = metrics.filter(m => m.status === 'LOST').length;
  const newClients = metrics.filter(m => m.status === 'NEW').length;
  const activeClients = metrics.filter(m => m.status === 'ACTIVE').length;
  const inactiveClients = metrics.filter(m => m.status === 'INACTIVE').length;
  
  // Recurring Clients (Loyalty): More than 2 orders
  const recurringClients = metrics.filter(m => m.totalOrders > 2).sort((a,b) => b.totalOrders - a.totalOrders).slice(0, 5);
  
  // Churn Risk (Recently inactive but not lost yet)
  const churnRiskClients = metrics.filter(m => m.status === 'INACTIVE').slice(0, 5);

  // Pie Chart Data
  const statusData = [
      { name: 'Ativos', value: activeClients, color: '#10b981' },
      { name: 'Novos', value: newClients, color: '#6366f1' },
      { name: 'Risco', value: inactiveClients, color: '#f59e0b' },
      { name: 'Perdidos', value: lostClients, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Export Functions
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

  const handleExportVolume = () => {
      exportReportToCSV(volumeData, 'relatorio_volume_vendas');
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Business Intelligence (BI)</h1>
            <p className="text-gray-500">Análise de carteira e comportamento de vendas</p>
          </div>
          <button 
            onClick={onOpenSettings}
            className="text-gray-500 hover:text-emerald-600 p-2 rounded-lg border border-gray-200 bg-white shadow-sm transition-colors flex items-center gap-2"
          >
            <Settings size={20} /> <span className="hidden md:inline">Parâmetros</span>
          </button>
      </div>
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Carteira Ativa</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{activeClients}</p>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle size={24}/></div>
            </div>
            <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1">
                <TrendingUp size={12}/> Clientes comprando
            </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-indigo-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Novos (30d)</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{newClients}</p>
                </div>
                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><UserPlus size={24}/></div>
            </div>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
                Aquisição recente
            </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-amber-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Risco (Churn)</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{inactiveClients}</p>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><AlertTriangle size={24}/></div>
            </div>
             <p className="text-xs text-amber-600 mt-2 font-medium">
                Sem compra há {config.daysForInactive}+ dias
            </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-red-500"></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Inativos</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{lostClients}</p>
                </div>
                <div className="bg-red-50 p-2 rounded-lg text-red-600"><Users size={24}/></div>
            </div>
             <p className="text-xs text-red-600 mt-2 font-medium">
                Perdidos ({config.daysForLost}+ dias)
            </p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* VOLUME CHART */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <BarChart3 className="text-blue-500"/> Volume de Cestas Faturadas
                  </h3>
                  <div className="flex gap-2">
                      <select 
                        className="text-xs border rounded p-1 bg-gray-50 text-gray-900"
                        value={volumeMonths}
                        onChange={e => setVolumeMonths(Number(e.target.value))}
                      >
                          <option value={3}>Últimos 3 Meses</option>
                          <option value={6}>Últimos 6 Meses</option>
                          <option value={12}>Últimos 12 Meses</option>
                      </select>
                      <button onClick={handleExportVolume} className="text-gray-400 hover:text-blue-600 p-1" title="Exportar Dados">
                          <Download size={16}/>
                      </button>
                  </div>
              </div>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volumeData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{fill: '#f8fafc'}}
                          />
                          <Legend wrapperStyle={{fontSize: '12px'}} />
                          <Bar isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" dataKey="basica" name="Cestas Básicas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                          <Bar isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" dataKey="natal" name="Cestas de Natal" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* DISTRIBUTION PIE */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                  {/* Center Text */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-8">
                      <div className="text-center">
                          <span className="block text-2xl font-bold text-gray-800">{totalClients}</span>
                          <span className="text-xs text-gray-500 uppercase">Clientes</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* LISTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* RECURRING CLIENTS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="text-emerald-500"/> Top Clientes Recorrentes
              </h3>
              <div className="space-y-3">
                  {recurringClients.map((client, idx) => (
                      <div key={client.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                                  {idx + 1}
                              </span>
                              <div>
                                  <p className="font-bold text-sm text-gray-800">{client.name}</p>
                                  <p className="text-xs text-gray-500">{client.totalOrders} compras registradas</p>
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="font-bold text-emerald-600 text-sm">{formatCurrency(client.totalSpent)}</p>
                          </div>
                      </div>
                  ))}
                  {recurringClients.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">Dados insuficientes.</p>}
              </div>
          </div>

          {/* CHURN RISK */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500"/> Atenção (Risco de Churn)
              </h3>
              <p className="text-xs text-gray-500 mb-3">Clientes que compravam e pararam recentemente.</p>
              <div className="space-y-3">
                  {churnRiskClients.map((client) => (
                      <div key={client.name} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                          <div>
                              <p className="font-bold text-sm text-gray-800">{client.name}</p>
                              <p className="text-xs text-amber-700 flex items-center gap-1">
                                  <Clock size={10}/> {client.daysSinceLastPurchase} dias sem comprar
                              </p>
                          </div>
                          <div className="text-right">
                              <span className="text-xs font-bold text-amber-600 bg-white px-2 py-1 rounded border border-amber-200">
                                  Alerta
                              </span>
                          </div>
                      </div>
                  ))}
                  {churnRiskClients.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">Nenhum cliente em risco imediato.</p>}
              </div>
          </div>
      </div>

      {/* FULL TABLE SEARCH */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <h3 className="font-bold text-gray-800 text-lg">Gerenciamento da Carteira</h3>
             <div className="flex gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                 </div>
                 
                 <select 
                    className="border border-gray-300 rounded-lg py-2 px-3 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                 >
                    <option value="ALL">Todos os Status</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="NEW">Novos</option>
                    <option value="INACTIVE">Risco (Inativos)</option>
                    <option value="LOST">Perdidos</option>
                 </select>

                 <button onClick={handleExportClients} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                     <Download size={16}/> Exportar Lista
                 </button>
             </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <tr>
                        <th className="px-4 py-3 text-left font-bold">Cliente</th>
                        <th className="px-4 py-3 text-center font-bold">Status</th>
                        <th className="px-4 py-3 text-center font-bold">Recência (Dias)</th>
                        <th className="px-4 py-3 text-center font-bold">Frequência</th>
                        <th className="px-4 py-3 text-right font-bold">Valor Monetário (Total)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredMetrics.map((client) => (
                        <tr key={client.name} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">
                                {client.name}
                                <span className="block text-[10px] text-gray-400">Última compra: {new Date(client.lastPurchaseDate).toLocaleDateString()}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                {client.status === 'ACTIVE' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Ativo</span>}
                                {client.status === 'NEW' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">Novo</span>}
                                {client.status === 'INACTIVE' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">Risco</span>}
                                {client.status === 'LOST' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Perdido</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className={`font-mono font-bold ${client.daysSinceLastPurchase > 60 ? 'text-red-500' : 'text-gray-700'}`}>
                                    {client.daysSinceLastPurchase}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">{client.totalOrders} pedidos</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(client.totalSpent)}</td>
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
