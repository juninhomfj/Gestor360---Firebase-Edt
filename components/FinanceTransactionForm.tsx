
import React, { useState } from 'react';
import { FinanceAccount, Transaction } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Added onSaved as it's used in App.tsx
  onSaved?: () => Promise<void>;
  onSave?: (tx: Transaction) => Promise<void>;
  accounts?: FinanceAccount[];
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

const FinanceTransactionForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  onSave,
  accounts = [],
  type = 'EXPENSE',
}) => {
  if (!isOpen) return null;

  if (!accounts || accounts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white p-6 rounded-lg max-w-sm w-full">
          <p className="text-gray-800 mb-4">Nenhuma conta cadastrada. Crie uma conta antes.</p>
          <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 rounded">Fechar</button>
        </div>
      </div>
    );
  }

  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0].id);

  const handleSave = async () => {
    if (amount <= 0) return;

    const tx: Transaction = {
      id: crypto.randomUUID(),
      type,
      amount,
      description,
      accountId,
      // Fixed: Transaction type requires date string
      date: new Date().toISOString().split('T')[0],
      categoryId: 'uncategorized',
      isPaid: true,
      createdAt: new Date(),
    };

    if (onSave) {
        await onSave(tx);
    }
    
    if (onSaved) {
        await onSaved();
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">
          {type === 'INCOME'
            ? 'Nova Receita'
            : type === 'EXPENSE'
            ? 'Nova Despesa'
            : 'Transferência'}
        </h2>

        <div className="space-y-3">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Valor</label>
                <input
                    type="number"
                    placeholder="0.00"
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                />
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                <input
                    type="text"
                    placeholder="Descrição do lançamento"
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Conta</label>
                <select 
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={accountId} 
                    onChange={(e) => setAccountId(e.target.value)}
                >
                    {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                            {acc.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>

        <div className="flex gap-2 pt-2 border-t mt-4">
          <button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition-colors">Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default FinanceTransactionForm;
