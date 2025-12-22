import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useFinance } from '@/contexts/FinanceContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SalesForm({ isOpen, onClose }: Props) {
  const { createSale, clients } = useFinance();

  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clients && clients.length > 0 && !clientId) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!description || !value) {
      toast({ title: 'Preencha todos os campos' });
      return;
    }

    if (!clientId) {
      toast({ title: 'Nenhum cliente disponível' });
      return;
    }

    setLoading(true);

    try {
      await createSale({
        description,
        value: Number(value),
        clientId,
      });

      toast({ title: 'Venda registrada com sucesso' });
      onClose();
    } catch (err) {
      toast({ title: 'Erro ao salvar venda' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <header className="flex justify-between mb-4">
          <h2 className="font-bold">Nova Venda</h2>
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
            value={clientId ?? ''}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
