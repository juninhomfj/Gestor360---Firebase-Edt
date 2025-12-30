import React, { useState, useMemo, useRef } from 'react';
import { Sale, ProductType, SaleFormData } from '../types';
import { 
    Edit2, Plus, Download, Trash2, CalendarCheck, X, ChevronLeft, 
    ChevronRight, ArrowUpDown, AlertTriangle, Search, Clock, CheckCircle, 
    Calculator, Eye, EyeOff, Settings, Filter, ShieldAlert, Lock, Loader2, Upload, Database, RefreshCw, FileSpreadsheet
} from 'lucide-react';
import { formatCurrency, readExcelFile, downloadSalesTemplate } from '../services/logic';
import { Logger } from '../services/logger';
import ImportModal from './ImportModal';

interface SalesListProps {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onNew: () => void;
  onExportTemplate?: () => void;
  onClearAll: () => void;
  onRestore: () => void;
  onOpenBulkAdvanced: () => void;
  onBillBulk: (ids: string[], date: string) => void;
  onDeleteBulk: (ids: string[]) => void;
  onBulkAdd: (data: any[]) => void;
  onRecalculate?: (includeBilled: boolean, filterType: ProductType | 'ALL', dateFrom: string, dateTo?: string) => void;
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
  darkMode?: boolean;
}

const SalesList: React.FC<SalesListProps> = ({ 
    sales, onEdit, onDelete, onNew, onClearAll, onRestore, onOpenBulkAdvanced, 
    onBillBulk, onDeleteBulk, onBulkAdd, onRecalculate, onNotify, darkMode 
}) => {
  const [filterType, setFilterType] = useState<ProductType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'BILLED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Sale | 'status', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [billingModal, setBillingModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const processedSales = useMemo(() => {
    let result = sales.filter(sale => {
      if (searchTerm && !(sale.client.toLowerCase().includes(searchTerm.toLowerCase()) || (sale.trackingCode || '').toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      if (filterType !== 'ALL' && sale.type !== filterType) return false;
      if (filterStatus === 'PENDING' && !!sale.date) return false;
      if (filterStatus === 'BILLED' && !sale.date) return false;
      const compDate = sale.date || sale.completionDate || '';
      if (dateFrom && compDate < dateFrom) return false;
      if (dateTo && compDate > dateTo) return false;
      return true;
    });

    result.sort((a, b) => {
        let valA = a[sortConfig.key as keyof Sale] || '';
        let valB = b[sortConfig.key as keyof Sale] || '';
        if (sortConfig.key === 'date') {
            valA = new Date(a.date || a.completionDate || 0).getTime();
            valB = new Date(b.date || b.completionDate || 0).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return result;
  }, [sales, searchTerm, filterType, filterStatus, dateFrom, dateTo, sortConfig]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(processedSales.length / (itemsPerPage as number));
  const paginatedSales = itemsPerPage === 'ALL' ? processedSales : processedSales.slice((currentPage - 1) * (itemsPerPage as number), currentPage * (itemsPerPage as number));

  const handleDownloadModel = () => {
    Logger.info("Auditoria: Usuário clicou em baixar modelo de importação.");
    downloadSalesTemplate();
    if (onNotify) onNotify('SUCCESS', 'Modelo de importação baixado!');
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      Logger.info(`Auditoria: Iniciando leitura de arquivo para importação: ${file.name}`);
      try {
          const rows = await readExcelFile(file);
          if (rows.length > 0) {
              setImportData(rows);
              setIsImportModalOpen(true);
          } else if (onNotify) onNotify('ERROR', 'Arquivo inválido ou vazio.');
      } catch (err) {
          if (onNotify) onNotify('ERROR', 'Erro ao ler arquivo Excel/CSV.');
      }
      e.target.value = '';
  };

  const handlePermanentDelete = async () => {
      if (!passwordConfirm) return alert("Digite sua senha para confirmar.");
      setIsDeleting(true);
      Logger.warn(`Auditoria: Exclusão permanente em massa de ${deleteConfirmModal.ids.length} itens.`);
      await new Promise(r => setTimeout(r, 1000));
      onDeleteBulk(deleteConfirmModal.ids);
      setIsDeleting(false);
      setDeleteConfirmModal({ isOpen: false, ids: [] });
      setSelectedIds([]);
      setPasswordConfirm('');
  };

  const containerClass = darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 shadow-sm text-gray-900';

  return (
    <div className="space-y-6 relative pb-20">
      
      {selectedIds.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 dark:bg-indigo-600 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-white/10">
              <span className="font-black text-xs uppercase tracking-widest">{selectedIds.length} Selecionados</span>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="flex gap-2">
                  <button onClick={() => setBillingModal({ isOpen: true, ids: selectedIds })} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-xl text-xs font-black uppercase transition-all">
                      <CalendarCheck size={16}/> Faturar
                  </button>
                  <button onClick={() => setDeleteConfirmModal({ isOpen: true, ids: selectedIds })} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-xl text-xs font-black uppercase transition-all">
                      <Trash2 size={16}/> Excluir
                  </button>
                  <button onClick={() => setSelectedIds([])} className="p-2 hover:bg-white/10 rounded-full"><X size={18}/></button>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-2xl font-black">Gestão de Vendas</h1>
            <p className="text-sm text-gray-500">Controle operacional e financeiro.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={handleDownloadModel} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-indigo-500 hover:shadow-lg transition-all" title="Baixar Modelo (Excel/CSV)">
                  <FileSpreadsheet size={20}/>
              </button>
              <button onClick={onRestore} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-blue-500 hover:shadow-lg transition-all" title="Backup e Restauração">
                  <Database size={20}/>
              </button>
              <button onClick={handleImportClick} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-emerald-500 hover:shadow-lg transition-all" title="Importar Excel/CSV">
                  <Upload size={20}/>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange}/>
              <button onClick={onClearAll} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-amber-500 hover:shadow-lg transition-all" title="Limpar Cache Local">
                  <RefreshCw size={20}/>
              </button>
              <button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                  <Plus size={18}/> Nova Venda
              </button>
          </div>
      </div>

      <div className={`p-6 rounded-3xl border ${containerClass} grid grid-cols-1 md:grid-cols-12 gap-4 items-end`}>
          <div className="md:col-span-3">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Pesquisar</label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                  <input className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`} placeholder="Cliente ou Rastreio..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
          </div>
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Tipo</label>
                  <select className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                      <option value="ALL">Todas</option>
                      <option value={ProductType.BASICA}>Cesta Básica</option>
                      <option value={ProductType.NATAL}>Cesta de Natal</option>
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
                  <select className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                      <option value="ALL">Todos</option>
                      <option value="PENDING">Pendente</option>
                      <option value="BILLED">Faturado</option>
                  </select>
              </div>
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Início</label>
                  <input type="date" className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Fim</label>
                  <input type="date" className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
          </div>
          <div className="md:col-span-2 flex gap-2">
              <button onClick={onOpenBulkAdvanced} className="flex-1 p-2.5 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase">
                  <CalendarCheck size={16}/> Lote
              </button>
              <button onClick={() => onRecalculate?.(true, filterType, dateFrom)} className="flex-1 p-2.5 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase">
                  <Calculator size={16}/> Recalc
              </button>
          </div>
      </div>

      <div className={`rounded-3xl border overflow-hidden ${containerClass}`}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className={`text-[10px] font-black uppercase tracking-widest border-b ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
                      <tr>
                          <th className="p-5 w-12"><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? processedSales.map(s => s.id) : [])} checked={selectedIds.length === processedSales.length && processedSales.length > 0} /></th>
                          <th className="p-5">Data</th>
                          <th className="p-5">Cliente</th>
                          <th className="p-5">Tipo</th>
                          <th className="p-5 text-right">Margem</th>
                          <th className="p-5 text-right">Comissão</th>
                          <th className="p-5 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                      {paginatedSales.map(sale => (
                          <tr key={sale.id} className={`hover:bg-indigo-500/5 transition-colors ${selectedIds.includes(sale.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                              <td className="p-5"><input type="checkbox" checked={selectedIds.includes(sale.id)} onChange={() => setSelectedIds(p => p.includes(sale.id) ? p.filter(x => x !== sale.id) : [...p, sale.id])} /></td>
                              <td className="p-5">
                                  <div className="flex flex-col">
                                      <span className="font-black">{new Date(sale.date || sale.completionDate).toLocaleDateString('pt-BR')}</span>
                                      <span className={`text-[9px] font-black uppercase ${sale.date ? 'text-emerald-500' : 'text-amber-500'}`}>{sale.date ? 'Faturado' : 'Pendente'}</span>
                                  </div>
                              </td>
                              <td className="p-5 font-bold">{sale.client}</td>
                              <td className="p-5"><span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${sale.type === ProductType.NATAL ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{sale.type === ProductType.NATAL ? 'Natal' : 'Básica'}</span></td>
                              <td className="p-5 text-right font-mono text-xs">{sale.marginPercent.toFixed(2)}%</td>
                              <td className="p-5 text-right font-black text-emerald-600">R$ {sale.commissionValueTotal.toFixed(2)}</td>
                              <td className="p-5 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={() => onEdit(sale)} className="p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-lg"><Edit2 size={16}/></button>
                                      <button onClick={() => setDeleteConfirmModal({ isOpen: true, ids: [sale.id] })} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-slate-800 rounded-lg"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          
          <div className={`p-4 border-t flex flex-col md:flex-row justify-between items-center gap-4 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                  <select value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setCurrentPage(1); }} className={`p-2 rounded-lg border text-xs font-bold ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
                      <option value={25}>25 por página</option>
                      <option value={50}>50 por página</option>
                      <option value="ALL">Ver Todos</option>
                  </select>
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total: {processedSales.length} registros</span>
              </div>

              {itemsPerPage !== 'ALL' && totalPages > 1 && (
                  <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border disabled:opacity-30"><ChevronLeft size={16}/></button>
                      <span className="text-xs font-bold px-4">Página {currentPage} de {totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border disabled:opacity-30"><ChevronRight size={16}/></button>
                  </div>
              )}
          </div>
      </div>

      {isImportModalOpen && (
          <ImportModal 
            isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} fileData={importData} darkMode={darkMode} 
            onConfirm={(mapping) => {
                const processed = importData.slice(1).map(row => {
                    const obj: any = {};
                    Object.keys(mapping).forEach(key => { const idx = mapping[key]; if (idx !== -1) obj[key] = row[idx]; });

                    let pType = ProductType.BASICA;
                    const typeStr = String(obj.type || '').toUpperCase();
                    if (typeStr.includes('NATAL')) pType = ProductType.NATAL;

                    return {
                        client: obj.client || 'Lead Importado',
                        quantity: Number(obj.quantity) || 1,
                        type: pType,
                        valueProposed: Number(obj.valueProposed) || 0,
                        valueSold: Number(obj.valueSold) || 0,
                        marginPercent: Number(obj.margin) || 0,
                        date: obj.date ? new Date(obj.date).toISOString().split('T')[0] : null,
                        completionDate: obj.completionDate ? new Date(obj.completionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        isBilled: !!obj.date,
                        observations: obj.obs || ""
                    };
                });
                onBulkAdd(processed);
                setIsImportModalOpen(false);
                Logger.info(`Auditoria: Importação em lote de ${processed.length} itens processada.`);
            }}
          />
      )}

      {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
              <div className={`w-full max-w-md rounded-[2.5rem] p-8 border-2 border-red-500/50 ${darkMode ? 'bg-slate-900 text-white' : 'bg-white shadow-2xl'} animate-in zoom-in-95`}>
                  <div className="flex flex-col items-center text-center mb-8">
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 border-4 border-red-500"><Trash2 size={40}/></div>
                      <h3 className="text-2xl font-black">Excluir Permanentemente</h3>
                      <p className="text-sm text-gray-500 mt-2">Você apagará <b>{deleteConfirmModal.ids.length}</b> registros. Esta ação é irreversível.</p>
                  </div>
                  <div className="space-y-4">
                      <input type="password" placeholder="Senha de Admin" className={`w-full p-4 rounded-2xl border ${darkMode ? 'bg-black border-slate-700' : 'bg-gray-50'}`} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
                      <button onClick={handlePermanentDelete} disabled={isDeleting} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl shadow-xl transition-all">
                          {isDeleting ? <Loader2 className="animate-spin mx-auto"/> : 'CONFIRMAR EXCLUSÃO'}
                      </button>
                      <button onClick={() => setDeleteConfirmModal({ isOpen: false, ids: [] })} className="w-full text-gray-500 font-bold">Cancelar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SalesList;
