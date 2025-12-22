
import React, { useState, useEffect } from 'react';
import { FinanceAccount, CreditCard, Transaction, TransactionCategory, PersonType } from '../types';
import { X, Save, TrendingUp, TrendingDown, ArrowLeftRight, CreditCard as CardIcon, Wallet, Tag, Calendar, Building2, User, CheckCircle, Clock, Hash, AlignLeft } from 'lucide-react';

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
  
  // Dados Gerais
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);
  
  // Identificação e Classificação
  const [accountId, setAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState(''); // Para transferências
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [personType, setPersonType] = useState<PersonType>('PF');
  
  // Adicionais
  const [cardId, setCardId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [installments, setInstallments] = useState(1);
  const [costCenter, setCostCenter] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (isOpen) {
        setType(initialType);
        // Default account
        if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
    }
  }, [isOpen, initialType, accounts]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // Validações Obrigatórias Inegociáveis
    if (amount <= 0) { alert("Informe um valor maior que zero."); return; }
    if (!description) { alert("Informe a descrição."); return; }
    if (!accountId) { alert("Selecione a conta de movimentação."); return; }
    
    if (type !== 'TRANSFER' && !categoryId) { alert("A categoria é obrigatória."); return; }
    
    if (type === 'TRANSFER') {
        if (!targetAccountId) { alert("Selecione a conta de destino para a transferência."); return; }
        if (accountId === targetAccountId) { alert("As contas de origem e destino devem ser diferentes."); return; }
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
      categoryId: type === 'TRANSFER' ? 'TRANSFER' : (categoryId || 'uncategorized'),
      subcategory,
      personType,
      isPaid: cardId ? false : isPaid,
      paymentMethod: type === 'TRANSFER' ? 'TRANSFER' : paymentMethod,
      installments: cardId ? installments : 1,
      costCenter,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (onSave) await onSave(tx);
    if (onSaved) await onSaved();
    onClose();
  };

  const filteredCategories = categories.filter(c => 
    (type === 'TRANSFER' ? false : c.type === (type as any)) &&
    (c.personType === personType || !c.personType)
  );

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
        
        {/* HEADER MODES */}
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

        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            
            {/* COLUNA ESQUERDA: CORE DATA */}
            <div className="space-y-6">
                <div className="flex flex-col items-center mb-8">
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

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                    <input 
                        className="w-full text-xl font-bold p-3 bg-transparent border-b-2 border-gray-100 dark:border-slate-800 text-left outline-none focus:border-indigo-500 transition-colors dark:text-white"
                        placeholder="Ex: Recebimento Comissões Setembro"
                        value={description} onChange={e => setDescription(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{type === 'TRANSFER' ? 'Conta de Origem' : 'Conta Financeira'}</label>
                        <select 
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={accountId} onChange={e => setAccountId(e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>)}
                        </select>
                    </div>

                    {type === 'TRANSFER' ? (
                        <div className="animate-in slide-in-from-right-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conta de Destino</label>
                            <select 
                                className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {accounts.filter(a => a.id !== accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria Principal</label>
                            <select 
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={categoryId} onChange={e => { setCategoryId(e.target.value); setSubcategory(''); }}
                            >
                                <option value="">Selecione...</option>
                                {filteredCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {selectedCategory?.subcategories && selectedCategory.subcategories.length > 0 && (
                    <div className="animate-in fade-in">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subcategoria</label>
                        <select 
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                            value={subcategory} onChange={e => setSubcategory(e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            {selectedCategory.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data da Movimentação</label>
                        <input 
                            type="date" className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                            value={date} onChange={e => setDate(e.target.value)}
                        />
                    </div>
                    {type !== 'TRANSFER' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Forma de Pagamento</label>
                            <select 
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                                value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                            >
                                <option value="PIX">PIX</option>
                                <option value="BOLETO">Boleto Bancário</option>
                                <option value="CREDITO">Cartão de Crédito</option>
                                <option value="DEBITO">Cartão de Débito</option>
                                <option value="DINHEIRO">Dinheiro Espécie</option>
                                <option value="TRANSFERENCIA">TED/DOC</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* COLUNA DIREITA: ADVANCED & CONTEXT */}
            <div className="space-y-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <AlignLeft size={14} /> Detalhamento e Classificação
                </h3>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Entidade Responsável</label>
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setPersonType('PF')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${personType === 'PF' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow' : 'text-gray-500'}`}>
                            <User size={12}/> Pessoa Física
                        </button>
                        <button onClick={() => setPersonType('PJ')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${personType === 'PJ' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow' : 'text-gray-500'}`}>
                            <Building2 size={12}/> Pessoa Jurídica
                        </button>
                    </div>
                </div>

                {type === 'EXPENSE' && paymentMethod === 'CREDITO' && (
                    <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 animate-in zoom-in-95">
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Selecione o Cartão</label>
                            <select 
                                className="w-full p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 dark:bg-slate-800 outline-none"
                                value={cardId || ''} onChange={e => setCardId(e.target.value || null)}
                            >
                                <option value="">Qual cartão?</option>
                                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Parcelamento (Vezes)</label>
                            <input 
                                type="number" min="1" max="48"
                                className="w-full p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 dark:bg-slate-800 outline-none font-bold"
                                value={installments} onChange={e => setInstallments(Number(e.target.value))}
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Centro de Custo</label>
                        <input 
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none"
                            placeholder="Ex: Comercial"
                            value={costCenter} onChange={e => setCostCenter(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tags (Separadas por vírgula)</label>
                        <div className="relative">
                            <Hash size={14} className="absolute left-3 top-3.5 text-gray-400"/>
                            <input 
                                className="w-full pl-8 p-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none text-xs"
                                placeholder="fixo, recorrente, vip"
                                value={tags} onChange={e => setTags(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {type !== 'TRANSFER' && !cardId && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                {isPaid ? <CheckCircle size={20}/> : <Clock size={20}/>}
                            </div>
                            <div>
                                <span className="block text-sm font-black text-gray-800 dark:text-white">{isPaid ? 'Efetivado / Realizado' : 'Provisionado / Pendente'}</span>
                                <span className="text-[10px] text-gray-500 uppercase">Status da Liquidação</span>
                            </div>
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
          <button onClick={onClose} className="flex-1 py-4 rounded-xl border border-gray-300 dark:border-slate-700 font-bold text-gray-500 hover:bg-gray-100 transition-all uppercase text-xs tracking-widest">Cancelar</button>
          <button onClick={handleSave} className={`flex-1 py-4 rounded-xl text-white font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-widest ${type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'EXPENSE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            <Save size={20}/> Gravar {type === 'TRANSFER' ? 'Transferência' : (type === 'INCOME' ? 'Receita' : 'Despesa')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceTransactionForm;
