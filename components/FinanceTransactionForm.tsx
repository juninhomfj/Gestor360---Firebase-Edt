import React, { useState } from 'react';
import { FinanceAccount, Transaction } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Transaction) => Promise<void>;
  accounts: FinanceAccount[];
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

const FinanceTransactionForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  accounts,
  type,
}) => {
  if (!isOpen) return null;

  if (!accounts || accounts.length === 0) {
    return (
      <div className="modal">
        <p>Nenhuma conta cadastrada. Crie uma conta antes.</p>
        <button onClick={onClose}>Fechar</button>
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
      createdAt: new Date(),
    };

    await onSave(tx);
    onClose();
  };

  return (
    <div className="modal">
      <h2>
        {type === 'INCOME'
          ? 'Nova Receita'
          : type === 'EXPENSE'
          ? 'Nova Despesa'
          : 'Transferência'}
      </h2>

      <input
        type="number"
        placeholder="Valor"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />

      <input
        type="text"
        placeholder="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.name}
          </option>
        ))}
      </select>

      <div className="actions">
        <button onClick={onClose}>Cancelar</button>
        <button onClick={handleSave}>Salvar</button>
      </div>
    </div>
  );
};

export default FinanceTransactionForm;
