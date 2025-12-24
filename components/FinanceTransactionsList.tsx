import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, TransactionCategory, FinanceAccount, ImportMapping } from '../types';
import { Filter, Trash2, CheckCircle2, Clock, PlayCircle, TrendingUp, TrendingDown, ArrowLeftRight, Paperclip, X, FileText, Image as ImageIcon, ChevronLeft, ChevronRight, Upload, Download, Loader2 } from 'lucide-react';
import TransactionSettleModal from './TransactionSettleModal';
import FinanceImportModal from './FinanceImportModal';
import { generateFinanceTemplate, processFinanceImport, readExcelFile, exportReportToCSV, saveFinanceData } from '../services/logic';

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
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);
  
  // Settle Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment Preview
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  useEffect(() => {
      setViewMode(initialFilter);
      setCurrentPage(1); // Reset page on filter switch
  }, [initialFilter]);

  // Reset pagination when filters change
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

  const textClass = darkMode ? 'text-slate-300' : 'text-gray-700';
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

  // --- IMPORT / EXPORT LOGIC ---

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
          e.target.value = ''; // Reset input
      }
  };

  const confirmImport = async (mapping: ImportMapping) => {
      try {
          const newTx = processFinanceImport(importData, mapping);
          
          // Match Categories & Accounts intelligently if possible (Simple ID mapping for MVP)
          // For now, assign to first account if default
          const defaultAccId = accounts.length > 0 ? accounts[0].id : '';
          
          const processedTx = newTx.map(t => ({
              ...t,
              accountId: defaultAccId // Force default account for now, user can edit later
          }));

          // Save directly here or use a prop callback?
          // Since we are inside the list, we likely need to trigger a full update up the chain.
          // Ideally, we'd have an onImport prop, but for quick integration let's use the DB save + reload pattern
          // However, props are cleaner.
          // Let's assume we can trigger a reload by calling onPay/onDelete or similar, BUT
          // Since we don't have an explicit onAdd prop here, we might need to modify App.tsx.
          // WORKAROUND: We will update local state and call DB directly, assuming parent re-renders on sync or we force reload.
          // BETTER: Add logic to App.tsx to handle bulk import. For now, let's just save to DB and reload page to reflect.
          
          const currentAll = await import('../services/logic').then(m => m.getFinanceData());
          const merged = [...(currentAll.transactions || []), ...processedTx];
          // Fixed saveFinanceData call to provide only the 4 expected arguments
          await saveFinanceData(currentAll.accounts || [], currentAll.cards || [], merged, currentAll.categories || []);
          
          alert(`${processedTx.length} transações importadas! A página será atualizada.`);
          window.location.reload();

      } catch (e) {
          alert("Erro ao processar importação.");
      }
      setImportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      <TransactionSettleModal 
        isOpen={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        transaction={selectedTransaction}
        accounts={accounts}
        onConfirm={handleConfirmSettle}
        darkMode={darkMode}
      />

      <FinanceImportModal 
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        fileData={importData}
        onConfirm={confirmImport}
        darkMode={darkMode}
      />

      <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />

      {/* Attachment Preview Modal */}
      {previewAttachment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewAttachment(null)}>
              <button className="absolute top-4 right-4 text-white p-2 bg-white/20 rounded-full hover:bg-white/40"><X size={24}/></button>
              <img src={previewAttachment} className="max-w-full max-h-full rounded shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {viewMode === 'PENDING' ? 'Contas a Pagar / Receber' : 'Lançamentos'}
              </h1>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                  {viewMode === 'PENDING' ? 'Gerencie suas provisões e dê baixa.' : 'Histórico completo de transações.'}
              </p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
                  <button 
                    onClick={() => setViewMode('ALL')}
                    className={`px-4 py-2 rounded text-sm font-bold transition-all ${viewMode === 'ALL' ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 shadow') : 'text-gray-500'}`}
                  >
                      Todos
                  </button>
                  <button 
                    onClick={() => setViewMode('PENDING')}
                    className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'PENDING' ? (darkMode ? 'bg-yellow-600 text-white' : 'bg-white text-yellow-700 shadow') : 'text-gray-500'}`}
                  >
                      <Clock size={14} /> Provisionados
                  </button>
              </div>

              <div className="flex gap-2 ml-auto">
                  <button onClick={handleImportClick} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm text-sm" disabled={isImporting}>
                      {isImporting ? <Loader2 size={16} className="animate-spin mr-1"/> : <Upload size={16} className="mr-1"/>}
                      <span className="hidden md:inline">Importar</span>
                  </button>
                  <button onClick={generateFinanceTemplate} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm text-sm" title="Baixar Modelo XLSX">
                      <FileText size={16} />
                  </button>
                  <button onClick={handleExport} className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center shadow-sm text-sm font-bold" title="Baixar Extrato Filtrado">
                      <Download size={16} className="mr-1" /> Exportar
                  </button>
              </div>
          </div>
      </div>

      {/* Filters Bar */}
      <div className={`flex gap-2 p-2 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-white border shadow-sm'}`}>
          <select 
            className={`bg-transparent outline-none text-sm ${textClass} w-full md:w-auto`}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
              <option value="ALL">Todos Tipos</option>
              <option value="INCOME">Receitas</option>
              <option value="EXPENSE">Despesas</option>
              <option value="TRANSFER">Transferências</option>
          </select>
          <input 
            type="month" 
            className={`bg-transparent outline-none text-sm ${textClass}`}
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          />
      </div>

      {/* DESKTOP TABLE */}
      <div className={`hidden md:block rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white shadow-sm'}`}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                  <thead className={headClass}>
                      <tr>
                          <th className="px-4 py-4 text-left">Data</th>
                          <th className="px-4 py-4 text-left">Descrição</th>
                          <th className="px-4 py-4 text-left">Categoria</th>
                          <th className="px-4 py-4 text-left">Conta (Prevista)</th>
                          <th className="px-4 py-4 text-right">Valor</th>
                          <th className="px-4 py-4 text-center">Anexos</th>
                          <th className="px-4 py-4 text-center">Status</th>
                          <th className="px-4 py-4 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                      {paginatedTransactions.map(t => (
                          <tr key={t.id} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}>
                              <td className={`px-4 py-4 whitespace-nowrap ${textClass} text-sm`}>
                                  {new Date(t.date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className={`px-4 py-4 font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {t.description}
                              </td>
                              <td className={`px-4 py-4 ${textClass}`}>
                                  <span className={`px-2 py-1 rounded text-xs ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                                      {t.type === 'TRANSFER' ? 'Transferência' : getCategoryName(t.categoryId)}
                                  </span>
                              </td>
                              <td className={`px-4 py-4 ${textClass}`}>
                                  {getAccountName(t.accountId)} 
                                  {t.type === 'TRANSFER' && ` -> ${getAccountName(t.targetAccountId)}`}
                              </td>
                              <td className={`px-4 py-4 text-right font-bold font-mono`}>
                                  <span className={`flex items-center justify-end gap-1 ${
                                      t.type === 'INCOME' ? 'text-emerald-500' : 
                                      t.type === 'EXPENSE' ? 'text-red-500' : 'text-blue-500'
                                  }`}>
                                      {t.type === 'INCOME' ? '+' : '-'} {t.amount.toFixed(2)}
                                  </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                  {t.attachments && t.attachments.length > 0 && (
                                      <button 
                                        onClick={() => handleAttachmentClick(t.attachments![0])}
                                        className="text-gray-400 hover:text-blue-500 transition-colors"
                                        title={t.attachments[0].startsWith('data:application/pdf') ? "Ver PDF" : "Ver Imagem"}
                                      >
                                          {t.attachments[0].startsWith('data:application/pdf') ? <FileText size={18}/> : <ImageIcon size={18}/>}
                                      </button>
                                  )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                  {t.isPaid ? (
                                      <span className="text-emerald-500 flex justify-center"><CheckCircle2 size={16}/></span>
                                  ) : (
                                      <div className="flex items-center justify-center gap-1">
                                          {onPay && (
                                              <button 
                                                onClick={() => handleOpenSettle(t)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                                                title="Dar Baixa"
                                              >
                                                  <PlayCircle size={14} /> Baixar
                                              </button>
                                          )}
                                          <span className="text-yellow-600 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-800">PENDENTE</span>
                                      </div>
                                  )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                  <button 
                                    onClick={() => onDelete(t.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    title="Excluir"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {paginatedTransactions.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-8 text-gray-500">Nenhum lançamento encontrado.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>

          {/* PAGINATION CONTROLS (DESKTOP) */}
          <div className="bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-3 flex justify-between items-center">
             <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                 <span>Por página:</span>
                 <select 
                   className="border rounded p-1 bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 outline-none"
                   value={itemsPerPage}
                   onChange={e => { setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setCurrentPage(1); }}
                 >
                     <option value={10}>10</option>
                     <option value={25}>25</option>
                     <option value={50}>50</option>
                     <option value="ALL">Todas</option>
                 </select>
                 <span className="ml-2">Total: {filtered.length}</span>
             </div>

             {itemsPerPage !== 'ALL' && totalPages > 1 && (
                 <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                     <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"><ChevronLeft size={20} /></button>
                     <span className="text-sm font-medium px-2">Página {currentPage} de {totalPages}</span>
                     <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"><ChevronRight size={20} /></button>
                 </div>
             )}
          </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-3">
          {paginatedTransactions.map(t => (
              <div key={t.id} className={`p-4 rounded-xl border ${cardBg}`}>
                  <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                              {getTypeIcon(t.type)}
                          </div>
                          <div>
                              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} line-clamp-1`}>{t.description}</h3>
                              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {new Date(t.date).toLocaleDateString('pt-BR')} • {t.type === 'TRANSFER' ? 'Transferência' : getCategoryName(t.categoryId)}
                              </p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className={`font-bold font-mono ${t.type === 'INCOME' ? 'text-emerald-500' : t.type === 'EXPENSE' ? 'text-red-500' : 'text-blue-500'}`}>
                              {t.amount.toFixed(2)}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                              {t.attachments && t.attachments.length > 0 && <Paperclip size={12} className="text-gray-400"/>}
                              {t.isPaid ? (
                                  <span className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> Pago</span>
                              ) : (
                                  <span className="text-[10px] text-yellow-500 flex items-center gap-1"><Clock size={10}/> Pendente</span>
                              )}
                          </div>
                      </div>
                  </div>
                  
                  <div className={`flex justify-between items-center pt-2 mt-2 border-t ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {getAccountName(t.accountId)} {t.type === 'TRANSFER' && `→ ${getAccountName(t.targetAccountId)}`}
                      </span>
                      <div className="flex gap-3">
                          {t.attachments && t.attachments.length > 0 && (
                              <button onClick={() => handleAttachmentClick(t.attachments![0])} className="text-blue-500 text-xs font-bold flex items-center gap-1">
                                  {t.attachments[0].startsWith('data:application/pdf') ? <FileText size={14}/> : <ImageIcon size={14}/>} Ver
                              </button>
                          )}
                          {!t.isPaid && onPay && (
                              <button onClick={() => handleOpenSettle(t)} className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                                  <PlayCircle size={14}/> Baixar
                              </button>
                          )}
                          <button onClick={() => onDelete(t.id)} className="text-red-500 text-xs font-bold flex items-center gap-1">
                              <Trash2 size={14}/> Excluir
                          </button>
                      </div>
                  </div>
              </div>
          ))}
          {paginatedTransactions.length === 0 && <p className="text-center text-gray-500 py-8">Nada por aqui.</p>}

          {/* MOBILE PAGINATION */}
          {itemsPerPage !== 'ALL' && totalPages > 1 && (
             <div className="flex justify-center items-center gap-4 py-4">
                 <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-gray-200 dark:bg-slate-800 rounded-full disabled:opacity-50"><ChevronLeft size={20} className="text-gray-700 dark:text-white"/></button>
                 <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Pág {currentPage} / {totalPages}</span>
                 <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-gray-200 dark:bg-slate-800 rounded-full disabled:opacity-50"><ChevronRight size={20} className="text-gray-700 dark:text-white"/></button>
             </div>
          )}
      </div>
    </div>
  );
};

export default FinanceTransactionsList;