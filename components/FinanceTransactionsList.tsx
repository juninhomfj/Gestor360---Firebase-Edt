import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, TransactionCategory, FinanceAccount, ImportMapping } from '../types';
import { Filter, Trash2, CheckCircle2, Clock, PlayCircle, TrendingUp, TrendingDown, ArrowLeftRight, Paperclip, X, FileText, Image as ImageIcon, ChevronLeft, ChevronRight, Upload, Download, Loader2 } from 'lucide-react';
import TransactionSettleModal from './TransactionSettleModal';
import FinanceImportModal from './FinanceImportModal';
// Fix: Added missing exports 'processFinanceImport', 'readExcelFile', 'exportReportToCSV' to imports from services/logic
import { processFinanceImport, readExcelFile, exportReportToCSV, saveFinanceData } from '../services/logic';

interface FinanceTransactionsListProps {
  transactions: Transaction[];
  accounts: FinanceAccount[];
  categories: TransactionCategory[];
  onDelete: (id: string) => void;
  onPay?: (transaction: Transaction, details: { accountId: string; amount: number; date: string; attachments?: string[] }) => void;
  darkMode?: boolean;
  initialFilter?: 'ALL' | 'PENDING';
}

const FinanceTransactionsList: React.FC<FinanceTransactionsListProps> = ({ 
    transactions, accounts, categories, onDelete, onPay, darkMode, initialFilter = 'ALL' 
}) => {
  const [viewMode, setViewMode] = useState<'ALL' | 'PENDING'>(initialFilter);
  const [filterType, setFilterType] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);
  
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  useEffect(() => {
      setViewMode(initialFilter);
      setCurrentPage(1); 
  }, [initialFilter]);

  useEffect(() => {
      setCurrentPage(1);
  }, [filterType, filterMonth]);

  const filtered = useMemo(() => {
      return transactions.filter(t => {
          if (viewMode === 'PENDING') {
              if (t.isPaid) return false;
          }
          if (filterType !== 'ALL' && t.type !== filterType) return false;
          if (filterMonth && !t.date.startsWith(filterMonth)) return false;
          return true;
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, viewMode, filterType, filterMonth]);

  const paginatedTransactions = useMemo(() => {
      if (itemsPerPage === 'ALL') return filtered;
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(filtered.length / itemsPerPage);

  const getCategoryName = (id: string) => {
      if (id === 'DISTRIBUTION') return 'Distribuição de Lucros';
      if (id === 'CARD_PAYMENT') return 'Pagamento de Fatura';
      if (id === 'uncategorized') return 'Sem Categoria';
      return categories.find(c => c.id === id)?.name || 'Outros';
  };
  
  const getAccountName = (id?: string) => accounts.find(a => a.id === id)?.name || '-';

  const headClass = darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-600';
  const cardBg = darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm';

  const getTypeIcon = (type: string) => {
      if (type === 'INCOME') return <TrendingUp size={18} className="text-emerald-500" />;
      if (type === 'EXPENSE') return <TrendingDown size={18} className="text-red-500" />;
      return <ArrowLeftRight size={18} className="text-blue-500" />;
  };

  const handleOpenSettle = (t: Transaction) => {
      setSelectedTransaction(t);
      setSettleModalOpen(true);
  };

  const handleConfirmSettle = (t: Transaction, details: any) => {
      if (onPay) onPay(t, details);
  };

  const handleAttachmentClick = (base64: string) => {
      if (base64.startsWith('data:application/pdf')) {
          const win = window.open();
          if (win) {
              win.document.write(`<iframe src="${base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
          }
      } else {
          setPreviewAttachment(base64);
      }
  };

  const handleExport = () => {
      const data = filtered.map(t => ({
          Data: new Date(t.date).toLocaleDateString('pt-BR'),
          Descrição: t.description,
          Valor: t.amount.toFixed(2),
          Tipo: t.type === 'INCOME' ? 'Receita' : t.type === 'EXPENSE' ? 'Despesa' : 'Transferência',
          Categoria: getCategoryName(t.categoryId),
          Conta: getAccountName(t.accountId),
          Status: t.isPaid ? 'Pago' : 'Pendente'
      }));
      exportReportToCSV(data, `extrato_financeiro_${new Date().toISOString().slice(0,10)}`);
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsImporting(true);
      try {
          const rows = await readExcelFile(file);
          if (rows && rows.length > 0) {
              setImportData(rows);
              setImportModalOpen(true);
          } else {
              alert("Arquivo vazio ou inválido.");
          }
      } catch (e) {
          alert("Erro ao ler arquivo.");
      } finally {
          setIsImporting(false);
          e.target.value = ''; 
      }
  };

  const confirmImport = async (mapping: ImportMapping) => {
      try {
          const newTx = processFinanceImport(importData, mapping);
          
          const defaultAccId = accounts.length > 0 ? accounts[0].id : '';
          
          // Fix: Explicitly cast mapped objects to Transaction type to resolve assignment mismatch error
          const processedTx = newTx.map(t => ({
              ...t,
              accountId: defaultAccId 
          })) as Transaction[];

          // Fix: Added logic import to get access to current data
          const logicMod = await import('../services/logic');
          const currentAll = await logicMod.getFinanceData();
          // Fix: merging completed transactions correctly
          const merged = [...(currentAll.transactions || []), ...processedTx];
          
          await saveFinanceData(currentAll.accounts || [], currentAll.cards || [], merged, currentAll.categories || []);
          
          alert(`${processedTx.length} transações importadas! A página será atualizada.`);
          window.location.reload();
      } catch (e) {
          alert("Erro ao processar importação.");
      }
  };

  return (
      <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
                  <button onClick={() => setViewMode('ALL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'ALL' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}>TODOS</button>
                  <button onClick={() => setViewMode('PENDING')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'PENDING' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-gray-500'}`}>PENDENTES</button>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={handleExport} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-300' : 'border-gray-200 text-gray-600'}`}>
                      <Download size={16}/> Exportar
                  </button>
                  <button onClick={handleImportClick} disabled={isImporting} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
                      {isImporting ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Importar
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={handleFileChange}/>
              </div>
          </div>
          
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 ${cardBg}`}>
              <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tipo</label>
                  {/* Fix: Corrected event handler in select to use e.target.value */}
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className={`w-full p-2 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300'}`}>
                      <option value="ALL">Todos</option>
                      <option value="INCOME">Receitas</option>
                      <option value="EXPENSE">Despesas</option>
                      <option value="TRANSFER">Transferências</option>
                  </select>
              </div>
              <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Mês</label>
                  {/* Fix: Corrected event handler in input to use e.target.value */}
                  <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={`w-full p-2 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300'}`}/>
              </div>
          </div>

          <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className={headClass}>
                          <tr>
                              <th className="p-4">Data</th>
                              <th className="p-4">Descrição</th>
                              <th className="p-4">Categoria</th>
                              <th className="p-4">Conta</th>
                              <th className="p-4 text-right">Valor</th>
                              <th className="p-4 text-center">Ações</th>
                          </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                          {paginatedTransactions.map(t => (
                              <tr key={t.id} className={darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'}>
                                  <td className="p-4 whitespace-nowrap">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                                  <td className="p-4">
                                      <div className="flex items-center gap-2">
                                          {getTypeIcon(t.type)}
                                          <span className="font-medium">{t.description}</span>
                                          {t.attachments && t.attachments.length > 0 && (
                                              <button onClick={() => handleAttachmentClick(t.attachments![0])} className="text-gray-400 hover:text-blue-500">
                                                  <Paperclip size={12}/>
                                              </button>
                                          )}
                                      </div>
                                  </td>
                                  <td className="p-4">{getCategoryName(t.categoryId)}</td>
                                  <td className="p-4">{getAccountName(t.accountId)}</td>
                                  <td className={`p-4 text-right font-bold ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                  </td>
                                  <td className="p-4 text-center">
                                      <div className="flex justify-center gap-2">
                                          {!t.isPaid && onPay && (
                                              <button onClick={() => handleOpenSettle(t)} className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                                                  <CheckCircle2 size={16}/>
                                              </button>
                                          )}
                                          <button onClick={() => onDelete(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                              <Trash2 size={16}/>
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {filtered.length === 0 && (
                              <tr>
                                  <td colSpan={6} className="p-8 text-center text-gray-500">Nenhuma transação encontrada.</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 pt-4">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded border disabled:opacity-30"><ChevronLeft size={20}/></button>
                  <span className="text-sm font-bold">Página {currentPage} de {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded border disabled:opacity-30"><ChevronRight size={20}/></button>
              </div>
          )}

          {settleModalOpen && selectedTransaction && (
              <TransactionSettleModal
                  isOpen={settleModalOpen}
                  onClose={() => setSettleModalOpen(false)}
                  transaction={selectedTransaction}
                  accounts={accounts}
                  onConfirm={handleConfirmSettle}
                  darkMode={darkMode}
              />
          )}

          {importModalOpen && (
              <FinanceImportModal
                  isOpen={importModalOpen}
                  onClose={() => setImportModalOpen(false)}
                  fileData={importData}
                  onConfirm={confirmImport}
                  darkMode={darkMode}
              />
          )}

          {previewAttachment && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewAttachment(null)}>
                  <div className="max-w-4xl max-h-full">
                      <img src={previewAttachment} className="max-w-full max-h-[90vh] object-contain" alt="Anexo"/>
                  </div>
              </div>
          )}
      </div>
  );
};

export default FinanceTransactionsList;