
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Client, Sale } from '../types';
import { getSalesByClient, formatCurrency } from '../services/logic';
import { X, ShoppingBag, History, TrendingUp, DollarSign, Calendar, Loader2, User, Award, BarChart3, Target, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ClientDetailsModalProps {
    client: Client;
    isOpen: boolean;
    onClose: () => void;
    darkMode: boolean;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ client, isOpen, onClose, darkMode }) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [client.id, isOpen]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await getSalesByClient(client.name, client.id);
            setSales(data);
        } catch (e) {
            console.error("Erro ao carregar histórico", e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const totalLTV = sales.reduce((acc, s) => acc + s.valueSold, 0);
    const totalComm = sales.reduce((acc, s) => acc + s.commissionValueTotal, 0);
    const avgMargin = sales.length > 0 ? (sales.reduce((acc, s) => acc + s.marginPercent, 0) / sales.length) : 0;

    const marginData = [...sales].reverse().map((s, idx) => ({
        name: `P${idx + 1}`,
        margin: s.marginPercent,
        fullDate: new Date(s.date || s.completionDate || '').toLocaleDateString()
    }));

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className={`w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'} flex flex-col max-h-[90vh]`}>
                
                {/* Header Dossiê */}
                <div className="p-8 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-900/30">
                            <User size={40} />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{client.name}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Dossiê de Performance Comercial</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors absolute top-6 right-6 md:static">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Body Inteligência */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    
                    {/* KPIs de LTV */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <KPICard label="LTV Total" value={formatCurrency(totalLTV)} icon={<TrendingUp size={20}/>} color="blue" />
                        <KPICard label="Comissões" value={formatCurrency(totalComm)} icon={<Award size={20}/>} color="emerald" />
                        <KPICard label="Pedidos" value={sales.length.toString()} icon={<ShoppingBag size={20}/>} color="purple" />
                        <KPICard label="Margem Média" value={`${avgMargin.toFixed(1)}%`} icon={<Target size={20}/>} color="amber" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Monitor de Margem (Chart) */}
                        <div className="lg:col-span-2 space-y-4">
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <BarChart3 size={16}/> Comportamento de Margem
                            </h4>
                            <div className="h-64 w-full p-4 rounded-3xl bg-gray-50 dark:bg-slate-950 border dark:border-slate-800">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={marginData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                            formatter={(val: number) => [`${val}%`, 'Margem']}
                                        />
                                        <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Min', fill: '#ef4444', fontSize: 10 }} />
                                        <Bar dataKey="margin" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Notas do Cliente */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={16}/> Notas Operacionais
                            </h4>
                            <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900 min-h-[150px]">
                                <p className="text-sm text-amber-900 dark:text-amber-200 italic leading-relaxed">
                                    {client.notes || "Nenhuma observação estratégica registrada para este parceiro."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Timeline de Pedidos */}
                    <div className="space-y-6">
                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <History size={16}/> Últimas Transações
                        </h4>

                        {loading ? (
                            <div className="py-10 text-center flex flex-col items-center gap-4">
                                <Loader2 className="animate-spin text-indigo-500" size={40}/>
                            </div>
                        ) : sales.length === 0 ? (
                            <div className="py-10 text-center opacity-30 italic">Nenhum pedido.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {sales.slice(0, 10).map(sale => (
                                    <div key={sale.id} className="p-5 rounded-2xl border dark:border-slate-800 bg-white dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                <Calendar size={18}/>
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">Pedido #{sale.id.substring(0,8)}</p>
                                                <p className="text-xs text-slate-500">{new Date(sale.date || sale.completionDate || '').toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-8 w-full md:w-auto text-right">
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase">Venda</p>
                                                <p className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(sale.valueSold)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-amber-500 uppercase">Margem</p>
                                                <p className="font-bold text-amber-600">{sale.marginPercent.toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-500 uppercase">Comissão</p>
                                                <p className="font-black text-emerald-600">{formatCurrency(sale.commissionValueTotal)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest border border-white/10">Fechar Dossiê</button>
                </div>

            </div>
        </div>,
        document.body
    );
};

const KPICard = ({ label, value, icon, color }: any) => (
    <div className={`p-6 rounded-3xl border flex items-center gap-5 transition-all hover:translate-y-[-2px] ${color === 'blue' ? 'bg-blue-500/5 border-blue-500/20' : color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20' : color === 'purple' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className={`p-3 rounded-2xl ${color === 'blue' ? 'text-blue-500 bg-blue-500/10' : color === 'emerald' ? 'text-emerald-500 bg-emerald-500/10' : color === 'purple' ? 'text-purple-500 bg-purple-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
            {icon}
        </div>
        <div className="overflow-hidden">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 truncate">{label}</p>
            <p className="text-xl font-black text-gray-900 dark:text-white truncate">{value}</p>
        </div>
    </div>
);

export default ClientDetailsModal;
