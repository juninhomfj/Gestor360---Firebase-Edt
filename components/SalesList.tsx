import React, { useState, useMemo, useEffect } from 'react';
import { Sale, ProductType, ProductLabels, SaleFormData } from '../types';
import { Edit2, Plus, Download, Upload, Trash2, History, Settings, RotateCcw, CalendarCheck, X, ChevronLeft, ChevronRight, ArrowUpDown, AlertTriangle, Search, Clock, Database, Loader2, CheckCircle, Printer, Calculator, Eye, EyeOff, Filter, BarChart3 } from 'lucide-react';
import { getSystemConfig, DEFAULT_PRODUCT_LABELS, processSalesImport, formatCurrency } from '../services/logic';
import SalesImportModal from './ImportModal'; 

interface SalesListProps {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onNew: () => void;
  onExportTemplate: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>; 
  onClearAll: () => void;
  onRestore: () => void;
  onOpenBulkAdvanced: () => void;
  onUndo: () => void;
  onBillSale: (sale: Sale, date: string) => void;
  onBillBulk: (ids: string[], date: string) => void;
  onDeleteBulk: (ids: string[]) => void;
  onBulkAdd?: (newSalesData: SaleFormData[]) => void; 
  onRecalculate?: (includeBilled: boolean, filterType: ProductType | 'ALL', dateFrom: string) => void;
  
  hasUndo: boolean;
  allowImport?: boolean; 
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
  darkMode?: boolean;
}

const SalesList: React.FC<SalesListProps> = ({ 
    sales, onEdit, onDelete, onNew, onExportTemplate, onImportFile, onClearAll, onRestore, onOpenBulkAdvanced, onUndo,
    onBillSale, onBillBulk, onDeleteBulk, onBulkAdd, onRecalculate,
    hasUndo, allowImport = true, onNotify, darkMode 
}) => {
  const [filterType, setFilterType] = useState<ProductType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'BILLED'>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>(''); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Sale | 'netValue' | 'status', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(25);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showProjection, setShowProjection] = useState(true);
  
  const [billingModal, setBillingModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [recalcModal, setRecalcModal] = useState(false);
  const [recalcIncludeBilled, setRecalcIncludeBilled] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  
  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Added missing handleSort function
  const handleSort = (key: keyof Sale | 'netValue' | 'status') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const processedSales = useMemo(() => {
    let result = sales.filter(sale => {
      if (searchTerm && !sale.client.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterType !== 'ALL' && sale.type !== filterType) return false;
      const isPending = !sale.date;
      if (filterStatus === 'PENDING' && !isPending) return false;
      if (filterStatus === 'BILLED' && isPending) return false;
      if (filterMonth) {
          const comp = sale.date || sale.completionDate || '';
          if (!comp.startsWith(filterMonth)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof Sale];
        let valB: any = b[sortConfig.key as keyof Sale];
        if (sortConfig.key === 'netValue') { valA = a.commissionValueTotal; valB = b.commissionValueTotal; } 
        else if (sortConfig.key === 'status') { valA = a.date ? 1 : 0; valB = b.date ? 1 : 0; } 
        else if (sortConfig.key === 'date') {
            valA = new Date(a.date || a.completionDate || '1970-01-01').getTime();
            valB = new Date(b.date || b.completionDate || '1970-01-01').getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return result;
  }, [sales, searchTerm, filterType, filterStatus, filterMonth, sortConfig]);

  const paginatedSales = useMemo(() => {
      if (itemsPerPage === 'ALL') return processedSales;
      const startIndex = (currentPage - 1) * itemsPerPage;
      return processedSales.slice(startIndex, startIndex + itemsPerPage);
  }, [processedSales, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(processedSales.length / itemsPerPage);

  const stats = useMemo(() => {
      const billed = processedSales.filter(s => !!s.date);
      const pending = processedSales.filter(s => !s.date);
      return {
          billedComm: billed.reduce((acc, s) => acc + s.commissionValueTotal, 0),
          pendingComm: pending.reduce((acc, s) => acc + s.commissionValueTotal, 0),
          billedQty: billed.reduce((acc, s) => acc + s.quantity, 0),
          pendingQty: pending.reduce((acc, s) => acc + s.quantity, 0),
      };
  }, [processedSales]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) setSelectedIds(processedSales.map(s => s.id));
      else setSelectedIds([]);
  };

  const handleSelectOne = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleRecalcConfirm = () => {
      if (onRecalculate) {
          onRecalculate(recalcIncludeBilled, filterType, filterMonth);
      }
      setRecalcModal(false);
  };

  const containerClass = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm';
  const tableHeadClass = darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500';

  return (
    <div className="space-y-6 relative pb-20">
      
      {/* TOOLBAR FLUTUANTE DE AÇÕES EM MASSA */}
      {selectedIds.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10">
              <span className="font-bold text-sm">{selectedIds.length} selecionados</span>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex gap-2">
                  <button onClick={() => setBillingModal({ isOpen: true, ids: selectedIds })} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black uppercase tracking-widest transition-all">
                      <CalendarCheck size={16}/> Faturar
                  </button>
                  <button onClick={() => setDeleteModal({ isOpen: true, ids: selectedIds })} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg text-xs font-black uppercase tracking-widest transition-all">
                      <Trash2 size={16}/> Excluir
                  </button>
                  <button onClick={() => setSelectedIds([])} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18}/></button>
              </div>
          </div>
      )}

      {/* HEADER E PROJEÇÃO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Gestão de Vendas</h1>
            <p className="text-sm text-gray-500">Histórico e conferência de comissões.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => setShowProjection(!showProjection)} className={`p-2.5 rounded-xl border ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-gray-200 bg-white text-gray-600'}`}>
                  {showProjection ? <Eye size={20}/> : <EyeOff size={20}/>}
              </button>
              <button onClick={onNew} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2">
                  <Plus size={18}/> Nova Venda
              </button>
          </div>
      </div>

      {showProjection && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
              <div className={`p-6 rounded-2xl border border-l-4 border-l-emerald-500 ${containerClass}`}>
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Comissão Faturada (Mês/Filtro)</p>
                      <CheckCircle size={16} className="text-emerald-500" />
                  </div>
                  <p className="text-3xl font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.billedComm)}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.billedQty} cestas entregues.</p>
              </div>
              <div className={`p-6 rounded-2xl border border-l-4 border-l-amber-500 ${containerClass}`}>
                  <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Comissão Pendente (Expectativa)</p>
                      <Clock size={16} className="text-amber-500" />
                  </div>
                  <p className="text-3xl font-black text-amber-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.pendingComm)}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.pendingQty} cestas aguardando faturamento.</p>
              </div>
          </div>
      )}

      {/* FILTROS E BUSCA */}
      <div className={`p-4 rounded-2xl border ${containerClass} grid grid-cols-1 md:grid-cols-12 gap-4 items-end no-print`}>
          <div className="md:col-span-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Busca Cliente</label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                  <input className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="Nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
          </div>
          <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Status</label>
              <select className={`w-full p-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                  <option value="ALL">Todos</option>
                  <option value="PENDING">Pendentes</option>
                  <option value="BILLED">Faturados</option>
              </select>
          </div>
          <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Categoria</label>
              <select className={`w-full p-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                  <option value="ALL">Todas</option>
                  <option value={ProductType.BASICA}>Básica</option>
                  <option value={ProductType.NATAL}>Natal</option>
              </select>
          </div>
          <div className="md:col-span-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Mês Competência</label>
              <input type="month" className={`w-full p-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex gap-2">
              <button onClick={() => setRecalcModal(true)} className="flex-1 p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors" title="Recalcular Comissões"><Calculator size={20} className="mx-auto"/></button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors"><Settings size={20}/></button>
          </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className={`rounded-2xl border overflow-hidden ${containerClass}`}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className={`text-[10px] font-black uppercase tracking-widest border-b ${tableHeadClass}`}>
                      <tr>
                          <th className="p-4 w-10"><input type="checkbox" className="rounded" checked={selectedIds.length === processedSales.length && processedSales.length > 0} onChange={handleSelectAll} /></th>
                          <th className="p-4 cursor-pointer" onClick={() => handleSort('date')}>Data <ArrowUpDown size={12} className="inline ml-1"/></th>
                          <th className="p-4 cursor-pointer" onClick={() => handleSort('client')}>Cliente <ArrowUpDown size={12} className="inline ml-1"/></th>
                          <th className="p-4 text-center">Tipo</th>
                          <th className="p-4 text-right">Margem</th>
                          <th className="p-4 text-right">Comissão</th>
                          <th className="p-4 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-gray-100'}`}>
                      {paginatedSales.map(sale => (
                          <tr key={sale.id} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${selectedIds.includes(sale.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                              <td className="p-4"><input type="checkbox" className="rounded" checked={selectedIds.includes(sale.id)} onChange={() => handleSelectOne(sale.id)} /></td>
                              <td className="p-4">
                                  <div className="flex flex-col">
                                      <span className="font-bold">{new Date(sale.date || sale.completionDate).toLocaleDateString('pt-BR')}</span>
                                      <span className={`text-[9px] font-black uppercase ${sale.date ? 'text-emerald-500' : 'text-amber-500'}`}>{sale.date ? 'Faturado' : 'Pendente'}</span>
                                  </div>
                              </td>
                              <td className="p-4 font-bold">{sale.client}</td>
                              <td className="p-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${sale.type === ProductType.BASICA ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{sale.type}</span>
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-gray-500">{sale.marginPercent.toFixed(2)}%</td>
                              <td className="p-4 text-right">
                                  <div className="flex flex-col items-end">
                                      <span className="font-black text-emerald-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.commissionValueTotal)}</span>
                                      <span className="text-[9px] text-gray-400">Base: R$ {sale.commissionBaseTotal.toFixed(2)}</span>
                                  </div>
                              </td>
                              <td className="p-4">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={() => onEdit(sale)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"><Edit2 size={16}/></button>
                                      <button onClick={() => onDelete(sale)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>

          {/* RODAPÉ DA TABELA: PAGINAÇÃO E CONTROLE */}
          <div className={`p-4 border-t flex flex-col md:flex-row justify-between items-center gap-4 ${tableHeadClass}`}>
              <div className="flex items-center gap-3 text-xs font-bold">
                  <span>Mostrar:</span>
                  <select value={itemsPerPage} onChange={e => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className={`bg-transparent border rounded p-1 ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value="ALL">Todas</option>
                  </select>
                  <span className="opacity-60">Total: {processedSales.length} registros</span>
              </div>
              {itemsPerPage !== 'ALL' && totalPages > 1 && (
                  <div className="flex items-center gap-4">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 disabled:opacity-30"><ChevronLeft size={20}/></button>
                      <span className="text-xs font-black">Página {currentPage} de {totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 disabled:opacity-30"><ChevronRight size={20}/></button>
                  </div>
              )}
          </div>
      </div>

      {/* MODAL DE RECALCULO AVANÇADO */}
      {recalcModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><Calculator size={24}/></div>
                      <h3 className="text-xl font-bold">Recálculo de Comissões</h3>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                          Os cálculos usarão as tabelas de comissão vigentes para atualizar os valores de acordo com a margem atual.
                      </div>

                      <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-black/5">
                          <input type="checkbox" className="w-5 h-5 rounded text-orange-500" checked={recalcIncludeBilled} onChange={e => setRecalcIncludeBilled(e.target.checked)} />
                          <div>
                              <p className="text-sm font-bold">Incluir Vendas Faturadas</p>
                              <p className="text-[10px] text-gray-500">Atenção: Isso alterará números de meses passados.</p>
                          </div>
                      </label>

                      {recalcIncludeBilled && (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 animate-in shake duration-300">
                              <AlertTriangle size={20} className="shrink-0"/>
                              <p className="text-[10px] font-bold uppercase tracking-tight">Cuidado: Alterar vendas já faturadas impactará diretamente seus fechamentos e extratos históricos.</p>
                          </div>
                      )}
                  </div>

                  <div className="mt-8 flex gap-3">
                      <button onClick={() => setRecalcModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                      <button onClick={handleRecalcConfirm} className="flex-1 py-3 bg-orange-600 text-white font-black rounded-xl shadow-lg hover:bg-orange-700 active:scale-95 transition-all uppercase text-xs tracking-widest">Iniciar Recálculo</button>
                  </div>
              </div>
          </div>
      )}

      {/* BILLING MODAL */}
      {billingModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
              <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-slate-900 text-white border border-slate-700' : 'bg-white'}`}>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><CalendarCheck className="text-emerald-500" /> Confirmar Faturamento</h3>
                  <p className="text-sm text-gray-500 mb-6">Defina a data de faturamento para <strong>{billingModal.ids.length}</strong> vendas selecionadas.</p>
                  <input type="date" className={`w-full p-3 rounded-xl border mb-6 outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50'}`} value={billingDate} onChange={e => setBillingDate(e.target.value)} />
                  <div className="flex gap-3">
                      <button onClick={() => setBillingModal({ isOpen: false, ids: [] })} className="flex-1 py-3 text-gray-400 font-bold">Sair</button>
                      <button onClick={() => { onBillBulk(billingModal.ids, billingDate); setBillingModal({ isOpen: false, ids: [] }); setSelectedIds([]); }} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700">Confirmar</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default SalesList;
