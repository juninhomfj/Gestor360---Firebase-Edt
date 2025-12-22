
import React, { useState, useEffect } from 'react';
import { Sale, ProductType, Client, SaleStatus } from '../types';
import { getStoredTable, calculateMargin, computeCommissionValues, getClients } from '../services/logic';
import { X, Save, Calculator, ShoppingBag, Gift, Tag, Info, Calendar, Truck, ClipboardList, Clock, User as UserIcon, FileText, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void>;
  onSave?: (sale: Sale) => Promise<void>;
  userId?: string;
  initialData?: Sale | null;
}

const SalesForm: React.FC<Props> = ({ isOpen, onClose, onSaved, onSave, userId, initialData }) => {
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  
  // Identificação
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [productType, setProductType] = useState<ProductType>(ProductType.BASICA);
  const [status, setStatus] = useState<SaleStatus>('ORÇAMENTO');
  
  // Valores
  const [quantity, setQuantity] = useState(1);
  const [valueProposed, setValueProposed] = useState(0);
  const [valueSold, setValueSold] = useState(0);
  
  // Datas e Rastreio
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [billDate, setBillDate] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [nfNumber, setNfNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  
  // Flags
  const [hasNF, setHasNF] = useState(false);
  const [isBilled, setIsBilled] = useState(false);
  const [boletoStatus, setBoletoStatus] = useState<'PENDING' | 'SENT' | 'PAID'>('PENDING');
  
  const [observations, setObservations] = useState('');

  // Cálculos
  const [margin, setMargin] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionValue, setCommissionValue] = useState(0);
  const [commissionBase, setCommissionBase] = useState(0);

  useEffect(() => {
    const fetchClients = async () => {
        const data = await getClients();
        // Regra: Não exibir clientes INATIVOS ou IR_RODIZIO no seletor
        setAvailableClients(data.filter(c => c.isActive && c.status !== 'INATIVO' && c.status !== 'IR_RODIZIO'));
    };
    if (isOpen) fetchClients();
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setSelectedClientId(initialData.clientId || '');
      setClientName(initialData.client);
      setProductType(initialData.type);
      setStatus(initialData.status || 'FATURADO');
      setQuantity(initialData.quantity);
      setValueProposed(initialData.valueProposed);
      setValueSold(initialData.valueSold);
      setQuoteDate(initialData.quoteDate || '');
      setCloseDate(initialData.completionDate || '');
      setBillDate(initialData.date || '');
      setQuoteNumber(initialData.quoteNumber || '');
      setNfNumber(initialData.nfNumber || '');
      setTrackingCode(initialData.trackingCode || '');
      setHasNF(initialData.hasNF || false);
      setIsBilled(initialData.isBilled || !!initialData.date);
      setBoletoStatus(initialData.boletoStatus || 'PENDING');
      setObservations(initialData.observations);
    }
  }, [initialData]);

  useEffect(() => {
    const calc = async () => {
      const m = calculateMargin(valueSold, valueProposed);
      setMargin(m);
      const rules = await getStoredTable(productType);
      const { commissionBase: base, commissionValue: val, rateUsed } = computeCommissionValues(quantity, valueProposed, m, rules);
      setCommissionBase(base);
      setCommissionValue(val);
      setCommissionRate(rateUsed);
    };
    calc();
  }, [valueSold, valueProposed, quantity, productType]);

  if (!isOpen) return null;

  const handleClientSelect = (id: string) => {
    const client = availableClients.find(c => c.id === id);
    if (client) {
        setSelectedClientId(id);
        setClientName(client.companyName);
    } else {
        setSelectedClientId('');
    }
  };

  const handleSave = async () => {
    if ((!clientName && !selectedClientId) || valueSold <= 0) {
      alert("Preencha o cliente e o valor de venda.");
      return;
    }

    const sale: Sale = {
      id: initialData?.id || crypto.randomUUID(),
      client: clientName,
      clientId: selectedClientId || undefined,
      quantity,
      type: productType,
      status,
      valueProposed,
      valueSold,
      quoteDate,
      completionDate: closeDate,
      date: isBilled ? billDate : undefined,
      quoteNumber,
      nfNumber,
      trackingCode,
      hasNF,
      isBilled,
      boletoStatus,
      observations,
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
        
        {/* HEADER */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{initialData ? 'Editar Registro de Venda' : 'Novo Registro de Venda'}</h2>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Motor de Cálculo Comercial & Comissões</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* COLUNA 1: IDENTIFICAÇÃO E STATUS */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={14} /> Identificação do Negócio
              </h3>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente da Carteira</label>
                <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={selectedClientId}
                    onChange={e => handleClientSelect(e.target.value)}
                >
                    <option value="">-- Venda Avulsa / Novo Cliente --</option>
                    {availableClients.map(c => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                </select>
              </div>

              {!selectedClientId && (
                <div className="animate-in fade-in">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Cliente (Lançamento Livre)</label>
                    <input 
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: Empresa de Teste LTDA"
                      value={clientName} onChange={e => setClientName(e.target.value)}
                    />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Produto</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none font-bold"
                    value={productType} onChange={e => setProductType(e.target.value as ProductType)}
                  >
                    <option value={ProductType.BASICA}>Cesta Básica</option>
                    <option value={ProductType.NATAL}>Cesta de Natal</option>
                    <option value={ProductType.CUSTOM}>Outros (Sem Comissão Fixa)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status Atual</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    value={status} onChange={e => setStatus(e.target.value as SaleStatus)}
                  >
                    <option value="ORÇAMENTO">Orçamento</option>
                    <option value="PROPOSTA">Proposta Enviada</option>
                    <option value="FATURADO">Faturado / Concluído</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-3">Informações de NF</h4>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Possui Nota Fiscal?</span>
                    <input 
                        type="checkbox" 
                        className="w-6 h-6 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                        checked={hasNF} onChange={e => setHasNF(e.target.checked)} 
                    />
                </div>
                {hasNF && (
                    <input 
                        className="w-full p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 dark:bg-slate-800 outline-none"
                        placeholder="Nº da Nota Fiscal"
                        value={nfNumber} onChange={e => setNfNumber(e.target.value)}
                    />
                )}
              </div>
            </div>

            {/* COLUNA 2: VALORES E COMERCIAL */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Tag size={14} /> Engenharia de Preço
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantidade de Cestas</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-lg"
                    value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vlr. Unit. Proposto</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none font-mono"
                        value={valueProposed} onChange={e => setValueProposed(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vlr. Unit. Fechado</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 dark:bg-slate-800 outline-none font-mono font-bold text-emerald-600"
                        value={valueSold} onChange={e => setValueSold(Number(e.target.value))}
                      />
                    </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                    <p className="text-xs font-black text-gray-400 uppercase">Resumo Financeiro</p>
                    <div className={`px-2 py-1 rounded text-[10px] font-black ${margin >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        MARGEM: {margin.toFixed(2)}%
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Base p/ Comissão</span>
                        <span className="font-bold font-mono">R$ {commissionBase.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Taxa Aplicada</span>
                        <span className="font-bold text-blue-500 font-mono">{(commissionRate * 100).toFixed(2)}%</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-sm font-black text-gray-800 dark:text-white">Líquido de Comissão</span>
                        <span className="text-xl font-black text-emerald-500 font-mono">R$ {commissionValue.toFixed(2)}</span>
                    </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações Internas</label>
                <textarea 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none h-24 resize-none text-sm"
                  placeholder="Detalhes sobre a entrega, faturamento especial, etc."
                  value={observations} onChange={e => setObservations(e.target.value)}
                />
              </div>
            </div>

            {/* COLUNA 3: DATAS E RASTREIO */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} /> Ciclo de Vida & Rastreio
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cotação</label>
                        <input type="date" className="w-full p-2.5 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Fechamento</label>
                        <input type="date" className="w-full p-2.5 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-amber-800 dark:text-amber-400">Já Faturou?</label>
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                            checked={isBilled} onChange={e => setIsBilled(e.target.checked)} 
                        />
                    </div>
                    {isBilled && (
                        <div className="animate-in slide-in-from-top-1">
                            <label className="block text-[10px] font-black text-amber-600 uppercase mb-1">Data de Faturamento</label>
                            <input type="date" className="w-full p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 dark:bg-slate-800 outline-none font-bold" value={billDate} onChange={e => setBillDate(e.target.value)} />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nº Orçamento / PV</label>
                    <input 
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                        placeholder="Ex: 4500/2024"
                        value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código de Rastreio (Logística)</label>
                    <div className="relative">
                        <Truck size={18} className="absolute left-3 top-3.5 text-gray-400"/>
                        <input 
                            className="w-full pl-10 p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                            placeholder="SSXXXXXXXXBR"
                            value={trackingCode} onChange={e => setTrackingCode(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Status do Boleto</label>
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setBoletoStatus('PENDING')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${boletoStatus === 'PENDING' ? 'bg-white dark:bg-slate-700 shadow text-amber-600' : 'text-gray-400'}`}>Pendente</button>
                        <button onClick={() => setBoletoStatus('SENT')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${boletoStatus === 'SENT' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-400'}`}>Enviado</button>
                        <button onClick={() => setBoletoStatus('PAID')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${boletoStatus === 'PAID' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-gray-400'}`}>Pago</button>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-4">
              <div className="text-center md:text-left">
                <p className="text-[10px] text-gray-500 font-black uppercase">Comissão Final Estimada</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">R$ {commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={onClose} className="flex-1 md:flex-none px-8 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 transition-all">Descartar</button>
            <button onClick={handleSave} className="flex-1 md:flex-none px-12 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Save size={20} /> Efetivar Lançamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
