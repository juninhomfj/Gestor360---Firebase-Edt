
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionCategory } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { FileText, TrendingUp, PieChart as PieIcon, Calendar, Filter, Download, Building2, User } from 'lucide-react';
import { exportReportToCSV } from '../services/logic';

interface FinanceReportsProps {
  transactions: Transaction[];
  categories: TransactionCategory[];
  darkMode?: boolean;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const FinanceReports: React.FC<FinanceReportsProps> = ({ transactions, categories, darkMode }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'DRE' | 'CATEGORIES'>('DRE');

  // --- DATA PROCESSING ---
  
  // 1. Filter transactions by Year and Status
  const yearTransactions = useMemo(() => {
      return transactions.filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === year && t.isPaid; // DRE typically uses realized
      });
  }, [transactions, year]);

  // 2. Aggregate for DRE (Monthly)
  const dreData = useMemo(() => {
      const data = Array.from({ length: 12 }, (_, i) => ({
          name: MONTHS[i],
          monthIndex: i,
          income: 0,
          expense: 0,
          result: 0,
          margin: 0
      }));

      yearTransactions.forEach(t => {
          const m = new Date(t.date).getMonth();
          if (t.type === 'INCOME') data[m].income += t.amount;
          if (t.type === 'EXPENSE') data[m].expense += t.amount;
      });

      data.forEach(d => {
          d.result = d.income - d.expense;
          d.margin = d.income > 0 ? (d.result / d.income) * 100 : 0;
      });

      return data;
  }, [yearTransactions]);

  // 3. Aggregate by Category (Expense only)
  const categoryData = useMemo(() => {
      const map = new Map<string, number>();
      let total = 0;

      yearTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
          const catName = categories.find(c => c.id === t.categoryId)?.name || 'Outros';
          const val = map.get(catName) || 0;
          map.set(catName, val + t.amount);
          total += t.amount;
      });

      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value, percent: (value / total) * 100 }))
          .sort((a, b) => b.value - a.value);
  }, [yearTransactions, categories]);

  // 4. Aggregate by Person Type (PF vs PJ)
  const entityData = useMemo(() => {
      let pfTotal = 0;
      let pjTotal = 0;
      yearTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
          if (t.personType === 'PJ') pjTotal += t.amount;
          else pfTotal += t.amount;
      });
      return [
          { name: 'Pessoal (PF)', value: pfTotal, color: '#8b5cf6' }, // Purple
          { name: 'Empresarial (PJ)', value: pjTotal, color: '#3b82f6' } // Blue
      ].filter(d => d.value > 0);
  }, [yearTransactions]);

  // 5. Totals
  const totalIncomeYear = dreData.reduce((acc, d) => acc + d.income, 0);
  const totalExpenseYear = dreData.reduce((acc, d) => acc + d.expense, 0);
  const totalResultYear = totalIncomeYear - totalExpenseYear;

  const handleExportDRE = () => {
      const csvData = dreData.map(d => ({
          Mês: d.name,
          Receitas: d.income.toFixed(2),
          Despesas: d.expense.toFixed(2),
          Resultado: d.result.toFixed(2),
          Margem: d.margin.toFixed(2) + '%'
      }));
      exportReportToCSV(csvData, `dre_gerencial_${year}`);
  };

  const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-800';
  const textSub = darkMode ? 'text-slate-400' : 'text-gray-500';

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Relatórios Financeiros</h1>
                <p className={textSub}>Análise detalhada de performance.</p>
            </div>
            
            <div className="flex gap-2 bg-gray-100 dark:bg-slate-900 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('DRE')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'DRE' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                >
                    <FileText size={16}/> DRE Anual
                </button>
                <button 
                    onClick={() => setViewMode('CATEGORIES')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'CATEGORIES' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}
                >
                    <PieIcon size={16}/> Categorias
                </button>
            </div>
        </div>

        {/* YEAR FILTER & KPI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border flex flex-col justify-center ${bgClass}`}>
                <label className={`text-xs font-bold uppercase mb-1 ${textSub}`}>Ano de Referência</label>
                <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-3 text-gray-400"/>
                    <select 
                        value={year} 
                        onChange={e => setYear(Number(e.target.value))}
                        className={`w-full pl-9 py-2 rounded-lg border appearance-none outline-none font-bold ${darkMode ? 'bg-slate-900 border-slate-600' : 'bg-gray-50 border-gray-300'}`}
                    >
                        {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className={`text-xs font-bold uppercase mb-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Receita Acumulada ({year})</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>{formatCurrency(totalIncomeYear)}</p>
            </div>

            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-xs font-bold uppercase mb-1 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>Despesa Acumulada ({year})</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-red-300' : 'text-red-600'}`}>{formatCurrency(totalExpenseYear)}</p>
            </div>

            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'}`}>
                <p className={`text-xs font-bold uppercase mb-1 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Resultado Líquido</p>
                <p className={`text-2xl font-bold ${totalResultYear >= 0 ? (darkMode ? 'text-blue-300' : 'text-blue-600') : 'text-red-500'}`}>{formatCurrency(totalResultYear)}</p>
            </div>
        </div>

        {viewMode === 'DRE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* DRE CHART */}
                <div className={`p-6 rounded-xl border shadow-sm ${bgClass}`}>
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-500" /> Fluxo de Caixa (Receitas vs Despesas)
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dreData} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#e2e8f0'} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke={darkMode ? '#94a3b8' : '#64748b'} />
                                <YAxis fontSize={12} tickFormatter={(val) => `R$${val/1000}k`} tickLine={false} axisLine={false} stroke={darkMode ? '#94a3b8' : '#64748b'} />
                                <Tooltip 
                                    cursor={{fill: darkMode ? '#ffffff10' : '#f8fafc'}}
                                    contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend wrapperStyle={{paddingTop: '20px'}} />
                                <Bar isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* DRE TABLE */}
                <div className={`rounded-xl border overflow-hidden ${bgClass}`}>
                    <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                        <h3 className="font-bold text-lg">DRE Gerencial Detalhado</h3>
                        <button onClick={handleExportDRE} className="text-sm flex items-center gap-2 text-blue-500 hover:text-blue-600 font-bold">
                            <Download size={16}/> Exportar CSV
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className={darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}>
                                <tr>
                                    <th className="px-4 py-3 text-left">Mês</th>
                                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">(+) Receitas</th>
                                    <th className="px-4 py-3 text-right text-red-600 dark:text-red-400">(-) Despesas</th>
                                    <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">(=) Resultado</th>
                                    <th className="px-4 py-3 text-center">Margem %</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                                {dreData.map((row) => (
                                    <tr key={row.name} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${row.result < 0 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                        <td className="px-4 py-3 font-bold">{row.name}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(row.income)}</td>
                                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-mono">{formatCurrency(row.expense)}</td>
                                        <td className={`px-4 py-3 text-right font-bold font-mono ${row.result >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatCurrency(row.result)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                            {row.margin.toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className={`font-bold ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                                <tr>
                                    <td className="px-4 py-3 text-left">TOTAL</td>
                                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncomeYear)}</td>
                                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(totalExpenseYear)}</td>
                                    <td className={`px-4 py-3 text-right ${totalResultYear >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(totalResultYear)}</td>
                                    <td className="px-4 py-3 text-center">-</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {viewMode === 'CATEGORIES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* CHART 1: CATEGORIES PIE */}
                <div className={`p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center ${bgClass}`}>
                    <h3 className="text-lg font-bold mb-4 w-full text-left">Distribuição por Categoria</h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    isAnimationActive={true} 
                                    animationDuration={1500} 
                                    animationEasing="ease-out"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={darkMode ? '#1e293b' : '#fff'} strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase">Total</p>
                                <p className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(totalExpenseYear)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHART 2: ENTITY DISTRIBUTION (PF vs PJ) */}
                <div className={`p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center ${bgClass}`}>
                    <h3 className="text-lg font-bold mb-4 w-full text-left flex items-center gap-2">
                        <Building2 size={18} className="text-blue-500"/>
                        PF vs PJ
                    </h3>
                    {entityData.length > 0 ? (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={entityData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        isAnimationActive={true} 
                                        animationDuration={1500} 
                                        animationEasing="ease-out"
                                    >
                                        {entityData.map((entry, index) => (
                                            <Cell key={`cell-ent-${index}`} fill={entry.color} stroke={darkMode ? '#1e293b' : '#fff'} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: number) => formatCurrency(value)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#fff' : '#000' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                            Sem dados suficientes para comparação.
                        </div>
                    )}
                </div>

                {/* LIST */}
                <div className={`p-6 rounded-xl border shadow-sm md:col-span-2 ${bgClass}`}>
                    <h3 className="text-lg font-bold mb-4">Top Categorias</h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {categoryData.map((cat, idx) => (
                            <div key={cat.name} className="flex items-center gap-3">
                                <div 
                                    className="w-3 h-3 rounded-full shrink-0" 
                                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                ></div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-sm font-medium mb-1">
                                        <span>{cat.name}</span>
                                        <span>{formatCurrency(cat.value)}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${cat.percent}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-right mt-0.5 text-gray-400">{cat.percent.toFixed(1)}%</p>
                                </div>
                            </div>
                        ))}
                        {categoryData.length === 0 && (
                            <div className="text-center text-gray-500 py-12">
                                <Filter size={32} className="mx-auto mb-2 opacity-20"/>
                                <p>Nenhuma despesa registrada neste ano.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default FinanceReports;
