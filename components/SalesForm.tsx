
import React, { useState, useEffect } from 'react';
import { Sale, ProductType, CommissionRule, SaleFormData } from '../types';
import { getStoredTable, calculateMargin, computeCommissionValues } from '../services/logic';
import { X, Save, Calculator, ShoppingBag, Gift, Tag, Info, Calendar, Truck, ClipboardList, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void>;
  onSave?: (sale: Sale) => Promise<void>;
  userId?: string;
  initialData?: Sale | null;
}

const SalesForm: React.FC<Props> = ({ isOpen, onClose, onSaved, onSave, userId, initialData }) => {
  const [client, setClient] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<ProductType>(ProductType.BASICA);
  const [valueProposed, setValueProposed] = useState(0);
  const [valueSold, setValueSold] = useState(0);
  const [date, setDate] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [boletoStatus, setBoletoStatus] = useState<'PENDING' | 'SENT' | 'PAID'>('PENDING');

  // Cálculos Automáticos
  const [margin, setMargin] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionValue, setCommissionValue] = useState(0);
  const [commissionBase, setCommissionBase] = useState(0);

  useEffect(() => {
    if (initialData) {
      setClient(initialData.client);
      setQuantity(initialData.quantity);
      setType(initialData.type);
      setValueProposed(initialData.valueProposed);
      setValueSold(initialData.valueSold);
      setDate(initialData.date || '');
      setCompletionDate(initialData.completionDate);
      setObservations(initialData.observations);
      setQuoteNumber(initialData.quoteNumber || '');
      setTrackingCode(initialData.trackingCode || '');
      setBoletoStatus(initialData.boletoStatus || 'PENDING');
    }
  }, [initialData]);

  // Efeito para recalcular margem e comissão
  useEffect(() => {
    const calc = async () => {
      const m = calculateMargin(valueSold, valueProposed);
      setMargin(m);

      const rules = await getStoredTable(type);
      const { commissionBase: base, commissionValue: val, rateUsed } = computeCommissionValues(quantity, valueProposed, m, rules);
      
      setCommissionBase(base);
      setCommissionValue(val);
      setCommissionRate(rateUsed);
    };
    calc();
  }, [valueSold, valueProposed, quantity, type]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!client || valueSold <= 0) {
      alert("Preencha o cliente e o valor de venda.");
      return;
    }

    const sale: Sale = {
      id: initialData?.id || crypto.randomUUID(),
      client,
      quantity,
      type,
      valueProposed,
      valueSold,
      date: date || undefined,
      completionDate,
      observations,
      quoteNumber,
      trackingCode,
      boletoStatus,
      marginPercent: margin,
      commissionBaseTotal: commissionBase,
      commissionValueTotal: commissionValue,
      commissionRateUsed: commissionRate,
      createdAt: initialData?.createdAt || new Date().toISOString(),
    };

    if (onSave) await onSave(sale);
    if (onSaved) await onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{initialData ? 'Editar Venda' : 'Nova Venda'}</h2>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Cálculo de Comissão e Margem</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Coluna 1: Dados do Cliente e Produto */}
            <div className="space-y-5">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Info size={14} /> Dados Primários
              </h3>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                <input 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  placeholder="Nome da empresa ou pessoa"
                  value={client} onChange={e => setClient(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Produto</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={type} onChange={e => setType(e.target.value as ProductType)}
                  >
                    <option value={ProductType.BASICA}>Cesta Básica</option>
                    <option value={ProductType.NATAL}>Cesta de Natal</option>
                    <option value={ProductType.CUSTOM}>Outro / Personalizado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Quantidade</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Valor Unit. Proposto</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={valueProposed} onChange={e => setValueProposed(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Valor Unit. Vendido</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-600"
                    value={valueSold} onChange={e => setValueSold(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                <h4 className="text-[10px] font-black text-gray-400 uppercase mb-3">Resumo de Performance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Margem Comercial</p>
                    <p className={`text-lg font-black ${margin < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{margin.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Taxa de Comissão</p>
                    <p className="text-lg font-black text-blue-500">{(commissionRate * 100).toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 2: Datas e Operacional */}
            <div className="space-y-5">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Truck size={14} /> Dados Operacionais
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    <Clock size={14} className="text-amber-500" /> Data Pedido
                  </label>
                  <input 
                    type="date"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={completionDate} onChange={e => setCompletionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500" /> Data Faturamento
                  </label>
                  <input 
                    type="date"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={date} onChange={e => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nº Orçamento</label>
                  <input 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    placeholder="Ex: 4500/2024"
                    value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Cód. Rastreio</label>
                  <input 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    placeholder="SSXXXXXXXXBR"
                    value={trackingCode} onChange={e => setTrackingCode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Status do Boleto / Envio</label>
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button onClick={() => setBoletoStatus('PENDING')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${boletoStatus === 'PENDING' ? 'bg-white dark:bg-slate-700 shadow text-amber-600' : 'text-gray-500'}`}>Pendente</button>
                  <button onClick={() => setBoletoStatus('SENT')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${boletoStatus === 'SENT' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-500'}`}>Enviado</button>
                  <button onClick={() => setBoletoStatus('PAID')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${boletoStatus === 'PAID' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-gray-500'}`}>Pago</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Observações Internas</label>
                <textarea 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none h-20 resize-none"
                  value={observations} onChange={e => setObservations(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-slate-950/50">
          <div className="text-center md:text-left">
            <p className="text-xs text-gray-500 font-bold uppercase">Comissão Total Estimada</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">R$ {commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={onClose} className="flex-1 md:flex-none px-8 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 transition-all">Cancelar</button>
            <button onClick={handleSave} className="flex-1 md:flex-none px-12 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Save size={20} /> Salvar Venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
