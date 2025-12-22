import React, { useState } from 'react';
import { Sale } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sale: Sale) => Promise<void>;
  userId: string;
}

const SalesForm: React.FC<Props> = ({ isOpen, onClose, onSave, userId }) => {
  if (!isOpen) return null;

  const [clientName, setClientName] = useState('');
  const [value, setValue] = useState<number>(0);

  const handleSave = async () => {
    if (!clientName || value <= 0) return;

    const sale: Sale = {
      id: crypto.randomUUID(),
      clientName,
      value,
      userId,
      createdAt: new Date(),
    };

    await onSave(sale);
    onClose();
  };

  return (
    <div className="modal">
      <h2>Nova Venda</h2>

      <input
        type="text"
        placeholder="Cliente"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
      />

      <input
        type="number"
        placeholder="Valor"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />

      <div className="actions">
        <button onClick={onClose}>Cancelar</button>
        <button onClick={handleSave}>Salvar Venda</button>
      </div>
    </div>
  );
};

export default SalesForm;
