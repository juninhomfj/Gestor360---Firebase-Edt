import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useFinance } from '@/contexts/FinanceContext';

interface Props {
  type: 'income' | 'expense' | 'transfer';
  isOpen: boolean;
  onClose: () => void;
}

export default function FinanceTransactionForm({ type, isOpen, onClose }: Props) {
  const { accounts, createTransaction } = useFinance();

  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accounts && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  if (!isOpen) return null;

  if (!accounts || accounts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-white p-6 rounded">
          <p>Nenhuma conta cadastrada</p>
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!description || !value || !accountId) {
      toast({ title: 'Campos obrigatórios ausentes' });
      return;
    }

    setLoading(true);

    try {
      await createTransaction({
        type,
        description,
        value: Number(value),
        accountId,
      });

      toast({ title: 'Lançamento realizado' });
      onClose();
    } catch {
      toast({ title: 'Erro ao lançar transação' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <header className="flex justify-between mb-4">
          <h2 className="font-bold">
            {type === 'income' && 'Nova Receita'}
            {type === 'expense' && 'Nova Despesa'}
            {type === 'transfer' && 'Transferência'}
          </h2>
          <button onClick={onClose}>✕</button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <input
            className="input"
            type="number"
            placeholder="Valor"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />

          <select
            className="input"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <footer className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button disabled={loading} className="btn-primary">
              Salvar
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
