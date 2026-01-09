
import React, { useMemo, useState, useEffect } from 'react';
import { FinanceAccount, Transaction, CreditCard as CardType, Receivable, DashboardWidgetConfig, FinancialPacing, TransactionCategory } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ReferenceLine } from 'recharts';
// Fix: Removed 'LineChart' and 'Line' from lucide-react imports as they are either redundant or non-existent
import { Wallet, TrendingUp, TrendingDown, DollarSign, Target, Plus, EyeOff, Eye, Settings, X, PiggyBank, ArrowLeftRight, List, Bell, Calculator, AlertCircle, PlayCircle, BarChart3, ShieldCheck } from 'lucide-react';
import { getSystemConfig, calculateFinancialPacing, getFinanceData, formatCurrency, markAsReconciled } from '../services/logic';
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
          days = user.financialProfile.salaryDays || [1, 15];
      }

      const balance = accounts.reduce((acc, a) => {
          if (!includeNonAccounting && a.isAccounting === false) return acc;
          return acc + a.balance;
      }, 0);
      setPacing(calculateFinancialPacing(balance, days, transactions));
  }, [accounts, transactions, includeNonAccounting]);

  // Cálculo de Projeção Inteligente (30 dias)
  const projection = useMemo(() => {
      const balance = accounts.reduce((acc, a) => acc + (a.isAccounting !== false ? a.balance : 0), 0);
      const pendingIncome = receivables.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + r.value, 0);
      const futureExpenses = transactions.filter(t => !t.isPaid && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
      
      const projected = balance + pendingIncome - futureExpenses;
      const reconciledCount = transactions.filter(t => t.reconciled).length;
      const totalPaid = transactions.filter(t => t.isPaid).length;
      const reconciliationRate = totalPaid > 0 ? (reconciledCount / totalPaid) * 100 : 0;

      return { projected, pendingIncome, futureExpenses, reconciliationRate };
  }, [accounts, receivables, transactions]);

  const totalBalance = accounts.reduce((acc, a) => {
      if (!includeNonAccounting && a.isAccounting === false) return acc;
      return acc + a.balance;
  }, 0);

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

  const avgMonthlyExpense = useMemo(() => {
      const last3Months = chartData.slice(-3);
      const total = last3Months.reduce((acc, m) => acc + m.saidas, 0);
      return total / 3;
  }, [chartData]);

  const cardStyle = darkMode ? 'glass-panel border-slate-700' : 'bg-white border-gray-100 shadow-sm';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="flex justify-between items-center">
        <div>
            <h1 className={`text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
                Painel Financeiro <span className="text-emerald-500 font-normal">v2.8</span>
            </h1>
            <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Inteligência de Caixa e Governança.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={onToggleHide} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button onClick={() => setShowConfig(true)} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-600'}`}>
                <Settings size={20} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatMini icon={<Wallet/>} label="Saldo Contábil" value={formatCurrency(totalBalance)} color="emerald" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<TrendingDown/>} label="Comprometido" value={formatCurrency(projection.futureExpenses)} color="red" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<PiggyBank/>} label="Fluxo Pendente" value={formatCurrency(projection.pendingIncome)} color="blue" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<TrendingUp/>} label="Projeção 30d" value={formatCurrency(projection.projected)} color="purple" hide={hideValues} darkMode={darkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Widget de Projeção Visual */}
          <div className={`col-span-2 p-8 rounded-[2.5rem] border relative overflow-hidden ${cardStyle}`}>
              <div className="flex justify-between items-start mb-10">
                  <div>
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={24}/> Previsão de Patrimônio
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Simulação baseada em lançamentos provisionados</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${projection.projected >= totalBalance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {projection.projected >= totalBalance ? 'Tendência Alta' : 'Tendência Baixa'}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Audit Rate</span>
                      <p className="text-2xl font-black text-indigo-500">{projection.reconciliationRate.toFixed(1)}%</p>
                      <p className="text-[9px] text-slate-500 uppercase mt-1">Veracidade do Saldo</p>
                  </div>
                  <div className="md:col-span-2">
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-4 overflow-hidden shadow-inner">
                          <div className="h-full bg-indigo-600 transition-all duration-1000 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{width: `${projection.reconciliationRate}%`}}></div>
                      </div>
                  </div>
              </div>

              <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                          <defs>
                              <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                          <Area type="monotone" dataKey="entradas" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorProj)" />
                          <ReferenceLine y={avgMonthlyExpense} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Breakeven', fill: '#ef4444', fontSize: 10 }} />
                          <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#0f172a', color: '#fff' }} />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Quick Actions & Audit Info */}
          <div className="space-y-6">
              <div className={`p-6 rounded-[2rem] border ${cardStyle}`}>
                  <h4 className="font-bold mb-4 flex items-center gap-2"><List size={18}/> Audit Log</h4>
                  <div className="space-y-4">
                      {transactions.filter(t => !t.reconciled && t.isPaid).slice(0,3).map(t => (
                          <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <span className="text-xs font-bold text-amber-600 truncate max-w-[120px]">{t.description}</span>
                              <button onClick={() => markAsReconciled(t.id, true)} className="text-[9px] font-black uppercase text-amber-700 bg-amber-200 px-2 py-1 rounded-md hover:bg-amber-300 transition-all">Verificar</button>
                          </div>
                      ))}
                      {transactions.filter(t => !t.reconciled && t.isPaid).length === 0 && (
                          <div className="text-center py-6">
                              <ShieldCheck size={32} className="mx-auto text-emerald-500 opacity-20 mb-2"/>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Tudo Auditado</p>
                          </div>
                      )}
                  </div>
              </div>
              
              <button 
                onClick={() => onNavigate('fin_transactions')}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-[2rem] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-[0.2em]"
              >
                  <ArrowLeftRight size={20}/> Abrir Extrato Completo
              </button>
          </div>
      </div>
    </div>
  );
};

const StatMini = ({ icon: Icon, label, value, color, hide, darkMode }: any) => (
    <div className={`p-5 rounded-3xl border flex items-center gap-4 transition-all hover:translate-y-[-4px] ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className={`p-3 rounded-2xl bg-${color}-500/10 text-${color}-500`}>
            {Icon}
        </div>
        <div>
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{label}</p>
            <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{hide ? '••••••' : value}</p>
        </div>
    </div>
);

export default FinanceDashboard;
