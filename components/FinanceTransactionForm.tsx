
import React, { useState, useEffect } from 'react';
import { FinanceAccount, CreditCard, Transaction, TransactionCategory, PersonType } from '../types';
import { X, Save, TrendingUp, TrendingDown, ArrowLeftRight, CreditCard as CardIcon, Wallet, Tag, Calendar, Building2, User, CheckCircle, Clock } from 'lucide-react';
import { getInvoiceMonth } from '../services/logic';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void>;
  onSave?: (tx: Transaction) => Promise<void>;
  accounts: FinanceAccount[];
  cards: CreditCard[];
  categories: TransactionCategory[];
  initialType?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

const FinanceTransactionForm: React.FC<Props> = ({
  isOpen, onClose, onSaved, onSave, accounts, cards, categories, initialType = 'EXPENSE'
}) => {
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>(initialType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [cardId, setCardId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [personType, setPersonType] = useState<PersonType>('PF');
  const [isPaid, setIsPaid] = useState(true);

  useEffect(() => {
    if (isOpen) setType(initialType);
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (amount <= 0 || !description || !accountId) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (type === 'TRANSFER' && !targetAccountId) {
      alert("Selecione a conta de destino para a transferência.");
      return;
    }

    const tx: Transaction = {
      id: crypto.randomUUID(),
      type,
      description,
      amount,
      date,
      accountId,
      targetAccountId: type === 'TRANSFER' ? targetAccountId : undefined,
      cardId: type === 'EXPENSE' ? cardId : null,
      categoryId: categoryId || 'uncategorized',
      subcategory,
      personType,
      isPaid: cardId ? false : isPaid, // No cartão nunca é "pago" imediatamente (diminui limite)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (onSave) await onSave(tx);
    if (onSaved) await onSaved();
    onClose();
  };

  const filteredCategories = categories.filter(c => 
    (type === 'TRANSFER' ? true : c.type === (type as any)) &&
    (c.personType === personType || !c.personType)
  );

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
        
        {/* Header com Tabs de Tipo */}
        <div className="p-1 bg-gray-100 dark:bg-slate-950 flex shrink-0">
          <button onClick={() => setType('INCOME')} className={`flex-1 flex items-center justify-center gap-2 py-4 font-black text-sm transition-all ${type === 'INCOME' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-md rounded-xl' : 'text-gray-400'}`}>
            <TrendingUp size={18}/> RECEITA
          </button>
          <button onClick={() => setType('EXPENSE')} className={`flex-1 flex items-center justify-center gap-2 py-4 font-black text-sm transition-all ${type === 'EXPENSE' ? 'bg-white dark:bg-slate-900 text-red-600 shadow-md rounded-xl' : 'text-gray-400'}`}>
            <TrendingDown size={18}/> DESPESA
          </button>
          <button onClick={() => setType('TRANSFER')} className={`flex-1 flex items-center justify-center gap-2 py-4 font-black text-sm transition-all ${type === 'TRANSFER' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-md rounded-xl' : 'text-gray-400'}`}>
            <ArrowLeftRight size={18}/> TRANSFERÊNCIA
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Valor e Descrição */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor do Lançamento</span>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-black opacity-30">R$</span>
                  <input 
                    type="number" 
                    className={`bg-transparent text-5xl font-black text-center w-full outline-none ${type === 'INCOME' ? 'text-emerald-500' : type === 'EXPENSE' ? 'text-red-500' : 'text-blue-500'}`}
                    value={amount} onChange={e => setAmount(Number(e.target.value))}
                    autoFocus
                  />
                </div>
              </div>
              <input 
                className="w-full text-xl font-bold p-3 bg-transparent border-b-2 border-gray-100 dark:border-slate-800 text-center outline-none focus:border-indigo-500 transition-colors dark:text-white"
                placeholder="Descrição (ex: Aluguel, Venda Cesta)"
                value={description} onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Configuração da Transação */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Wallet size={12}/> Origem e Destino
              </h4>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">{type === 'TRANSFER' ? 'Conta Origem' : 'Conta de Lançamento'}</label>
                <select 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                  value={accountId} onChange={e => setAccountId(e.target.value)}
                >
                  <option value="">Selecione a conta...</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>)}
                </select>
              </div>

              {type === 'TRANSFER' && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Conta Destino</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900 dark:bg-slate-800 outline-none"
                    value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}
                  >
                    <option value="">Selecione o destino...</option>
                    {accounts.filter(a => a.id !== accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
              )}

              {type === 'EXPENSE' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-2">
                    <CardIcon size={12}/> Usar Cartão de Crédito?
                  </label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    value={cardId || ''} onChange={e => setCardId(e.target.value || null)}
                  >
                    <option value="">Lançamento em Conta (Débito/Dinheiro)</option>
                    {cards.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.name} (Vence dia {card.dueDay})
                      </option>
                    ))}
                  </select>
                  {cardId && (
                    <p className="text-[10px] text-amber-500 font-bold mt-1">
                      Atenção: Lançamentos em cartão entram como "Pendentes" até o pagamento da fatura.
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Data do Lançamento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-gray-400" size={16}/>
                  <input 
                    type="date" className="w-full p-3 pl-10 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    value={date} onChange={e => setDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Categorização e Detalhes */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Tag size={12}/> Classificação
              </h4>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Entidade</label>
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button onClick={() => setPersonType('PF')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${personType === 'PF' ? 'bg-white dark:bg-slate-700 text-purple-600' : 'text-gray-500'}`}>
                    <User size={12}/> PESSOAL
                  </button>
                  <button onClick={() => setPersonType('PJ')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${personType === 'PJ' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-gray-500'}`}>
                    <Building2 size={12}/> EMPRESA
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Categoria</label>
                <select 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                  value={categoryId} onChange={e => { setCategoryId(e.target.value); setSubcategory(''); }}
                >
                  <option value="">Selecione...</option>
                  {filteredCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>

              {selectedCategory?.subcategories && selectedCategory.subcategories.length > 0 && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Subcategoria</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                    value={subcategory} onChange={e => setSubcategory(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {selectedCategory.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {type !== 'TRANSFER' && !cardId && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    {isPaid ? <CheckCircle className="text-emerald-500" size={18}/> : <Clock className="text-amber-500" size={18}/>}
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{isPaid ? 'Já foi pago/recebido' : 'Aguardando compensação'}</span>
                  </div>
                  <input 
                    type="checkbox" className="w-6 h-6 rounded-lg text-indigo-600"
                    checked={isPaid} onChange={e => setIsPaid(e.target.checked)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex gap-3 bg-gray-50 dark:bg-slate-950/50">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-slate-700 font-bold text-gray-500 hover:bg-gray-100 transition-all">Cancelar</button>
          <button onClick={handleSave} className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'EXPENSE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            <Save size={20}/> Salvar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceTransactionForm;
