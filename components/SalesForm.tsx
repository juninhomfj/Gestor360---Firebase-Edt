
import React, { useState } from 'react';
import { Sale, ProductType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Added onSaved as it's used in App.tsx
  onSaved?: () => Promise<void>;
  onSave?: (sale: Sale) => Promise<void>;
  userId?: string;
}

const SalesForm: React.FC<Props> = ({ isOpen, onClose, onSaved, onSave, userId }) => {
  if (!isOpen) return null;

  const [client, setClient] = useState('');
  const [value, setValue] = useState<number>(0);

  const handleSave = async () => {
    if (!client || value <= 0) return;

    // Fixed: client property name instead of clientName to match Sale type
    const sale: any = {
      id: crypto.randomUUID(),
      client,
      valueSold: value,
      valueProposed: value,
      quantity: 1,
      type: ProductType.BASICA,
      userId,
      date: new Date().toISOString().split('T')[0],
      completionDate: new Date().toISOString().split('T')[0],
      observations: '',
      marginPercent: 0,
      commissionBaseTotal: value,
      commissionValueTotal: value * 0.05, // Mock default 5%
      commissionRateUsed: 0.05,
      createdAt: new Date().toISOString(),
    };

    if (onSave) {
        await onSave(sale);
    }
    
    if (onSaved) {
        await onSaved();
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Nova Venda</h2>

        <div className="space-y-3">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Cliente</label>
                <input
                    type="text"
                    placeholder="Nome do cliente"
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-emerald-500"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                />
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Valor da Venda</label>
                <input
                    type="number"
                    placeholder="0.00"
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-emerald-500"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                />
            </div>
        </div>

        <div className="flex gap-2 pt-2 border-t mt-4">
          <button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700 transition-colors">Salvar Venda</button>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
