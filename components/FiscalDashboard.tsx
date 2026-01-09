
import React, { useState, useEffect } from 'react';
import { Company, FiscalPeriod, TaxEstimate, Obligation, User } from '../types';
import { getFiscalPeriods, saveFiscalPeriod, calculateTaxes, getObligations, saveObligation } from '../services/fiscalService';
import { formatCurrency } from '../services/logic';
import { 
    Calculator, TrendingUp, Calendar, AlertCircle, Plus, 
    CheckCircle, ShieldCheck, FileText, PieChart, Info, ArrowRight, Loader2, Sparkles 
} from 'lucide-react';

interface Props {
    company: Company;
    currentUser: User;
    darkMode: boolean;
}

const FiscalDashboard: React.FC<Props> = ({ company, currentUser, darkMode }) => {
    const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
    const [obligations, setObligations] = useState<Obligation[]>([]);
    const [activePeriod, setActivePeriod] = useState<FiscalPeriod | null>(null);
    const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
    const [loading, setLoading] = useState(false);
    const [revenueInput, setRevenueInput] = useState('');

    useEffect(() => { loadData(); }, [company.id]);

    const loadData = async () => {
        setLoading(true);
        const [p, o] = await Promise.all([getFiscalPeriods(company.id), getObligations(company.id)]);
        setPeriods(p);
        setObligations(o);
        if (p.length > 0) handleSelectPeriod(p[0]);
        setLoading(false);
    };

    const handleSelectPeriod = async (period: FiscalPeriod) => {
        setActivePeriod(period);
        setRevenueInput(period.grossRevenue.toString());
        const est = await calculateTaxes(period, company.regimeTributario);
        setEstimate(est);
    };

    const handleSaveRevenue = async () => {
        const val = parseFloat(revenueInput) || 0;
        const now = new Date();
        const period: FiscalPeriod = activePeriod || {
            id: crypto.randomUUID(),
            userId: currentUser.id,
            companyId: company.id,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            grossRevenue: val,
            status: 'OPEN',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        setLoading(true);
        await saveFiscalPeriod({ ...period, grossRevenue: val, updatedAt: new Date().toISOString() });
        await loadData();
    };

    const cardClass = darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-100 shadow-sm';

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Fiscal 360</h1>
                    <p className="text-gray-500 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-500"/>
                        {company.nomeFantasia} • <span className="font-bold text-indigo-500">{company.regimeTributario.replace('_', ' ')}</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input de Faturamento */}
                <div className={`col-span-1 p-8 rounded-[2rem] border ${cardClass}`}>
                    <h3 className="text-lg font-black mb-6 flex items-center gap-2 uppercase text-[10px] tracking-widest text-gray-400">
                        <TrendingUp size={14}/> Receita Mensal
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Faturamento Bruto (Mês Atual)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">R$</span>
                                <input 
                                    type="number" 
                                    className={`w-full pl-12 pr-4 py-4 rounded-2xl border outline-none focus:ring-2 ring-indigo-500 text-2xl font-black ${darkMode ? 'bg-black/40 border-slate-700' : 'bg-gray-50'}`}
                                    value={revenueInput}
                                    onChange={e => setRevenueInput(e.target.value)}
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleSaveRevenue}
                            disabled={loading}
                            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <Calculator size={18}/>}
                            Atualizar Cálculos
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t dark:border-slate-800">
                         <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4">Histórico Recente</h4>
                         <div className="space-y-2">
                            {periods.slice(0, 3).map(p => (
                                <button key={p.id} onClick={() => handleSelectPeriod(p)} className={`w-full p-3 rounded-xl border flex justify-between items-center transition-all ${activePeriod?.id === p.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                    <span className="text-xs font-bold">{p.month}/{p.year}</span>
                                    <span className="text-xs font-black">{formatCurrency(p.grossRevenue)}</span>
                                </button>
                            ))}
                         </div>
                    </div>
                </div>

                {/* Estimativa de Impostos */}
                <div className={`col-span-1 lg:col-span-2 p-8 rounded-[2rem] border ${cardClass}`}>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg font-black flex items-center gap-2 uppercase text-[10px] tracking-widest text-gray-400">
                            <PieChart size={14}/> Provisão de Impostos
                        </h3>
                        {activePeriod && (
                            <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">{activePeriod.month}/{activePeriod.year}</span>
                        )}
                    </div>

                    {estimate ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {estimate.items.map((tax, i) => (
                                    <div key={i} className="p-6 rounded-3xl bg-gray-50 dark:bg-slate-950 border dark:border-slate-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">{tax.label}</span>
                                            <span className="text-[10px] font-black text-indigo-500">{tax.rate.toFixed(2)}%</span>
                                        </div>
                                        <p className="text-2xl font-black">{formatCurrency(tax.value)}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-8 rounded-[2rem] bg-indigo-600 text-white shadow-xl shadow-indigo-900/40 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-all">
                                    <Calculator size={80}/>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Guia Única Estimada (Líquido)</p>
                                    <p className="text-4xl font-black">{formatCurrency(estimate.total)}</p>
                                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-indigo-200">
                                        <Info size={14}/>
                                        Cálculo baseado em Tax Rules {estimate.rulesVersion}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20">
                            <Calculator size={64} className="mb-4"/>
                            <p className="font-bold">Aguardando dados de faturamento...</p>
                        </div>
                    )}
                </div>

                {/* Obrigações & Licenças */}
                <div className={`col-span-1 lg:col-span-3 p-8 rounded-[2rem] border ${cardClass}`}>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg font-black flex items-center gap-2 uppercase text-[10px] tracking-widest text-gray-400">
                            <FileText size={14}/> Obrigações & Licenças
                        </h3>
                        <button className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">
                            <Plus size={20}/>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {obligations.map(ob => (
                            <div key={ob.id} className="p-5 rounded-3xl border dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm">{ob.type}</p>
                                    <p className="text-[10px] text-gray-500 uppercase mt-1">Vence: {new Date(ob.dueDate).toLocaleDateString()}</p>
                                </div>
                                <p className="font-black text-indigo-500">{formatCurrency(ob.amount)}</p>
                            </div>
                        ))}
                        {obligations.length === 0 && (
                            <div className="col-span-full py-10 text-center text-gray-500 border-2 border-dashed dark:border-slate-800 rounded-3xl opacity-50">
                                <p className="text-sm font-bold">Nenhuma obrigação cadastrada (CORE, IPTU, Licenças).</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FiscalDashboard;
