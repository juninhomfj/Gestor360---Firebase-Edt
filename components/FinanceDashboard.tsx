import React, { useMemo, useState, useEffect } from 'react';
import { FinanceAccount, Transaction, CreditCard as CardType, Receivable, DashboardWidgetConfig, FinancialPacing, TransactionCategory } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Target, Plus, EyeOff, Eye, Settings, X, PiggyBank, ArrowLeftRight, List, Bell, Calculator, AlertCircle, PlayCircle, BarChart3 } from 'lucide-react';
import { getSystemConfig, calculateFinancialPacing, getFinanceData } from '../services/logic';
import { getSession } from '../services/auth'; 

interface FinanceDashboardProps {
  accounts: FinanceAccount[];
  transactions: Transaction[];
  cards: CardType[];
  receivables?: Receivable[];
  darkMode?: boolean;
  hideValues: boolean;
  config: DashboardWidgetConfig;
  onToggleHide: () => void;
  onUpdateConfig: (cfg: DashboardWidgetConfig) => void;
  onNavigate: (tab: string) => void;
  expenseNoticeDays?: number; 
  onUpdateNoticeDays?: (days: number) => void; 
}

const formatCurrency = (val: number, hidden: boolean) => {
    if (hidden) return '••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const StatCard = ({ title, value, icon: Icon, type, darkMode }: any) => {
  let iconBg = darkMode ? 'bg-slate-800' : 'bg-gray-100';
  let iconColor = darkMode ? 'text-cyan-400' : 'text-gray-600';
  let valueColor = darkMode ? 'text-white' : 'text-gray-900';
  let glowClass = '';
  
  const containerClass = darkMode 
    ? 'glass-panel hover:bg-slate-800/50' 
    : 'bg-white border-gray-200 shadow-sm hover:shadow-md border';

  if (type === 'positive') {
    iconBg = darkMode ? 'bg-emerald-900/30' : 'bg-emerald-50';
    iconColor = darkMode ? 'text-emerald-400' : 'text-emerald-600';
    valueColor = darkMode ? 'text-emerald-400' : 'text-emerald-700';
    glowClass = darkMode ? 'shadow-[0_0_15px_rgba(52,211,153,0.15)]' : '';
  } else if (type === 'negative') {
    iconBg = darkMode ? 'bg-red-900/30' : 'bg-red-50';
    iconColor = darkMode ? 'text-red-400' : 'text-red-600';
    valueColor = darkMode ? 'text-red-400' : 'text-red-700';
    glowClass = darkMode ? 'shadow-[0_0_15px_rgba(248,113,113,0.15)]' : '';
  }

  return (
    <div className={`${containerClass} p-6 rounded-2xl flex items-center gap-4 transition-all duration-300 transform hover:-translate-y-1 ${glowClass}`}>
      <div className={`p-4 rounded-xl ${iconBg} ${iconColor}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
        <h3 className={`text-2xl font-black mt-1 ${valueColor}`}>{value}</h3>
      </div>
    </div>
  );
};

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ 
    accounts, transactions, cards, receivables = [], 
    darkMode, hideValues, config, onToggleHide, onUpdateConfig, onNavigate,
    expenseNoticeDays = 5, onUpdateNoticeDays
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [includeNonAccounting, setIncludeNonAccounting] = useState(false);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [pacing, setPacing] = useState<FinancialPacing | null>(null);
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
      getSystemConfig().then(cfg => {
          setIncludeNonAccounting(cfg.includeNonAccountingInTotal);
      });
      getFinanceData().then(data => {
          setCategories(data.categories || []);
      });

      const user = getSession();
      let days: number[] = [];
      if (user && user.financialProfile) {
          if (Array.isArray(user.financialProfile.salaryDays)) {
              days = user.financialProfile.salaryDays;
          } else if ((user.financialProfile as any).salaryDay) {
              days = [(user.financialProfile as any).salaryDay];
          }
      }

      if (days.length > 0) {
          const balance = accounts.reduce((acc, a) => {
              if (!includeNonAccounting && a.isAccounting === false) return acc;
              return acc + a.balance;
          }, 0);
          const res = calculateFinancialPacing(balance, days, transactions);
          setPacing(res);
      }
  }, [accounts, transactions, includeNonAccounting]);

  const totalBalance = accounts.reduce((acc, a) => {
      if (!includeNonAccounting && a.isAccounting === false) return acc;
      return acc + a.balance;
  }, 0);
  
  const hasHiddenAccounts = accounts.some(a => a.isAccounting === false);

  const totalPendingReceivables = receivables
    .filter(r => r.status === 'PENDING')
    .reduce((acc, r) => acc + r.value, 0);

  const monthlyTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncomeMonth = monthlyTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenseMonth = monthlyTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
  const avgDailyExpense = new Date().getDate() > 0 ? totalExpenseMonth / new Date().getDate() : 0;

  const budgets = useMemo(() => {
      const budgetList: any[] = [];
      categories.filter(c => c.monthlyBudget && c.monthlyBudget > 0 && c.type === 'EXPENSE').forEach(cat => {
          const spent = monthlyTransactions
              .filter(t => t.categoryId === cat.id && t.type === 'EXPENSE')
              .reduce((acc, t) => acc + t.amount, 0);
          
          budgetList.push({
              name: cat.name,
              limit: cat.monthlyBudget || 0,
              spent,
              percent: (spent / (cat.monthlyBudget || 1)) * 100
          });
      });
      return budgetList.sort((a,b) => b.percent - a.percent);
  }, [categories, monthlyTransactions]);

  const chartData = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      months.push({ name: key, entradas: 0, saidas: 0 });
    }
    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const bin = months.find(m => m.name === key);
      if (bin) {
        if (t.type === 'INCOME') bin.entradas += t.amount;
        if (t.type === 'EXPENSE') bin.saidas += t.amount;
      }
    });
    return months;
  }, [transactions]);

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const [clicks, setClicks] = useState(0);
  const handleEasterEgg = () => {
      setClicks(c => c + 1);
      if (clicks + 1 >= 5) {
          alert("Easter Egg encontrado! O desenvolvedor mandou um abraço! 🚀");
          setClicks(0);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="flex justify-between items-center">
        <div>
            <h1 className={`text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
                Visão Financeira
            </h1>
            <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Gestão inteligente de patrimônio.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={onToggleHide} className={`p-2.5 rounded-xl transition-all duration-300 ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white hover:scale-105' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button onClick={() => setShowConfig(true)} className={`p-2.5 rounded-xl transition-all duration-300 ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white hover:scale-105' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                <Settings size={20} />
            </button>
        </div>
      </div>

      {config.showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
                onClick={() => onNavigate('fin_receivables')}
                className={`relative overflow-hidden p-6 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 ${darkMode ? 'glass-panel border-l-4 border-l-cyan-500' : 'bg-white shadow-lg border-l-4 border-l-blue-500'}`}
            >
                <div className={`absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity ${darkMode ? 'text-cyan-400' : 'text-blue-500'}`}>
                    <PiggyBank size={100} />
                </div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-cyan-400' : 'text-blue-600'}`}>A Receber</h3>
                    <PiggyBank size={24} className={`${darkMode ? 'text-cyan-400' : 'text-blue-500'}`} />
                </div>
                <p className={`text-3xl font-black relative z-10 ${darkMode ? 'text-cyan-50' : 'text-blue-900'}`}>{formatCurrency(totalPendingReceivables, hideValues)}</p>
            </div>

            <div 
                onClick={() => onNavigate('fin_distribution')}
                className={`relative overflow-hidden p-6 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 ${darkMode ? 'glass-panel border-l-4 border-l-purple-500' : 'bg-white shadow-lg border-l-4 border-l-purple-500'}`}
            >
                <div className={`absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>
                    <ArrowLeftRight size={100} />
                </div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>Distribuição</h3>
                    <ArrowLeftRight size={24} className={`${darkMode ? 'text-purple-400' : 'text-purple-500'}`} />
                </div>
                <p className={`text-2xl font-bold relative z-10 ${darkMode ? 'text-purple-50' : 'text-purple-900'}`}>Distribuir Lucros</p>
                <p className="text-xs opacity-60 mt-1">Configurar repasses</p>
            </div>

            <div 
                onClick={() => onNavigate('fin_transactions')}
                className={`relative overflow-hidden p-6 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1 ${darkMode ? 'glass-panel border-l-4 border-l-emerald-500' : 'bg-white shadow-lg border-l-4 border-l-emerald-500'}`}
            >
                <div className={`absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity ${darkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>
                    <List size={100} />
                </div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Extrato</h3>
                    <List size={24} className={`${darkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />
                </div>
                <p className={`text-2xl font-bold relative z-10 ${darkMode ? 'text-emerald-50' : 'text-emerald-900'}`}>Ver Histórico</p>
                <p className="text-xs opacity-60 mt-1">Todas as contas</p>
            </div>
          </div>
      )}

      {config.showPacing && pacing && (
          <div className={`relative overflow-hidden rounded-2xl p-8 transition-all hover:scale-[1.01] ${darkMode ? 'glass-panel border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'bg-indigo-50 border border-indigo-100 shadow-md'}`}>
              <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
                  <div className="flex-1">
                      <h3 className={`text-xl font-bold flex items-center gap-3 ${darkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>
                          <Calculator size={24} className="text-indigo-500" /> Ritmo Financeiro
                      </h3>
                      <p className={`text-sm mt-2 leading-relaxed ${darkMode ? 'text-indigo-200/70' : 'text-indigo-600'}`}>
                          Análise preditiva baseada no seu saldo atual versus dias restantes até o próximo recebimento ({pacing.nextIncomeDate.getDate()}).
                      </p>
                      
                      <div className="mt-6 grid grid-cols-2 gap-6">
                          <div className={`p-4 rounded-xl ${darkMode ? 'bg-black/20' : 'bg-white/60'}`}>
                              <span className="text-xs uppercase font-bold opacity-60">Dias Restantes</span>
                              <p className="text-3xl font-black">{pacing.daysRemaining}</p>
                          </div>
                          <div className={`p-4 rounded-xl ${darkMode ? 'bg-black/20' : 'bg-white/60'}`}>
                              <span className="text-xs uppercase font-bold opacity-60">Contas Pendentes</span>
                              <p className="text-3xl font-black text-red-500">{formatCurrency(pacing.pendingExpenses, hideValues)}</p>
                          </div>
                      </div>
                  </div>

                  <div className={`flex flex-col items-center justify-center p-6 rounded-2xl min-w-[240px] border backdrop-blur-md ${darkMode ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white shadow-lg border-indigo-100'}`}>
                      <span className="text-xs uppercase font-bold tracking-widest opacity-70 mb-2">Teto de Gasto Diário</span>
                      <p className={`text-4xl font-black ${pacing.safeDailySpend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(pacing.safeDailySpend, hideValues)}
                      </p>
                      <span className="text-[10px] opacity-50 mt-1">Seguro para não negativar</span>
                  </div>
              </div>
              
              <div className="absolute -right-10 -bottom-20 opacity-5 pointer-events-none">
                  <PlayCircle size={250} className="text-indigo-500" />
              </div>
          </div>
      )}

      {config.showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={handleEasterEgg} className="cursor-pointer select-none">
                <StatCard 
                    title={
                        <span className="flex items-center gap-1">
                            Patrimônio Total {hasHiddenAccounts && !includeNonAccounting && <EyeOff size={12}/>}
                        </span>
                    } 
                    value={formatCurrency(totalBalance, hideValues)} 
                    icon={Wallet} 
                    type={totalBalance >= 0 ? 'positive' : 'negative'} 
                    darkMode={darkMode} 
                />
            </div>
            <StatCard title="Entradas (Mês)" value={formatCurrency(totalIncomeMonth, hideValues)} icon={TrendingUp} type="positive" darkMode={darkMode} />
            <StatCard title="Saídas (Mês)" value={formatCurrency(totalExpenseMonth, hideValues)} icon={TrendingDown} type="negative" darkMode={darkMode} />
            <StatCard title="Gasto Médio/Dia" value={formatCurrency(avgDailyExpense, hideValues)} icon={DollarSign} type="neutral" darkMode={darkMode} />
          </div>
      )}

      {(config.showCharts || config.showRecents || config.showBudgets) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {(config.showBudgets !== false) && budgets.length > 0 && (
                  <div className={`col-span-1 rounded-2xl p-6 border ${darkMode ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          <Target size={20} className="text-blue-500"/> Orçamentos
                      </h2>
                      <div className="space-y-5 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                          {budgets.map((b, idx) => (
                              <div key={idx} className="group">
                                  <div className="flex justify-between text-xs mb-2 font-medium">
                                      <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{b.name}</span>
                                      <span className={b.percent > 100 ? 'text-red-500 font-bold' : (darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                          {formatCurrency(b.spent, hideValues)} / {formatCurrency(b.limit, hideValues)}
                                      </span>
                                  </div>
                                  <div className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${b.percent > 100 ? 'bg-red-500' : (b.percent > 80 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                                        style={{ width: `${Math.min(b.percent, 100)}%` }}
                                      >
                                          <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {config.showCharts && (
                  <div className={`col-span-1 rounded-2xl p-6 min-w-0 border ${darkMode ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
                     <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                         <BarChart3 size={20} className="text-emerald-500" /> Fluxo de Caixa
                     </h2>
                     <div className="h-72 w-full">
                        {hideValues ? (
                            <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-2">
                                <EyeOff size={32} />
                                <span className="text-sm">Valores Ocultos</span>
                            </div>
                        ) : (
                            <ResponsiveContainer width="99%" height="100%">
                              <BarChart data={chartData} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0"} />
                                <XAxis dataKey="name" stroke={darkMode ? "#94a3b8" : "#64748b"} tickLine={false} axisLine={false} fontSize={12} dy={10} />
                                <YAxis stroke={darkMode ? "#94a3b8" : "#64748b"} tickFormatter={(val) => `${val/1000}k`} tickLine={false} axisLine={false} fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: darkMode ? '#0f172a' : '#fff', 
                                        borderColor: darkMode ? '#334155' : '#e2e8f0', 
                                        color: darkMode ? '#fff' : '#0f172a',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                                    }}
                                    itemStyle={{ color: darkMode ? '#cbd5e1' : '#475569', fontSize: '12px' }}
                                    formatter={(value: number) => formatCurrency(value, false)}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar 
                                    dataKey="entradas" 
                                    name="Entradas" 
                                    fill="#10b981" 
                                    radius={[4, 4, 0, 0]} 
                                    animationDuration={1500}
                                />
                                <Bar 
                                    dataKey="saidas" 
                                    name="Saídas" 
                                    fill="#ef4444" 
                                    radius={[4, 4, 0, 0]} 
                                    animationDuration={1500}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                        )}
                     </div>
                  </div>
              )}

              {config.showRecents && (
                  <div className={`col-span-1 rounded-2xl p-6 border ${darkMode ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Últimas Movimentações</h2>
                      <div className="space-y-3">
                        {recentTransactions.map(t => (
                            <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.01] ${darkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                                <div className="min-w-0 mr-4">
                                    <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.description}</p>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                        {new Date(t.date).toLocaleDateString('pt-BR')} • {t.personType} {t.subcategory && `• ${t.subcategory}`}
                                    </p>
                                </div>
                                <p className={`text-sm font-bold whitespace-nowrap ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount, hideValues)}
                                </p>
                            </div>
                        ))}
                        {recentTransactions.length === 0 && (
                            <p className={`text-center py-12 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Nenhuma movimentação recente.</p>
                        )}
                      </div>
                  </div>
              )}
          </div>
      )}

      {showConfig && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95`}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Personalizar Dashboard</h3>
                      <button onClick={() => setShowConfig(false)}><X className="text-gray-500 hover:text-gray-700"/></button>
                  </div>
                  <div className="space-y-2">
                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Ritmo Financeiro (IA)</span>
                          <input type="checkbox" checked={config.showPacing !== false} onChange={e => onUpdateConfig({...config, showPacing: e.target.checked})} className="w-5 h-5 rounded text-purple-600 accent-purple-600"/>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Orçamentos</span>
                          <input type="checkbox" checked={config.showBudgets !== false} onChange={e => onUpdateConfig({...config, showBudgets: e.target.checked})} className="w-5 h-5 rounded text-purple-600 accent-purple-600"/>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Cartões de Resumo</span>
                          <input type="checkbox" checked={config.showStats} onChange={e => onUpdateConfig({...config, showStats: e.target.checked})} className="w-5 h-5 rounded text-purple-600 accent-purple-600"/>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Gráficos</span>
                          <input type="checkbox" checked={config.showCharts} onChange={e => onUpdateConfig({...config, showCharts: e.target.checked})} className="w-5 h-5 rounded text-purple-600 accent-purple-600"/>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>Lista Recente</span>
                          <input type="checkbox" checked={config.showRecents} onChange={e => onUpdateConfig({...config, showRecents: e.target.checked})} className="w-5 h-5 rounded text-purple-600 accent-purple-600"/>
                      </label>
                      
                      <hr className={`my-2 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`} />
                      
                      {onUpdateNoticeDays && (
                          <div className="p-2">
                              <label className={`block text-xs font-bold mb-2 flex items-center gap-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  <Bell size={12} /> Alertas de Vencimento
                              </label>
                              <div className="flex items-center gap-2">
                                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Avisar</span>
                                  <input 
                                    type="number" 
                                    min="1" 
                                    max="30"
                                    value={expenseNoticeDays}
                                    onChange={(e) => onUpdateNoticeDays(parseInt(e.target.value) || 1)}
                                    className={`w-16 p-1 text-center rounded border ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300'}`}
                                  />
                                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>dias antes</span>
                              </div>
                          </div>
                      )}
                  </div>
                  <button onClick={() => setShowConfig(false)} className="w-full mt-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg">Salvar Preferências</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default FinanceDashboard;