import React, { useState, useEffect } from 'react';
import { Sale, ProductType, DashboardWidgetConfig, Transaction, User, SalesTargets } from '../types'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, Gift, ShoppingBasket, Plus, Calendar, Eye, EyeOff, Settings, X, Clock, CheckCircle2, Sparkles, Target, Edit3 } from 'lucide-react';
import AiConsultant from './AiConsultant'; 
import { getFinanceData, getSystemConfig } from '../services/logic'; 

interface DashboardProps {
  sales: Sale[];
  onNewSale: () => void;
  darkMode?: boolean;
  hideValues: boolean;
  config: DashboardWidgetConfig;
  onToggleHide: () => void;
  onUpdateConfig: (cfg: DashboardWidgetConfig) => void;
  currentUser?: User;
  salesTargets?: SalesTargets; 
  onUpdateTargets?: (targets: SalesTargets) => void; 
  isAdmin: boolean;
  isDev: boolean;
}

const formatCurrency = (val: number, hidden: boolean) => {
    if (hidden) return '••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const StatCard: React.FC<{ title: string; value: string; sub: string; icon: React.ReactNode; color: string; darkMode?: boolean }> = ({ title, value, sub, icon, color, darkMode }) => {
  const bgClass = darkMode 
    ? 'bg-slate-800/60 backdrop-blur-sm border-slate-700/50' 
    : 'bg-white border-gray-100'; 

  return (
    <div className={`${bgClass} rounded-xl p-6 shadow-sm border flex items-start space-x-4 transition-all hover:shadow-md hover:scale-[1.01]`}>
        <div className={`p-3 rounded-lg ${color} text-white shadow-lg`}>
        {icon}
        </div>
        <div>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
        <h3 className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</h3>
        <p className={`text-xs mt-1 font-medium ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{sub}</p>
        </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  sales, onNewSale, darkMode, hideValues, config, onToggleHide, onUpdateConfig, 
  currentUser, salesTargets, onUpdateTargets,
  isAdmin, isDev 
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [showAi, setShowAi] = useState(false); 
  const [transactions, setTransactions] = useState<Transaction[]>([]); 
  const [aiGlobalEnabled, setAiGlobalEnabled] = useState(false);
  
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTargets, setTempTargets] = useState({ basic: '0', natal: '0' });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  useEffect(() => {
      getSystemConfig().then(cfg => {
          setAiGlobalEnabled(cfg.modules?.ai ?? true);
      });
  }, []);

  const handleOpenTargetModal = () => {
      setTempTargets({
          basic: (salesTargets?.basic || 0).toString(),
          natal: (salesTargets?.natal || 0).toString()
      });
      setShowTargetModal(true);
  };

  const handleSaveTargets = () => {
      if (onUpdateTargets) {
          onUpdateTargets({
              basic: parseInt(tempTargets.basic) || 0,
              natal: parseInt(tempTargets.natal) || 0
          });
      }
      setShowTargetModal(false);
  };

  const handleOpenAi = async () => {
      const data = await getFinanceData();
      setTransactions(data.transactions || []);
      setShowAi(true);
  };

  const vibrate = () => {
      if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleNewSaleClick = () => {
      vibrate();
      onNewSale();
  };

  const basicSalesMonth = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return s.type === ProductType.BASICA && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const natalSalesYear = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return s.type === ProductType.NATAL && d.getFullYear() === currentYear;
  });

  const allSalesMonth = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalCommissionMonth = allSalesMonth.reduce((acc, curr) => acc + curr.commissionValueTotal, 0);
  const basicQtyMonth = basicSalesMonth.reduce((acc, curr) => acc + curr.quantity, 0);
  const basicCommissionMonth = basicSalesMonth.reduce((acc, curr) => acc + curr.commissionValueTotal, 0);
  const natalQtyYear = natalSalesYear.reduce((acc, curr) => acc + curr.quantity, 0);
  const natalCommissionYear = natalSalesYear.reduce((acc, curr) => acc + curr.commissionValueTotal, 0);
  const showNatalCard = natalSalesYear.length > 0 || (salesTargets?.natal || 0) > 0;

  const chartData = React.useMemo(() => {
    const months = new Map<string, { name: string; basica: number; natal: number; total: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.set(key, {
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        basica: 0,
        natal: 0,
        total: 0,
      });
    }

    sales.forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (months.has(key)) {
        const bin = months.get(key)!;
        if (sale.type === ProductType.BASICA) bin.basica += sale.commissionValueTotal;
        else bin.natal += sale.commissionValueTotal;
        bin.total += sale.commissionValueTotal;
      }
    });

    return Array.from(months.values());
  }, [sales]);

  const recentSales = [...sales].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : new Date(a.completionDate || '2099-01-01').getTime();
      const dateB = b.date ? new Date(b.date).getTime() : new Date(b.completionDate || '2099-01-01').getTime();
      return dateB - dateA;
  }).slice(0, 5);

  const containerClass = darkMode 
    ? 'bg-slate-800/60 border-slate-700/50 backdrop-blur-md' 
    : 'bg-white border-gray-100';

  const isUserAiEnabled = currentUser?.keys?.isGeminiEnabled === true;
  const showAiButton = aiGlobalEnabled && isUserAiEnabled;

  const basicProgress = salesTargets?.basic ? Math.min((basicQtyMonth / salesTargets.basic) * 100, 100) : 0;
  const natalProgress = salesTargets?.natal ? Math.min((natalQtyYear / salesTargets.natal) * 100, 100) : 0;

  return (
    <div className="space-y-6 relative">
      <AiConsultant 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        sales={sales} 
        transactions={transactions} 
        darkMode={darkMode} 
        userKeys={currentUser?.keys}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Visão Geral</h1>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Competência: {capitalizedMonth} / {currentYear}</p>
        </div>
        
        <div className="flex gap-2 items-center">
            {showAiButton && (
                <>
                    <button 
                        onClick={handleOpenAi} 
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-lg hover:shadow-lg hover:shadow-purple-500/30 flex items-center gap-2 text-xs font-bold transition-all animate-in zoom-in"
                        title="Consultor IA"
                    >
                        <Sparkles size={16} /> <span className="hidden md:inline">Consultor IA</span>
                    </button>
                    <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                </>
            )}

            <button onClick={onToggleHide} className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            
            <button onClick={() => setShowConfig(true)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                <Settings size={20} />
            </button>

            <button 
                onClick={handleNewSaleClick}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center shadow-sm transition-colors active:scale-95"
            >
                <Plus size={20} className="mr-2" />
                Nova Venda
            </button>
        </div>
      </div>
      
      {config.showStats && salesTargets && (salesTargets.basic > 0 || salesTargets.natal > 0) && (
          <div className={`${containerClass} rounded-xl p-6 shadow-sm border`}>
              <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      <Target size={20} className="text-blue-500"/> Metas de Vendas
                  </h3>
                  <button onClick={handleOpenTargetModal} className={`text-xs flex items-center gap-1 font-bold ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-gray-900'}`}>
                      <Edit3 size={12}/> Editar
                  </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {salesTargets.basic > 0 && (
                      <div>
                          <div className="flex justify-between text-sm mb-1">
                              <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Cestas Básicas (Mês)</span>
                              <span className={`font-bold ${basicQtyMonth >= salesTargets.basic ? 'text-emerald-500' : (darkMode ? 'text-white' : 'text-gray-900')}`}>
                                  {basicQtyMonth} / {salesTargets.basic}
                              </span>
                          </div>
                          <div className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${basicProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${basicProgress}%` }}></div>
                          </div>
                      </div>
                  )}
                  {salesTargets.natal > 0 && (
                      <div>
                          <div className="flex justify-between text-sm mb-1">
                              <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Cestas Natal (Ano)</span>
                              <span className={`font-bold ${natalQtyYear >= salesTargets.natal ? 'text-emerald-500' : (darkMode ? 'text-white' : 'text-gray-900')}`}>
                                  {natalQtyYear} / {salesTargets.natal}
                              </span>
                          </div>
                          <div className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${natalProgress >= 100 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${natalProgress}%` }}></div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {config.showStats && (
          <div className={`grid grid-cols-1 ${showNatalCard ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
            <StatCard 
              title={`Comissão Estimada (${capitalizedMonth})`} 
              value={formatCurrency(totalCommissionMonth, hideValues)} 
              sub="Previsão de recebimento mensal"
              icon={<DollarSign size={24} />}
              color="bg-slate-700"
              darkMode={darkMode}
            />
            <StatCard 
              title={`Cesta Básica (${capitalizedMonth})`} 
              value={formatCurrency(basicCommissionMonth, hideValues)} 
              sub={`${basicQtyMonth} cestas vendidas no mês`}
              icon={<ShoppingBasket size={24} />}
              color="bg-emerald-500"
              darkMode={darkMode}
            />
            {showNatalCard && (
              <StatCard 
                title={`Natal (${currentYear})`} 
                value={formatCurrency(natalCommissionYear, hideValues)} 
                sub={`${natalQtyYear} cestas (Acumulado Ano)`}
                icon={<Gift size={24} />}
                color="bg-red-500"
                darkMode={darkMode}
              />
            )}
          </div>
      )}

      {(config.showCharts || config.showRecents) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {config.showCharts && (
                <div className={`lg:col-span-2 ${containerClass} p-6 rounded-xl shadow-sm border min-w-0 relative`}>
                  <h3 className={`text-lg font-semibold mb-6 flex items-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    <Calendar className={`w-4 h-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}/>
                    Evolução de Comissões (12 Meses)
                  </h3>
                  <div className="h-72 w-full">
                    {hideValues ? (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            <EyeOff size={32} />
                        </div>
                    ) : (
                        <ResponsiveContainer width="99%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f0f0f0'} />
                            <XAxis dataKey="name" fontSize={12} tick={{fill: darkMode ? '#94a3b8' : '#6b7280'}} axisLine={false} tickLine={false} />
                            <YAxis fontSize={12} tickFormatter={(val) => `R$${val}`} tick={{fill: darkMode ? '#94a3b8' : '#6b7280'}} axisLine={false} tickLine={false} width={80} />
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(value, false)}
                              contentStyle={{ 
                                backgroundColor: darkMode ? '#1e293b' : '#fff', 
                                borderRadius: '8px', 
                                border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0', 
                                color: darkMode ? '#fff' : '#000'
                              }}
                            />
                            <Legend />
                            <Line isAnimationActive={true} animationDuration={2000} animationEasing="ease-in-out" type="monotone" dataKey="basica" name="Básica" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                            <Line isAnimationActive={true} animationDuration={2000} animationEasing="ease-in-out" type="monotone" dataKey="natal" name="Natal" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                          </LineChart>
                        </ResponsiveContainer>
                    )}
                  </div>
                </div>
            )}

            {config.showRecents && (
                <div className={`${containerClass} p-6 rounded-xl shadow-sm border overflow-hidden`}>
                  <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Últimas Vendas</h3>
                  <div className="overflow-y-auto max-h-[300px] space-y-3">
                    {recentSales.map(sale => (
                      <div key={sale.id} className={`flex flex-col p-3 rounded-lg border-l-4 ${!sale.date ? 'border-orange-500' : 'border-emerald-500'} ${darkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{sale.client}</div>
                            <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                                {sale.type === ProductType.BASICA ? 'Básica' : 'Natal'} • {sale.quantity} und
                            </div>
                          </div>
                          <div className={`text-right font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            {hideValues ? '••••••' : `+ ${formatCurrency(sale.commissionValueTotal, false)}`}
                          </div>
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-xs text-gray-400">Status:</span>
                            {sale.date ? (
                                <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 size={12}/> Faturamento: {new Date(sale.date).toLocaleDateString('pt-BR')}
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-orange-500 flex items-center gap-1 animate-pulse">
                                    <Clock size={12}/> Faturamento: Pendente
                                </span>
                            )}
                        </div>
                      </div>
                    ))}
                    {recentSales.length === 0 && (
                        <div className={`py-8 text-center ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Nenhuma venda recente</div>
                    )}
                  </div>
                </div>
            )}
          </div>
      )}

      {showConfig && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-sm shadow-2xl`}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Personalizar Dashboard</h3>
                      <button onClick={() => setShowConfig(false)}><X className="text-gray-500 hover:text-gray-700"/></button>
                  </div>
                  <div className="space-y-4">
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-black/5 dark:hover:bg-white/5">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Mostrar Cartões de Resumo</span>
                          <input type="checkbox" checked={config.showStats} onChange={e => onUpdateConfig({...config, showStats: e.target.checked})} className="w-5 h-5 rounded text-emerald-600"/>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-black/5 dark:hover:bg-white/5">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Mostrar Gráficos</span>
                          <input type="checkbox" checked={config.showCharts} onChange={e => onUpdateConfig({...config, showCharts: e.target.checked})} className="w-5 h-5 rounded text-emerald-600"/>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-black/5 dark:hover:bg-white/5">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Mostrar Lista Recente</span>
                          <input type="checkbox" checked={config.showRecents} onChange={e => onUpdateConfig({...config, showRecents: e.target.checked})} className="w-5 h-5 rounded text-emerald-600"/>
                      </label>
                      
                      <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                          <button onClick={() => { setShowConfig(false); handleOpenTargetModal(); }} className="w-full py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg font-bold text-sm">
                              Definir Metas de Vendas
                          </button>
                      </div>
                  </div>
                  <button onClick={() => setShowConfig(false)} className="w-full mt-6 py-2 bg-emerald-600 text-white rounded-lg font-bold">Concluir</button>
              </div>
          </div>
      )}

      {showTargetModal && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95`}>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      <Target size={20} className="text-blue-500"/> Definir Metas
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className={`block text-xs font-bold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Cesta Básica (Mensal)</label>
                          <input 
                            type="number" 
                            className={`w-full p-2 border rounded ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            value={tempTargets.basic}
                            onChange={e => setTempTargets({...tempTargets, basic: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className={`block text-xs font-bold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Cesta Natal (Anual)</label>
                          <input 
                            type="number" 
                            className={`w-full p-2 border rounded ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            value={tempTargets.natal}
                            onChange={e => setTempTargets({...tempTargets, natal: e.target.value})}
                          />
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setShowTargetModal(false)} className={`flex-1 py-2 rounded font-bold text-sm ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>Cancelar</button>
                      <button onClick={handleSaveTargets} className="flex-1 py-2 bg-blue-600 text-white rounded font-bold text-sm">Salvar Metas</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;