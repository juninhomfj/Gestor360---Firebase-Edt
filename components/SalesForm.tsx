
import React, { useState, useEffect } from 'react';
import { Sale, ProductType, Client, SaleStatus } from '../types';
// Fix: Added missing 'getStoredTable', 'computeCommissionValues', 'getClients' to imports from services/logic
import { getStoredTable, computeCommissionValues, getClients } from '../services/logic';
import { X, Calculator, AlertCircle, Truck, DollarSign } from 'lucide-react';
import { auth } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void>;
  onSave?: (sale: Sale) => Promise<void>;
  initialData?: Sale | null;
}

const SalesForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  onSave,
  initialData
}) => {
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [clientName, setClientName] = useState('');
  const [productType, setProductType] = useState<ProductType>(ProductType.BASICA);
  const [status, setStatus] = useState<SaleStatus>('ORÇAMENTO');
  const [quantity, setQuantity] = useState(1);
  const [valueProposed, setValueProposed] = useState(0);
  const [valueSold, setValueSold] = useState(0);
  const [margin, setMargin] = useState(0);
  const [quoteDate, setQuoteDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [billDate, setBillDate] = useState('');
  const [observations, setObservations] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionValue, setCommissionValue] = useState(0);
  const [commissionBase, setCommissionBase] = useState(0);

  useEffect(() => {
    if (isOpen) {
      getClients().then(setAvailableClients);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!initialData) return;

    setClientName(initialData.client);
    setProductType(initialData.type);
    setStatus(initialData.status || 'FATURADO');
    setQuantity(initialData.quantity);
    setValueProposed(initialData.valueProposed);
    setValueSold(initialData.valueSold || 0);
    setMargin(initialData.marginPercent || 0);
    setQuoteDate(initialData.quoteDate || '');
    setCloseDate(initialData.completionDate || '');
    setBillDate(initialData.date || '');
    setObservations(initialData.observations || '');
    setTrackingCode(initialData.trackingCode || '');
  }, [initialData]);

  useEffect(() => {
    const calc = async () => {
      const rules = await getStoredTable(productType);
      // REGRA DE CÁLCULO MANTIDA - NÃO ALTERAR
      const { commissionBase: base, commissionValue: val, rateUsed } =
        computeCommissionValues(quantity, valueProposed, margin, rules);

      setCommissionBase(base);
      setCommissionValue(val);
      setCommissionRate(rateUsed);
    };
    calc();
  }, [quantity, valueProposed, margin, productType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!clientName || valueProposed <= 0 || !billDate) {
      alert('Preencha cliente, valor proposto e data de faturamento.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const normalizedStatus: SaleStatus = status;
    const isBilled = normalizedStatus === 'FATURADO';

    const sale: Sale = {
      id: initialData?.id || crypto.randomUUID(),
      userId: uid,
      client: clientName,
      quantity,
      type: productType,
      status: normalizedStatus,
      valueProposed,
      valueSold, // Valor Total NF (Informativo)
      marginPercent: margin,
      quoteDate,
      completionDate: closeDate,
      date: billDate,
      isBilled,
      hasNF: initialData?.hasNF || false,
      observations,
      trackingCode,
      commissionBaseTotal: commissionBase,
      commissionValueTotal: commissionValue,
      commissionRateUsed: commissionRate,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      deleted: false
    };

    if (onSave) await onSave(sale);
    if (onSaved) await onSaved();
    onClose();
  };

  const inputClasses = "w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400";

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[95vh] shadow-2xl flex flex-col border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden my-auto">
        
        {/* Header - Fixo */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
              <Calculator size={22} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {initialData ? 'Editar Venda' : 'Lançar Nova Venda'}
            </h2>
          </div>
          <button onClose={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Formulário - Scrollável */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Coluna 1 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Cliente</label>
                <input
                  className={inputClasses}
                  placeholder="Nome do cliente ou empresa"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Tipo de Produto</label>
                <select
                  className={inputClasses}
                  value={productType}
                  onChange={e => setProductType(e.target.value as ProductType)}
                >
                  <option value={ProductType.BASICA}>Cesta Básica</option>
                  <option value={ProductType.NATAL}>Cesta de Natal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Cód. Rastreio / NF</label>
                <div className="relative">
                   <Truck className="absolute left-3 top-3.5 text-gray-400" size={16} />
                   <input
                    className={`${inputClasses} pl-10`}
                    placeholder="Código de rastreio ou número"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Coluna 2 */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Qtd.</label>
                  <input
                    type="number"
                    className={inputClasses}
                    placeholder="1"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Margem %</label>
                  <input
                    type="number"
                    className={inputClasses}
                    placeholder="0"
                    value={margin}
                    onChange={e => setMargin(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Valor Unitário Proposto (R$)</label>
                <input
                  type="number"
                  className={inputClasses}
                  placeholder="0,00"
                  value={valueProposed}
                  onChange={e => setValueProposed(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Valor Total Venda / NF (R$)</label>
                <div className="relative">
                   <DollarSign className="absolute left-3 top-3.5 text-gray-400" size={16} />
                   <input
                    type="number"
                    className={`${inputClasses} pl-10 border-indigo-200 dark:border-indigo-900/30`}
                    placeholder="0,00"
                    value={valueSold}
                    onChange={e => setValueSold(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Coluna 3 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Data de Faturamento</label>
                <input
                  type="date"
                  className={inputClasses}
                  value={billDate}
                  onChange={e => setBillDate(e.target.value)}
                  required
                />
              </div>
              
              {productType === ProductType.BASICA && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-3 animate-in fade-in duration-300">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                    A data de faturamento define em qual mês esta comissão será considerada nos relatórios de faturamento.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Observações</label>
             <textarea 
               className={`${inputClasses} h-24 resize-none`}
               placeholder="Detalhes adicionais do pedido..."
               value={observations}
               onChange={e => setObservations(e.target.value)}
             />
          </div>
        </div>

        {/* Footer - Fixo */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-center md:text-left">
              <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Base de Comissão</span>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionBase)}
              </p>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-800"></div>
            <div className="text-center md:text-left">
              <span className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest">Comissão Prevista</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionValue)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Gravar Venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
