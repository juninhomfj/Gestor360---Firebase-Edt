
import React, { useState, useEffect, useRef } from 'react';
import { TransactionType, FinanceAccount, TransactionCategory, PersonType, CreditCard } from '../types';
import { X, Save, TrendingUp, TrendingDown, ArrowLeftRight, Calendar, RefreshCw, Paperclip, Trash2, Divide, Copy, Sparkles, CreditCard as CardIcon, Wallet } from 'lucide-react';
import { fileToBase64, formatFileSize } from '../utils/fileHelper';
import { addMonths } from '../services/logic';

interface FinanceTransactionFormProps {
  initialType?: TransactionType; // 'INCOME' | 'EXPENSE' | 'TRANSFER'
  accounts: FinanceAccount[];
  categories: TransactionCategory[];
  cards?: CreditCard[]; // New
  onSave: (data: any | any[]) => void;
  onCancel: () => void;
  darkMode?: boolean;
  aiEnabled?: boolean;
}

const FinanceTransactionForm: React.FC<FinanceTransactionFormProps> = ({ 
    initialType = 'EXPENSE', 
    accounts, 
    categories, 
    cards = [],
    onSave, 
    onCancel,
    darkMode,
    aiEnabled = false
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<'ACCOUNT' | 'CARD'>('ACCOUNT');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [cardId, setCardId] = useState(cards[0]?.id || '');
  
  const [targetAccountId, setTargetAccountId] = useState(accounts.length > 1 ? accounts[1].id : '');
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [personType, setPersonType] = useState<PersonType>('PF');
  const [isPaid, setIsPaid] = useState(true);
  
  // Recurring / Installments
  const [repeatMode, setRepeatMode] = useState<'NONE' | 'RECURRING' | 'INSTALLMENT'>('NONE');
  const [recurrenceCount, setRecurrenceCount] = useState(2);

  // Attachments
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Income Calculator
  const [grossIncome, setGrossIncome] = useState('');
  const [incomeDeductions, setIncomeDeductions] = useState('');
  
  const [restored, setRestored] = useState(false);

  const availableCategories = categories.filter(c => c.type === type);
  const selectedCategory = categories.find(c => c.id === categoryId);

  // RESTORE DRAFT ON MOUNT
  useEffect(() => {
      const draft = localStorage.getItem('sys_tx_draft');
      if (draft) {
          try {
              const d = JSON.parse(draft);
              setType(d.type);
              setDescription(d.description);
              setAmount(d.amount);
              setDate(d.date);
              setPaymentMethod(d.paymentMethod);
              setAccountId(d.accountId || accounts[0]?.id || '');
              setCardId(d.cardId || cards[0]?.id || '');
              setCategoryId(d.categoryId);
              setSubcategory(d.subcategory);
              setPersonType(d.personType);
              setIsPaid(d.isPaid);
              setRestored(true);
          } catch(e) {}
      }
  }, []);

  // SAVE DRAFT ON CHANGE
  useEffect(() => {
      const draftData = {
          type, description, amount, date, paymentMethod, accountId, cardId, categoryId, subcategory, personType, isPaid
      };
      localStorage.setItem('sys_tx_draft', JSON.stringify(draftData));
  }, [type, description, amount, date, paymentMethod, accountId, cardId, categoryId, subcategory, personType, isPaid]);

  useEffect(() => {
      setCategoryId('');
      setSubcategory('');
      // Reset payment method logic when switching type
      if (type === 'INCOME' || type === 'TRANSFER') {
          setPaymentMethod('ACCOUNT');
      }
  }, [type]);

  // Auto-set IsPaid to false if using credit card (it consumes limit but isn't cash out yet)
  useEffect(() => {
      if (paymentMethod === 'CARD' && type === 'EXPENSE') {
          setIsPaid(false);
      } else {
          setIsPaid(true);
      }
  }, [paymentMethod, type]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const val = parseFloat(amount);
      if (!description || isNaN(val) || val <= 0) {
          alert("Preencha a descrição e um valor válido.");
          return;
      }

      const transactionsToSave = [];
      const count = repeatMode !== 'NONE' ? recurrenceCount : 1;
      
      // Calculate amount per transaction
      let amountPerTx = val;
      if (repeatMode === 'INSTALLMENT') {
          amountPerTx = val / count;
      }

      const baseData: any = {
          type,
          categoryId: categoryId || 'uncategorized',
          subcategory: subcategory, 
          personType: personType,
          attachments 
      };

      if (paymentMethod === 'ACCOUNT') {
          baseData.accountId = accountId;
      } else {
          baseData.cardId = cardId;
          baseData.accountId = null; // No cash account used yet
      }

      if (type === 'TRANSFER') {
          if (accountId === targetAccountId) {
              alert("A conta de origem e destino devem ser diferentes.");
              return;
          }
          baseData.targetAccountId = targetAccountId;
          baseData.categoryName = 'Transferência';
      }

      const startDate = new Date(date);

      for (let i = 0; i < count; i++) {
          const currentDate = addMonths(startDate, i);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Logic:
          // If Card: Always Pending (Paid = false) until invoice is paid.
          // If Account: 1st is Paid (if isPaid checked), others Pending.
          let paidStatus = false;
          
          if (paymentMethod === 'CARD') {
              paidStatus = false; // Credit card expenses are liabilities until invoice paid
          } else {
              paidStatus = i === 0 ? isPaid : false;
          }

          let finalDesc = description;
          if (count > 1) {
              finalDesc = `${description} (${i+1}/${count})`;
          }

          transactionsToSave.push({
              ...baseData,
              id: crypto.randomUUID(),
              description: finalDesc,
              amount: amountPerTx, 
              date: dateStr,
              isPaid: paidStatus,
          });
      }

      localStorage.removeItem('sys_tx_draft');
      onSave(transactionsToSave);
  };

  const handleCalculateNet = () => {
      const gross = parseFloat(grossIncome) || 0;
      const ded = parseFloat(incomeDeductions) || 0;
      setAmount((gross - ded).toFixed(2));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          try {
              const base64 = await fileToBase64(files[0]);
              setAttachments([...attachments, base64]);
          } catch (error) {
              alert("Erro ao processar arquivo.");
          }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(attachments.filter((_, i) => i !== index));
  };

  const bgClass = darkMode ? 'bg-slate-900 text-white' : 'bg-white text-gray-900';
  const inputClass = darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]`}>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-700 relative">
            {restored && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl">
                    Rascunho
                </div>
            )}
            <button 
                onClick={() => setType('INCOME')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${type === 'INCOME' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/10' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <TrendingUp size={18} /> Receita
            </button>
            <button 
                onClick={() => setType('EXPENSE')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${type === 'EXPENSE' ? 'text-red-500 border-b-2 border-red-500 bg-red-500/10' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <TrendingDown size={18} /> Despesa
            </button>
            <button 
                onClick={() => setType('TRANSFER')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${type === 'TRANSFER' ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/10' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <ArrowLeftRight size={18} /> Transf.
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
            
            {/* Description & Amount */}
            <div>
                <label className="block text-xs text-gray-500 mb-1 flex justify-between items-center">
                    <span>Descrição</span>
                    {!aiEnabled && (
                        <div className="group relative">
                            <div className="flex items-center gap-1 cursor-help opacity-60 hover:opacity-100 transition-opacity">
                                <Sparkles size={12} className="text-purple-500"/>
                                <span className="text-[9px] text-purple-500 font-bold">Dica IA</span>
                            </div>
                            <div className="absolute right-0 bottom-5 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700">
                                Ative a IA no seu perfil para fazer lançamentos automáticos por voz!
                            </div>
                        </div>
                    )}
                </label>
                <input 
                    className={`w-full p-3 rounded-lg border ${inputClass}`}
                    placeholder={type === 'INCOME' ? 'Ex: Salário, Comissão' : 'Ex: Aluguel, Supermercado'}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                />
            </div>

            {/* Income Calculator (Optional) */}
            {type === 'INCOME' && (
                <div className={`p-3 rounded-lg border border-dashed ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-300 bg-gray-50'}`}>
                    <p className="text-xs text-gray-500 mb-2 font-bold">Calculadora Rápida (Opcional)</p>
                    <div className="flex gap-2">
                        <input 
                            type="number" placeholder="Bruto" 
                            className={`w-1/3 p-2 rounded text-sm border ${inputClass}`}
                            value={grossIncome} onChange={e => setGrossIncome(e.target.value)}
                        />
                        <input 
                            type="number" placeholder="Descontos" 
                            className={`w-1/3 p-2 rounded text-sm border ${inputClass}`}
                            value={incomeDeductions} onChange={e => setIncomeDeductions(e.target.value)}
                        />
                        <button type="button" onClick={handleCalculateNet} className="flex-1 bg-emerald-600 text-white rounded text-xs font-bold">
                            Calcular Líquido
                        </button>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs text-gray-500 mb-1">Valor Total (R$)</label>
                <input 
                    type="number" 
                    step="0.01"
                    className={`w-full p-3 rounded-lg border text-lg font-bold ${inputClass}`}
                    placeholder="0,00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                />
                {repeatMode === 'INSTALLMENT' && amount && recurrenceCount > 1 && (
                    <p className="text-xs text-emerald-500 mt-1 text-right font-bold">
                        {recurrenceCount}x de R$ {(parseFloat(amount) / recurrenceCount).toFixed(2)}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Data (1ª Parcela)</label>
                    <div className="relative">
                        <input 
                            type="date" 
                            className={`w-full p-2 rounded-lg border ${inputClass}`}
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                        />
                    </div>
                </div>
                
                {/* Method Selection (Account vs Card) */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">
                        Meio de Pagamento
                    </label>
                    {type === 'EXPENSE' && cards.length > 0 ? (
                        <div className="flex bg-gray-100 dark:bg-slate-800 rounded p-1 mb-2">
                            <button 
                                type="button" 
                                onClick={() => setPaymentMethod('ACCOUNT')} 
                                className={`flex-1 py-1 text-xs font-bold rounded ${paymentMethod === 'ACCOUNT' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow' : 'text-gray-500'}`}
                            >
                                <Wallet size={12} className="inline mr-1"/> Conta
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setPaymentMethod('CARD')} 
                                className={`flex-1 py-1 text-xs font-bold rounded ${paymentMethod === 'CARD' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-300 shadow' : 'text-gray-500'}`}
                            >
                                <CardIcon size={12} className="inline mr-1"/> Cartão
                            </button>
                        </div>
                    ) : null}

                    {paymentMethod === 'ACCOUNT' ? (
                        <select 
                            className={`w-full p-2 rounded-lg border ${inputClass}`}
                            value={accountId}
                            onChange={e => setAccountId(e.target.value)}
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    ) : (
                        <select 
                            className={`w-full p-2 rounded-lg border ${inputClass}`}
                            value={cardId}
                            onChange={e => setCardId(e.target.value)}
                        >
                            {cards.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {type === 'TRANSFER' && (
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Conta Destino</label>
                    <select 
                        className={`w-full p-2 rounded-lg border ${inputClass}`}
                        value={targetAccountId}
                        onChange={e => setTargetAccountId(e.target.value)}
                    >
                        {accounts.filter(a => a.id !== accountId).map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {type !== 'TRANSFER' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Categoria</label>
                        <select 
                            className={`w-full p-2 rounded-lg border ${inputClass}`}
                            value={categoryId}
                            onChange={e => { setCategoryId(e.target.value); setSubcategory(''); }}
                        >
                            <option value="">Sem Categoria</option>
                            {availableCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                            <select 
                                className={`w-full p-2 rounded-lg border mt-2 text-sm ${inputClass}`}
                                value={subcategory}
                                onChange={e => setSubcategory(e.target.value)}
                            >
                                <option value="">Subcategoria...</option>
                                {selectedCategory.subcategories.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Pessoa</label>
                        <div className="flex bg-gray-800 rounded p-1">
                            <button 
                                type="button"
                                onClick={() => setPersonType('PF')}
                                className={`flex-1 text-xs py-1.5 rounded ${personType === 'PF' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}
                            >PF</button>
                            <button 
                                type="button"
                                onClick={() => setPersonType('PJ')}
                                className={`flex-1 text-xs py-1.5 rounded ${personType === 'PJ' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >PJ</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ATTACHMENTS */}
            <div>
                <label className="block text-xs text-gray-500 mb-2">Comprovantes / Anexos</label>
                <div className="flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                        <div key={idx} className="relative w-12 h-12 bg-gray-100 rounded overflow-hidden group border border-gray-300">
                            {att.startsWith('data:application/pdf') ? (
                                <div className="w-full h-full flex items-center justify-center text-red-500 font-bold text-[8px]">PDF</div>
                            ) : (
                                <img src={att} className="w-full h-full object-cover" />
                            )}
                            <button type="button" onClick={() => removeAttachment(idx)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`w-12 h-12 rounded border-2 border-dashed flex items-center justify-center ${darkMode ? 'border-slate-600 hover:border-slate-400' : 'border-gray-300 hover:border-gray-400'}`}>
                        <Paperclip size={20} className="text-gray-500" />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileSelect} />
                </div>
            </div>

            <div className={`p-3 rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-800/30' : 'border-gray-200 bg-gray-50'}`}>
                {paymentMethod === 'CARD' ? (
                    <div className="text-xs text-purple-400 font-bold flex items-center gap-2">
                        <CardIcon size={14} /> Lançamento em Fatura (Consome Limite)
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mb-2">
                        <input 
                            type="checkbox" 
                            id="isPaid" 
                            checked={isPaid} 
                            onChange={e => setIsPaid(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor="isPaid" className="text-sm font-bold">
                            {type === 'INCOME' ? 'Recebido' : 'Pago'} (Efetivado)
                        </label>
                    </div>
                )}
            </div>

            {/* Recurring / Installments Option */}
            {type !== 'TRANSFER' && (
                <div className={`p-3 rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-800/30' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <RefreshCw size={16} className="text-gray-400" />
                        <span className="text-sm font-bold">Repetição / Parcelas</span>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                        <button 
                            type="button"
                            onClick={() => setRepeatMode('NONE')}
                            className={`flex-1 py-1.5 text-xs rounded border transition-all ${repeatMode === 'NONE' ? 'bg-gray-600 text-white border-gray-600' : 'text-gray-500 border-gray-300 dark:border-slate-600'}`}
                        >
                            Único
                        </button>
                        <button 
                            type="button"
                            onClick={() => setRepeatMode('RECURRING')}
                            className={`flex-1 py-1.5 text-xs rounded border transition-all flex items-center justify-center gap-1 ${repeatMode === 'RECURRING' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-300 dark:border-slate-600'}`}
                        >
                            <Copy size={10}/> Recorrência
                        </button>
                        <button 
                            type="button"
                            onClick={() => setRepeatMode('INSTALLMENT')}
                            className={`flex-1 py-1.5 text-xs rounded border transition-all flex items-center justify-center gap-1 ${repeatMode === 'INSTALLMENT' ? 'bg-purple-600 text-white border-purple-600' : 'text-gray-500 border-gray-300 dark:border-slate-600'}`}
                        >
                            <Divide size={10}/> Parcelado
                        </button>
                    </div>

                    {repeatMode !== 'NONE' && (
                        <div className="text-xs text-gray-400 pl-2 border-l-2 border-gray-500">
                            <div className="flex items-center gap-2 mb-2">
                                <span>{repeatMode === 'RECURRING' ? 'Repetir por' : 'Número de parcelas:'}</span>
                                <input 
                                    type="number" min="2" max="120"
                                    className={`w-16 p-1 text-center rounded border ${inputClass}`}
                                    value={recurrenceCount}
                                    onChange={e => setRecurrenceCount(Number(e.target.value))}
                                />
                                <span>meses</span>
                            </div>
                            <p>
                                {repeatMode === 'RECURRING' 
                                    ? `Serão criados ${recurrenceCount} lançamentos de mesmo valor (R$ ${amount || '0'}).` 
                                    : `O valor total será dividido em ${recurrenceCount} parcelas de R$ ${((parseFloat(amount)||0)/recurrenceCount).toFixed(2)}.`
                                }
                            </p>
                        </div>
                    )}
                </div>
            )}

        </form>

        {/* Footer */}
        <div className={`p-4 border-t ${darkMode ? 'border-slate-800' : 'border-gray-200'} flex gap-3`}>
            <button 
                onClick={onCancel}
                className={`flex-1 py-3 rounded-lg font-medium border ${darkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
            >
                Cancelar
            </button>
            <button 
                onClick={handleSubmit}
                className={`flex-1 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 ${
                    type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    type === 'EXPENSE' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                <Save size={18} /> Salvar
            </button>
        </div>

      </div>
    </div>
  );
};

export default FinanceTransactionForm;
