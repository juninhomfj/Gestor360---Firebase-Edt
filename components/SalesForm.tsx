import React, { useState, useEffect } from 'react';
import { Sale, ProductType, Client, SaleStatus } from '../types';
import { getStoredTable, computeCommissionValues, getClients } from '../services/logic';
import { X, Calculator, AlertCircle } from 'lucide-react';
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
    setValueSold(initialData.valueSold);
    setMargin(initialData.marginPercent || 0);
    setQuoteDate(initialData.quoteDate || '');
    setCloseDate(initialData.completionDate || '');
    setBillDate(initialData.date || '');
    setObservations(initialData.observations || '');
  }, [initialData]);

  useEffect(() => {
    const calc = async () => {
      const rules = await getStoredTable(productType);
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
      alert('Preencha cliente, valor e data de faturamento.');
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
      valueSold,
      marginPercent: margin,
      quoteDate,
      completionDate: closeDate,
      date: billDate,
      isBilled,
      hasNF: initialData?.hasNF || false,
      observations,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Calculator size={22} />
            <h2 className="text-xl font-bold">
              {initialData ? 'Editar Venda' : 'Lançar Venda'}
            </h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <input
                className="w-full p-3 border rounded"
                placeholder="Cliente"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
              />
              <select
                className="w-full p-3 border rounded"
                value={productType}
                onChange={e => setProductType(e.target.value as ProductType)}
              >
                <option value={ProductType.BASICA}>Cesta Básica</option>
                <option value={ProductType.NATAL}>Cesta de Natal</option>
              </select>
            </div>

            <div className="space-y-4">
              <input
                type="number"
                className="w-full p-3 border rounded"
                placeholder="Quantidade"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
              />
              <input
                type="number"
                className="w-full p-3 border rounded"
                placeholder="Margem %"
                value={margin}
                onChange={e => setMargin(Number(e.target.value))}
              />
              <input
                type="number"
                className="w-full p-3 border rounded"
                placeholder="Valor Proposto"
                value={valueProposed}
                onChange={e => setValueProposed(Number(e.target.value))}
              />
            </div>

            <div className="space-y-4">
              <input
                type="date"
                className="w-full p-3 border rounded"
                value={billDate}
                onChange={e => setBillDate(e.target.value)}
                required
              />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <AlertCircle size={12} />
                Data define o mês da comissão
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex justify-between items-center">
          <div>
            <span className="text-xs">Comissão Estimada</span>
            <p className="text-2xl font-bold">
              R$ {commissionValue.toFixed(2)}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}>Cancelar</button>
            <button onClick={handleSave}>Gravar Venda</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
