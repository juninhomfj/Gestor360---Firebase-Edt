
import React, { useState, useEffect } from 'react';
import { Sale, ProductType, Client, SaleStatus } from '../types';
import { getStoredTable, computeCommissionValues, getClients } from '../services/logic';
import { X, Save, Calculator, Tag, Calendar, User as UserIcon } from 'lucide-react';
import { auth } from '../services/firebase';

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
  
  // Valores (Campos Manuais Independentes)
  const [quantity, setQuantity] = useState(1);
  const [valueProposed, setValueProposed] = useState(0);
  const [valueSold, setValueSold] = useState(0);
  const [margin, setMargin] = useState(0); // Informado manualmente pelo usuário
  
  // Datas e Rastreio
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [billDate, setBillDate] = useState('');
  const [observations, setObservations] = useState('');

  // Flags e Status
  const [isBilled, setIsBilled] = useState(false);
  const [boletoStatus, setBoletoStatus] = useState<'PENDING' | 'SENT' | 'PAID'>('PENDING');

  // Resultados de Cálculo (Apenas Visualização)
  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionValue, setCommissionValue] = useState(0);
  const [commissionBase, setCommissionBase] = useState(0);

  useEffect(() => {
    const fetchClients = async () => {
        const data = await getClients();
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
      setMargin(initialData.marginPercent || 0);
      setQuoteDate(initialData.quoteDate || '');
      setCloseDate(initialData.completionDate || '');
      setBillDate(initialData.date || '');
      setIsBilled(initialData.isBilled || !!initialData.date);
      setBoletoStatus(initialData.boletoStatus || 'PENDING');
      setObservations(initialData.observations);
    }
  }, [initialData]);

  // Motor de Cálculo de Comissão: Quantidade * Valor Proposto * Taxa(Margem)
  useEffect(() => {
    const calc = async () => {
      const rules = await getStoredTable(productType);
      // A base de comissão é SEMPRE (Quantidade x Valor Proposto) conforme sua regra
      const { commissionBase: base, commissionValue: val, rateUsed } = computeCommissionValues(quantity, valueProposed, margin, rules);
      
      setCommissionBase(base);
      setCommissionValue(val);
      setCommissionRate(rateUsed);
    };
    calc();
  }, [quantity, valueProposed, margin, productType]);

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
    if ((!clientName && !selectedClientId) || valueProposed <= 0) {
      alert("Preencha o cliente e o valor proposto.");
      return;
    }

    // Fix: Included missing required property for Sale
    const sale: Sale = {
      id: initialData?.id || crypto.randomUUID(),
      client: clientName,
      clientId: selectedClientId || undefined,
      userId: userId || auth.currentUser?.uid || '',
      quantity,
      type: productType,
      status,
      valueProposed,
      valueSold,
      marginPercent: margin,
      quoteDate,
      completionDate: closeDate,
      date: isBilled ? billDate : undefined,
      isBilled,
      boletoStatus,
      observations,
      commissionBaseTotal: commissionBase,
      commissionValueTotal: commissionValue,
      commissionRateUsed: commissionRate,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      hasNF: initialData?.hasNF || false, // preservando rastro
      deleted: initialData?.deleted || false
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
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{initialData ? 'Editar Venda' : 'Lançar Venda'}</h2>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Base p/ Comissionamento: Qtd x Vlr Proposto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* COLUNA 1: IDENTIFICAÇÃO */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={14} /> Identificação
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
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                      placeholder="Ex: Empresa Exemplo LTDA"
                      value={clientName} onChange={e => setClientName(e.target.value)}
                    />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Produto</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none font-bold"
                    value={productType} onChange={e => setProductType(e.target.value as ProductType)}
                  >
                    <option value={ProductType.BASICA}>Cesta Básica</option>
                    <option value={ProductType.NATAL}>Cesta de Natal</option>
                    <option value={ProductType.CUSTOM}>Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    value={status} onChange={e => setStatus(e.target.value as SaleStatus)}
                  >
                    <option value="ORÇAMENTO">Orçamento</option>
                    <option value="PROPOSTA">Proposta</option>
                    <option value="FATURADO">Faturado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* COLUNA 2: VALORES (DECOUPLED) */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Tag size={14} /> Valores e Comissão
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantidade de Cestas</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none font-mono text-lg"
                    value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vlr. Unitário Proposto (Base)</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none font-mono text-indigo-600 font-bold"
                    value={valueProposed} onChange={e => setValueProposed(Number(e.target.value))}
                  />
                </div>

                <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                    <label className="block text-xs font-black text-indigo-500 dark:text-indigo-300 uppercase mb-2">Margem Bruta Informada (%)</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number"
                            step="0.01"
                            className="w-full p-3 rounded-xl border-2 border-indigo-300 outline-none font-black text-xl text-indigo-700 dark:bg-slate-800"
                            value={margin}
                            onChange={e => setMargin(Number(e.target.value))}
                        />
                        <span className="text-2xl font-black text-gray-400">%</span>
                    </div>
                    <p className="text-[9px] text-indigo-400 mt-2 font-bold uppercase">Define a taxa de comissão na tabela</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vlr. Unitário Final (Venda)</label>
                  <input 
                    type="number"
                    className="w-full p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 dark:bg-slate-800 outline-none font-mono font-bold text-emerald-600"
                    value={valueSold} onChange={e => setValueSold(Number(e.target.value))}
                  />
                  <p className="text-[9px] text-gray-400 mt-1 uppercase">Inclui fretes/acréscimos (não interfere na margem)</p>
                </div>
              </div>
            </div>

            {/* COLUNA 3: CICLO E DATAS */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} /> Ciclo e Rastreio
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cotação</label>
                        <input type="date" className="w-full p-2.5 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Pedido</label>
                        <input type="date" className="w-full p-2.5 rounded-lg border dark:bg-slate-800 dark:border-slate-700 outline-none" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-amber-800 dark:text-amber-400">Faturado?</label>
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-amber-300 text-amber-600"
                            checked={isBilled} onChange={e => setIsBilled(e.target.checked)} 
                        />
                    </div>
                    {isBilled && (
                        <input type="date" className="w-full p-2 rounded-lg border border-amber-200 dark:border-amber-800 dark:bg-slate-800 outline-none text-sm font-bold" value={billDate} onChange={e => setBillDate(e.target.value)} />
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações Internas</label>
                    <textarea 
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none h-24 resize-none text-sm"
                      value={observations} onChange={e => setObservations(e.target.value)}
                    />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER: RESUMO COMISSÃO */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-slate-950/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Líquido de Comissão Estimado</span>
            <div className="flex items-center gap-3">
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">R$ {commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <div className="flex flex-col">
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Taxa: {(commissionRate * 100).toFixed(2)}%</span>
                    <span className="text-[9px] text-gray-400 mt-0.5">Base: R$ {commissionBase.toFixed(2)}</span>
                </div>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={onClose} className="flex-1 md:flex-none px-8 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 transition-all">Cancelar</button>
            <button onClick={handleSave} className="flex-1 md:flex-none px-12 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Save size={20} /> Confirmar Lançamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
