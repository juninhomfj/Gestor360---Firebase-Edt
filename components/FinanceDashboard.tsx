import React, { useMemo, useState, useEffect } from 'react';
import { FinanceAccount, Transaction, CreditCard as CardType, Receivable, DashboardWidgetConfig, FinancialPacing, TransactionCategory } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ReferenceLine, ReferenceArea } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Target, Plus, EyeOff, Eye, Settings, X, PiggyBank, ArrowLeftRight, List, Bell, Calculator, AlertCircle, PlayCircle, BarChart3, ShieldCheck } from 'lucide-react';
import { getSystemConfig, calculateFinancialPacing, getFinanceData, formatCurrency, markAsReconciled, calculatePredictiveCashFlow } from '../services/logic';
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
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ 
    accounts, transactions, cards, receivables = [], 
    darkMode, hideValues, config, onToggleHide, onUpdateConfig, onNavigate
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [includeNonAccounting, setIncludeNonAccounting] = useState(false);
  
  useEffect(() => {
      getSystemConfig().then(cfg => {
          setIncludeNonAccounting(cfg.includeNonAccountingInTotal);
      });
  }, []);

  const totalBalance = accounts.reduce((acc, a) => {
      if (!includeNonAccounting && a.isAccounting === false) return acc;
      return acc + a.balance;
  }, 0);

  // --- MOTOR PREDITIVO (Etapa 4) ---
  const timelineData = useMemo(() => {
    return calculatePredictiveCashFlow(totalBalance, receivables, transactions);
  }, [totalBalance, receivables, transactions]);

  const stats = useMemo(() => {
      const pendingIncome = receivables.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + (r.value - (r.deductions?.reduce((a,b) => a+b.amount,0)||0)), 0);
      const futureExpenses = transactions.filter(t => !t.isPaid && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
      const reconciledCount = transactions.filter(t => t.reconciled).length;
      const totalPaid = transactions.filter(t => t.isPaid).length;
      const reconciliationRate = totalPaid > 0 ? (reconciledCount / totalPaid) * 100 : 0;
      return { pendingIncome, futureExpenses, reconciliationRate };
  }, [receivables, transactions]);

  const cardStyle = darkMode ? 'glass-panel border-slate-700' : 'bg-white border-gray-100 shadow-sm';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="flex justify-between items-center">
        <div>
            <h1 className={`text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
                Painel Financeiro <span className="text-indigo-500 font-normal">360</span>
            </h1>
            <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Inteligência Diária e Fluxo Preditivo.</p>
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
          <StatMini icon={<TrendingDown/>} label="Despesas em Aberto" value={formatCurrency(stats.futureExpenses)} color="red" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<PiggyBank/>} label="Comissões Pendentes" value={formatCurrency(stats.pendingIncome)} color="blue" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<TrendingUp/>} label="Saldo Final (30d)" value={formatCurrency(timelineData[30].balance)} color="indigo" hide={hideValues} darkMode={darkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* GRÁFICO PREDITIVO (Etapa 4) */}
          <div className={`col-span-2 p-8 rounded-[2.5rem] border relative overflow-hidden ${cardStyle}`}>
              <div className="flex justify-between items-start mb-10">
                  <div>
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <TrendingUp className="text-indigo-500" size={24}/> Fluxo de Caixa Preditivo
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Evolução do saldo diário baseada em compromissos</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${timelineData[30].balance >= totalBalance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {timelineData[30].balance >= totalBalance ? 'Capital em Crescimento' : 'Retração de Caixa'}
                  </div>
              </div>

              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData}>
                          <defs>
                              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                          <XAxis dataKey="displayDate" axisLine={false} tickLine={false} fontSize={10} interval={5} />
                          <YAxis hide={hideValues} axisLine={false} tickLine={false} fontSize={10} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#0f172a', color: '#fff' }}
                            formatter={(val: number) => [formatCurrency(val), 'Saldo Projetado']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#6366f1" 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            animationDuration={1500}
                          />
                          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                          {/* Destaque para áreas críticas se houver saldo negativo */}
                          {timelineData.some(d => d.balance < 0) && (
                              <ReferenceArea y1={-1000000} y2={0} fill="#ef4444" fillOpacity={0.05} />
                          )}
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="space-y-6">
              <div className={`p-6 rounded-[2rem] border ${cardStyle}`}>
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2 text-gray-400">
                    <ShieldCheck size={18} className="text-emerald-500"/> Governança de Saldo
                  </h4>
                  <div className="space-y-6">
                      <div>
                          <div className="flex justify-between text-xs font-bold mb-2">
                              <span className="text-gray-500">Conciliação de Extrato</span>
                              <span className="text-indigo-500">{stats.reconciliationRate.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                              <div className="h-full bg-indigo-600 transition-all duration-1000" style={{width: `${stats.reconciliationRate}%`}}></div>
                          </div>
                      </div>
                      
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Atenção Próximos 30 dias</p>
                          <p className="text-sm font-bold text-amber-700">
                             {timelineData.filter(d => d.isCritical).length > 0 
                                ? `Possível insuficiência de caixa em ${timelineData.find(d => d.isCritical)?.displayDate}.`
                                : "Saldo projetado permanece positivo em todo o ciclo."}
                          </p>
                      </div>
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