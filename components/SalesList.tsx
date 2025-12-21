
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, ProductType, ProductLabels, SaleFormData } from '../types';
import { Edit2, Plus, Download, Upload, Trash2, History, Settings, RotateCcw, CalendarCheck, X, ChevronLeft, ChevronRight, ArrowUpDown, AlertTriangle, Search, Clock, Database, Loader2, CheckCircle, Printer, Calculator } from 'lucide-react';
import { getSystemConfig, DEFAULT_PRODUCT_LABELS, processSalesImport } from '../services/logic';
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
  onRecalculate?: () => void; // New Prop
  
  hasUndo: boolean;
  allowImport?: boolean; 
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const SalesList: React.FC<SalesListProps> = ({ 
    sales, 
    onEdit,
    onDelete,
    onNew, 
    onExportTemplate, 
    onImportFile, 
    onClearAll, 
    onRestore, 
    onOpenBulkAdvanced, 
    onUndo,
    onBillSale,
    onBillBulk,
    onDeleteBulk,
    onBulkAdd,
    onRecalculate,
    hasUndo,
    allowImport = true,
    onNotify
}) => {
  const [filterType, setFilterType] = useState<ProductType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'BILLED'>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>(''); 
  const [filterYear, setFilterYear] = useState<string>(''); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Sale | 'netValue' | 'status', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [billingModal, setBillingModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [labels, setLabels] = useState<ProductLabels>(DEFAULT_PRODUCT_LABELS);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
      getSystemConfig().then(cfg => {
          if (cfg.productLabels) setLabels(cfg.productLabels);
      });
  }, []);

  const getLabel = (type: ProductType) => {
      if (type === ProductType.BASICA) return labels.basica || 'Básica';
      if (type === ProductType.NATAL) return labels.natal || 'Natal';
      return labels.custom || 'Outros';
  };

  const processedSales = useMemo(() => {
    let result = sales.filter(sale => {
      if (searchTerm && !sale.client.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterType !== 'ALL' && sale.type !== filterType) return false;
      const isPending = !sale.date;
      if (filterStatus === 'PENDING' && !isPending) return false;
      if (filterStatus === 'BILLED' && isPending) return false;
      if (filterMonth) {
          if (isPending) {
               const compDate = sale.completionDate;
               if (!compDate || !compDate.startsWith(filterMonth)) return false;
          } else {
               if (!sale.date.startsWith(filterMonth)) return false;
          }
      }
      if (filterYear && sale.type === ProductType.NATAL) {
        const d = sale.date || sale.completionDate;
        if (!d || d.split('-')[0] !== filterYear) return false;
      }
      return true;
    });

    result.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof Sale];
        let valB: any = b[sortConfig.key as keyof Sale];
        if (sortConfig.key === 'netValue') { valA = a.commissionValueTotal; valB = b.commissionValueTotal; } 
        else if (sortConfig.key === 'status') { valA = a.date ? 1 : 0; valB = b.date ? 1 : 0; } 
        else if (sortConfig.key === 'date') {
            const dateA = a.date || a.completionDate || '1970-01-01';
            const dateB = b.date || b.completionDate || '1970-01-01';
            valA = new Date(dateA).getTime();
            valB = new Date(dateB).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return result;
  }, [sales, searchTerm, filterType, filterStatus, filterMonth, filterYear, sortConfig]);

  const paginatedSales = useMemo(() => {
      if (itemsPerPage === 'ALL') return processedSales;
      const startIndex = (currentPage - 1) * itemsPerPage;
      return processedSales.slice(startIndex, startIndex + itemsPerPage);
  }, [processedSales, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(processedSales.length / itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType, filterStatus, filterMonth, filterYear]);

  const handleSort = (key: string) => {
      setSortConfig(prev => ({
          key: key as any,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const isAllPageSelected = paginatedSales.length > 0 && paginatedSales.every(s => selectedIds.includes(s.id));
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      const pageIds = paginatedSales.map(s => s.id);
      if (e.target.checked) setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
      else setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
  };
  const handleSelectOne = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openBillModal = (ids: string[]) => { setBillingModal({ isOpen: true, ids }); setBillingDate(new Date().toISOString().split('T')[0]); };
  const confirmBilling = () => {
      if (!billingDate) { if(onNotify) onNotify('ERROR', 'Selecione uma data.'); return; }
      if (billingModal.ids.length === 1) { const sale = sales.find(s => s.id === billingModal.ids[0]); if (sale) onBillSale(sale, billingDate); } 
      else { onBillBulk(billingModal.ids, billingDate); }
      setBillingModal({ isOpen: false, ids: [] }); setSelectedIds([]); 
  };
  const openDeleteModal = (ids: string[]) => { setDeleteModal({ isOpen: true, ids }); };
  const confirmDelete = () => { onDeleteBulk(deleteModal.ids); setDeleteModal({ isOpen: false, ids: [] }); setSelectedIds([]); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
          const { readExcelFile } = await import('../services/logic');
          const rows = await readExcelFile(file);
          if (rows && rows.length > 0) {
              setImportData(rows);
              setImportModalOpen(true);
          } else {
              if(onNotify) onNotify('ERROR', 'Arquivo vazio ou inválido.');
          }
      } catch (err) {
          if(onNotify) onNotify('ERROR', 'Erro ao ler arquivo.');
      } finally {
          setIsImporting(false);
          e.target.value = '';
      }
  };

  const confirmImport = (mapping: any) => {
      if (onBulkAdd) {
          try {
              const processedItems = processSalesImport(importData, mapping);
              if (processedItems.length > 0) {
                  onBulkAdd(processedItems);
                  if(onNotify) onNotify('SUCCESS', `${processedItems.length} vendas importadas com sucesso!`);
              } else {
                  if(onNotify) onNotify('INFO', 'Nenhuma venda processada. Verifique o mapeamento.');
              }
          } catch (e) {
              if(onNotify) onNotify('ERROR', 'Erro ao processar importação.');
          }
      } else {
          if(onNotify) onNotify('ERROR', 'Função de salvamento em massa não disponível.');
      }
      setImportModalOpen(false);
  };

  const handleRecalcClick = () => {
      if(onRecalculate) {
          if(confirm("Esta ação recalculará as comissões de TODAS as vendas PENDENTES (não faturadas) usando as tabelas atuais. Vendas faturadas não serão alteradas. Deseja continuar?")) {
              onRecalculate();
          }
      }
  };

  const handlePrint = () => {
      window.print();
  };

  const totalBase = processedSales.reduce((acc, s) => acc + s.commissionBaseTotal, 0);
  const totalCommission = processedSales.reduce((acc, s) => acc + s.commissionValueTotal, 0);

  return (
    <div className="space-y-6 relative">
      <SalesImportModal 
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          fileData={importData}
          onConfirm={confirmImport}
      />

      <div className="print-header">
          <h1 className="text-2xl font-bold">Relatório de Vendas</h1>
          <p className="text-sm">Gerado em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
          <div className="mt-2 text-xs border p-2 rounded inline-block">
              Filtros: {filterType} | Status: {filterStatus} | Mês: {filterMonth || 'Todos'}
          </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Minhas Vendas</h1>
        
        <div className="flex gap-2 flex-wrap items-center w-full md:w-auto">
            {allowImport && (
                <>
                    <button 
                        onClick={onExportTemplate}
                        className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm text-sm"
                        title="Modelo CSV"
                    >
                        <Download size={18} className="mr-2" /> <span className="hidden md:inline">Modelo</span>
                    </button>
                    
                    <label className={`bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm text-sm cursor-pointer ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
                        {isImporting ? <Loader2 size={18} className="mr-2 animate-spin"/> : <Upload size={18} className="mr-2" />}
                        <span className="hidden md:inline">{isImporting ? 'Lendo...' : 'Importar'}</span>
                        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} ref={fileInputRef} disabled={isImporting} />
                    </label>
                </>
            )}

            {onRecalculate && (
                <button 
                    onClick={handleRecalcClick}
                    className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded-lg hover:bg-orange-100 flex items-center shadow-sm text-sm"
                    title="Recalcular Vendas Pendentes"
                >
                    <Calculator size={18} className="mr-2" /> <span className="hidden md:inline">Recalcular Pendentes</span>
                </button>
            )}

            <button 
                onClick={handlePrint}
                className="bg-white border border-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm transition-colors"
                title="Imprimir Relatório"
            >
                <Printer size={20} />
            </button>

            <div className="relative">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`bg-white border border-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm transition-colors ${isMenuOpen ? 'ring-2 ring-blue-500' : ''}`}
                >
                    <Settings size={20} />
                </button>
                {isMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-64 max-w-[85vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right">
                            {hasUndo && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onUndo(); setIsMenuOpen(false); }} 
                                    className="w-full text-left px-4 py-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center border-b border-gray-100 dark:border-slate-700"
                                >
                                    <RotateCcw size={16} className="mr-2" /> Desfazer Última Ação
                                </button>
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRestore(); setIsMenuOpen(false); }} 
                                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center"
                            >
                                <History size={16} className="mr-2 text-blue-500" /> Restaurar Backup (.v360)
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onOpenBulkAdvanced(); setIsMenuOpen(false); }} 
                                className="w-full text-left px-4 py-3 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center"
                            >
                                <CalendarCheck size={16} className="mr-2" /> Faturamento em Massa
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onClearAll(); setIsMenuOpen(false); }} 
                                className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center border-t border-gray-100 dark:border-slate-700"
                            >
                                <Database size={16} className="mr-2" /> Limpar Base de Dados
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="w-px h-8 bg-gray-300 mx-2 hidden md:block"></div>

            <button onClick={onNew} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center shadow-sm text-sm font-medium">
                <Plus size={20} className="mr-2" /> Nova Venda
            </button>
        </div>
      </div>

      {/* FILTERS BAR (Visual Only) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-4 items-end no-print">
          <div className="md:col-span-3">
             <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Busca (Cliente)</label>
             <div className="relative">
                <Search className="absolute left-2 top-2.5 text-gray-400" size={16}/>
                <input 
                  type="text" 
                  placeholder="Nome..." 
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-md py-2 pl-8 pr-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
          <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Status</label>
              <select className="w-full border border-gray-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                  <option value="ALL">Todos</option>
                  <option value="PENDING">Pendentes</option>
                  <option value="BILLED">Faturados</option>
              </select>
          </div>
          <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tipo</label>
              <select className="w-full border border-gray-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                  <option value="ALL">Todos</option>
                  <option value={ProductType.BASICA}>{getLabel(ProductType.BASICA)}</option>
                  <option value={ProductType.NATAL}>{getLabel(ProductType.NATAL)}</option>
                  <option value={ProductType.CUSTOM}>{getLabel(ProductType.CUSTOM)}</option>
              </select>
          </div>
          <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mês</label>
              <input type="month" className="w-full border border-gray-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}/>
          </div>
          <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ano ({getLabel(ProductType.NATAL)})</label>
              <input type="number" placeholder="202X" className="w-full border border-gray-300 dark:border-slate-600 rounded-md p-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white" value={filterYear} onChange={e => setFilterYear(e.target.value)}/>
          </div>
           <div className="md:col-span-1 flex justify-end">
                <button 
                    onClick={() => { setFilterType('ALL'); setFilterStatus('ALL'); setFilterMonth(''); setFilterYear(''); setSearchTerm(''); }}
                    className="text-sm text-gray-500 hover:text-blue-600 underline py-2"
                >
                    Limpar
                </button>
           </div>
      </div>

      {/* SALES TABLE */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="w-10 p-4 no-print">
                    <input type="checkbox" className="rounded border-gray-300 w-4 h-4 cursor-pointer" onChange={handleSelectAll} checked={isAllPageSelected} />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('status')}>Status/Data <ArrowUpDown size={12}/></th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('client')}>Cliente <ArrowUpDown size={12}/></th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('type')}>Tipo <ArrowUpDown size={12}/></th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('commissionBaseTotal')}>Base <ArrowUpDown size={12}/></th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 cursor-pointer" onClick={() => handleSort('marginPercent')}>Margem <ArrowUpDown size={12}/></th>
                <th className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer" onClick={() => handleSort('netValue')}>Comissão <ArrowUpDown size={12}/></th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {paginatedSales.map((sale) => (
                <tr key={sale.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${selectedIds.includes(sale.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <td className="p-4 text-center no-print">
                      <input type="checkbox" className="rounded border-gray-300 w-4 h-4 cursor-pointer" checked={selectedIds.includes(sale.id)} onChange={() => handleSelectOne(sale.id)} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-sm">
                    {sale.date ? (
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-800 dark:text-white">{new Date(sale.date).toLocaleDateString('pt-BR')}</span>
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">FATURADO</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-orange-500 font-bold text-xs bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full w-fit">
                            <Clock size={12}/> Pendente
                        </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{sale.client}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${sale.type === ProductType.BASICA ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300' : (sale.type === ProductType.NATAL ? 'text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300' : 'text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300')}`}>
                      {getLabel(sale.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-mono">{formatCurrency(sale.commissionBaseTotal)}</td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className={sale.marginPercent < 0 ? 'text-red-500 font-bold' : 'text-gray-700 dark:text-gray-300'}>{sale.marginPercent.toFixed(2)}%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono">{formatCurrency(sale.commissionValueTotal)}</td>
                  <td className="px-4 py-3 text-center no-print">
                    <div className="flex items-center justify-center gap-2">
                        {!sale.date && (
                            <button onClick={() => openBillModal([sale.id])} className="text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded-md text-xs font-bold transition-colors shadow-sm flex items-center gap-1">
                                <CalendarCheck size={14} /> Faturar
                            </button>
                        )}
                        <button onClick={() => onEdit(sale)} className="text-amber-500 hover:text-amber-600 p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => { onDelete(sale); }} className="text-red-500 hover:text-red-600 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedSales.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-gray-400">Nenhuma venda encontrada.</td></tr>}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                <tr className="font-bold text-gray-800 dark:text-white">
                    <td colSpan={5} className="px-4 py-4 text-right">TOTAIS (Filtro Atual)</td>
                    <td className="px-4 py-4 text-right font-mono">{formatCurrency(totalBase)}</td>
                    <td className="px-4 py-4 text-right text-emerald-700 dark:text-emerald-400 text-lg font-mono">{formatCurrency(totalCommission)}</td>
                    <td className="no-print"></td>
                </tr>
            </tfoot>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div className="bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-3 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
             <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                 <span>Itens por página:</span>
                 <select className="border rounded p-1 bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setCurrentPage(1); }}>
                     <option value={10}>10</option>
                     <option value={25}>25</option>
                     <option value={50}>50</option>
                     <option value={100}>100</option>
                     <option value="ALL">Todas</option>
                 </select>
                 <span className="text-xs ml-2">Total: {processedSales.length} registros</span>
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

      {/* MOBILE LIST */}
      <div className="md:hidden space-y-3 no-print">
          {paginatedSales.map((sale) => (
              <div key={sale.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-4 relative ${selectedIds.includes(sale.id) ? 'border-blue-400 ring-1 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
                  <div className="absolute top-4 left-4">
                      <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={selectedIds.includes(sale.id)} onChange={() => handleSelectOne(sale.id)} />
                  </div>
                  <div className="pl-8">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <h3 className="font-bold text-gray-900 dark:text-white text-sm">{sale.client}</h3>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {sale.date ? (
                                      <span className="text-green-600 dark:text-green-400 font-bold">{new Date(sale.date).toLocaleDateString('pt-BR')}</span>
                                  ) : (
                                      <span className="text-orange-500 font-bold">Pendente</span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sale.type === ProductType.BASICA ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300' : 'text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300'}`}>
                                      {getLabel(sale.type)}
                                  </span>
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(sale.commissionValueTotal)}</p>
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-slate-700 pt-2 mt-2">
                           {!sale.date && (
                                <button onClick={() => openBillModal([sale.id])} className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                                    <CalendarCheck size={14} /> Faturar
                                </button>
                            )}
                           <button onClick={() => onEdit(sale)} className="text-amber-500 font-bold text-xs flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
                                <Edit2 size={14}/> Editar
                           </button>
                           <button onClick={() => onDelete(sale)} className="text-red-500 font-bold text-xs flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                                <Trash2 size={14}/> Excluir
                           </button>
                      </div>
                  </div>
              </div>
          ))}
      </div>

      {/* BILLING MODAL */}
      {billingModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b bg-gray-50 dark:bg-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 dark:text-white">Confirmar Faturamento</h3>
                      <button onClick={() => setBillingModal({ isOpen: false, ids: [] })}><X size={20} className="text-gray-400"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          Defina a data de faturamento para <strong>{billingModal.ids.length}</strong> venda(s).
                      </p>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Data de Faturamento</label>
                      <input 
                        type="date" 
                        className="w-full p-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={billingDate}
                        onChange={e => setBillingDate(e.target.value)}
                      />
                      <div className="flex gap-3 mt-6">
                          <button onClick={() => setBillingModal({ isOpen: false, ids: [] })} className="flex-1 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
                          <button onClick={confirmBilling} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 shadow-md">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle size={32} className="text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Tem certeza?</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                          Você está prestes a excluir <strong>{deleteModal.ids.length}</strong> venda(s).
                      </p>
                      
                      <div className="flex gap-3">
                          <button onClick={() => setDeleteModal({ isOpen: false, ids: [] })} className="flex-1 py-3 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                          <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors">Sim, Excluir</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default SalesList;
