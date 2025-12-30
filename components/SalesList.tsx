import React, { useState, useMemo } from 'react';
import { Sale, ProductType, SaleFormData } from '../types';
import { 
    Edit2, Plus, Download, Trash2, CalendarCheck, X, ChevronLeft, 
    ChevronRight, ArrowUpDown, AlertTriangle, Search, Clock, CheckCircle, 
    Calculator, Eye, EyeOff, Settings, Filter, ShieldAlert, Lock, Loader2 
} from 'lucide-react';
import { formatCurrency } from '../services/logic';

interface SalesListProps {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onNew: () => void;
  onExportTemplate: () => void;
  onClearAll: () => void;
  onBillBulk: (ids: string[], date: string) => void;
  onDeleteBulk: (ids: string[]) => void;
  onRecalculate?: (includeBilled: boolean, filterType: ProductType | 'ALL', dateFrom: string, dateTo?: string) => void;
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
  darkMode?: boolean;
}

const SalesList: React.FC<SalesListProps> = ({ 
    sales, onEdit, onDelete, onNew, onExportTemplate, onClearAll, onBillBulk, onDeleteBulk, onRecalculate, onNotify, darkMode 
}) => {
  const [filterType, setFilterType] = useState<ProductType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'BILLED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Sale | 'status', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showProjection, setShowProjection] = useState(true);
  
  const [billingModal, setBillingModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [recalcModal, setRecalcModal] = useState(false);
  const [recalcIncludeBilled, setRecalcIncludeBilled] = useState(false);
  
  // Segurança
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const processedSales = useMemo(() => {
    let result = sales.filter(sale => {
      if (searchTerm && !sale.client.toLowerCase().includes(searchTerm.toLowerCase())) return false;
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

  const totalPages = Math.ceil(processedSales.length / itemsPerPage);
  const paginatedSales = processedSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectVisible = (checked: boolean) => {
      if (checked) {
          const visibleIds = paginatedSales.map(s => s.id);
          setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
      } else {
          const visibleIds = paginatedSales.map(s => s.id);
          setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
      }
  };

  const handleSelectAllGlobal = () => {
      setSelectedIds(processedSales.map(s => s.id));
  };

  const handleRecalcAction = () => {
      if (onRecalculate) {
          onRecalculate(recalcIncludeBilled, filterType, dateFrom, dateTo);
          setRecalcModal(false);
          onNotify?.('SUCCESS', 'Recálculo iniciado com os critérios selecionados.');
      }
  };

  const handlePermanentDelete = async () => {
      if (!passwordConfirm) return alert("Digite sua senha para confirmar.");
      setIsDeleting(true);
      // Aqui simulamos a validação de senha. Na App.tsx real, deve-se integrar com a autenticação.
      await new Promise(r => setTimeout(r, 1000));
      onDeleteBulk(deleteConfirmModal.ids);
      setIsDeleting(false);
      setDeleteConfirmModal({ isOpen: false, ids: [] });
      setSelectedIds([]);
      setPasswordConfirm('');
  };

  const containerClass = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm';

  return (
    <div className="space-y-6 relative pb-20">
      
      {/* BARRA DE AÇÕES EM MASSA */}
      {selectedIds.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 dark:bg-indigo-600 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-white/10">
              <div className="flex flex-col">
                  <span className="font-black text-xs uppercase tracking-widest">{selectedIds.length} Selecionados</span>
                  <button onClick={handleSelectAllGlobal} className="text-[10px] text-indigo-300 underline font-bold">Selecionar todos os {processedSales.length} resultados</button>
              </div>
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

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Monitor de Vendas</h1>
            <p className="text-sm text-gray-500">Gestão de competência e auditoria de comissões.</p>
          </div>
          <div className="flex gap-2">
              <button onClick={onExportTemplate} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-200" title="Modelo CSV"><Download size={20}/></button>
              <button onClick={onNew} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95">
                  <Plus size={18}/> Nova Venda
              </button>
          </div>
      </div>

      {/* FILTROS AVANÇADOS */}
      <div className={`p-6 rounded-3xl border ${containerClass} grid grid-cols-1 md:grid-cols-12 gap-4 items-end`}>
          <div className="md:col-span-3">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Pesquisa</label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                  <input className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`} placeholder="Cliente ou NF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
          </div>
          <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">De</label>
              <input type="date" className={`w-full p-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Até</label>
              <input type="date" className={`w-full p-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Tipo</label>
                  <select className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                      <option value="ALL">Todas</option>
                      <option value={ProductType.BASICA}>Básica</option>
                      <option value={ProductType.NATAL}>Natal</option>
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
          <div className="md:col-span-2 flex gap-2">
              <button onClick={() => setRecalcModal(true)} className="flex-1 p-2.5 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase">
                  <Calculator size={16}/> Recalcular
              </button>
          </div>
      </div>

      {/* TABELA */}
      <div className={`rounded-3xl border overflow-hidden ${containerClass}`}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className={`text-[10px] font-black uppercase tracking-widest border-b ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
                      <tr>
                          <th className="p-5 w-12">
                              <input 
                                type="checkbox" 
                                className="rounded" 
                                checked={paginatedSales.every(s => selectedIds.includes(s.id)) && paginatedSales.length > 0} 
                                onChange={e => handleSelectVisible(e.target.checked)} 
                              />
                          </th>
                          <th className="p-5">Competência</th>
                          <th className="p-5">Cliente</th>
                          <th className="p-5 text-right">Margem</th>
                          <th className="p-5 text-right">Comissão</th>
                          <th className="p-5 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-gray-100'}`}>
                      {paginatedSales.map(sale => (
                          <tr key={sale.id} className={`hover:bg-indigo-500/5 transition-colors ${selectedIds.includes(sale.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                              <td className="p-5"><input type="checkbox" className="rounded" checked={selectedIds.includes(sale.id)} onChange={() => setSelectedIds(p => p.includes(sale.id) ? p.filter(x => x !== sale.id) : [...p, sale.id])} /></td>
                              <td className="p-5">
                                  <div className="flex flex-col">
                                      <span className="font-black">{new Date(sale.date || sale.completionDate).toLocaleDateString('pt-BR')}</span>
                                      <span className={`text-[9px] font-black uppercase ${sale.date ? 'text-emerald-500' : 'text-amber-500'}`}>{sale.date ? 'Faturado' : 'Pendente'}</span>
                                  </div>
                              </td>
                              <td className="p-5 font-bold">{sale.client}</td>
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

          <div className="p-5 border-t flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
                  <span>Exibir:</span>
                  <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="bg-white dark:bg-slate-800 border rounded px-2 py-1 outline-none">
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                  </select>
                  <span>Total: {processedSales.length} registros</span>
              </div>
              <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 disabled:opacity-30"><ChevronLeft size={20}/></button>
                  <span className="font-black text-xs uppercase tracking-widest">Página {currentPage} de {totalPages || 1}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 disabled:opacity-30"><ChevronRight size={20}/></button>
              </div>
          </div>
      </div>

      {/* MODAL RECALCULO */}
      {recalcModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className={`w-full max-w-lg rounded-3xl p-8 ${darkMode ? 'bg-slate-900 text-white border border-slate-700' : 'bg-white text-gray-900'} shadow-2xl animate-in zoom-in-95`}>
                  <div className="flex items-center gap-4 mb-6">
                      <div className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl"><Calculator size={32}/></div>
                      <h3 className="text-2xl font-black tracking-tighter">Recálculo Estratégico</h3>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-400 font-bold leading-relaxed">
                          Este processo sincroniza os valores de comissão com as tabelas de regras vigentes.
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Apenas a partir de:</label>
                              <input type="date" className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-black/20 border-slate-700' : 'bg-gray-50'}`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Tipo de Venda:</label>
                              <select className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-black/20 border-slate-700' : 'bg-gray-50'}`} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                                  <option value="ALL">Todas</option>
                                  <option value={ProductType.BASICA}>Básica</option>
                                  <option value={ProductType.NATAL}>Natal</option>
                              </select>
                          </div>
                      </div>

                      <label className="flex items-center gap-4 p-4 rounded-2xl border border-dashed border-slate-700 cursor-pointer hover:bg-white/5 transition-colors">
                          <input type="checkbox" className="w-6 h-6 rounded-lg text-orange-500" checked={recalcIncludeBilled} onChange={e => setRecalcIncludeBilled(e.target.checked)} />
                          <div>
                              <p className="text-sm font-black uppercase tracking-tighter">Incluir Vendas Faturadas?</p>
                              <p className="text-[10px] text-gray-500">Atenção: Isso alterará relatórios e extratos de competências passadas.</p>
                          </div>
                      </label>
                  </div>

                  <div className="mt-8 flex gap-3">
                      <button onClick={() => setRecalcModal(false)} className="flex-1 py-4 text-gray-500 font-black uppercase text-xs hover:bg-black/10 rounded-2xl transition-all">Sair</button>
                      <button onClick={handleRecalcAction} className="flex-1 py-4 bg-orange-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-orange-900/20 active:scale-95 transition-all">Executar Recálculo</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL EXCLUSÃO SEGURA */}
      {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className={`w-full max-w-md rounded-[2.5rem] p-8 border-2 border-red-500/50 ${darkMode ? 'bg-slate-900' : 'bg-white shadow-2xl'} animate-in zoom-in-95`}>
                  <div className="flex flex-col items-center text-center mb-8">
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 border-4 border-red-500 shadow-lg shadow-red-900/20">
                          <Trash2 size={40} className={isDeleting ? 'animate-bounce' : ''}/>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white">Ação Irreversível</h3>
                      <p className="text-sm text-gray-500 mt-2">Você está prestes a excluir <b>{deleteConfirmModal.ids.length}</b> registros. Para continuar, confirme sua identidade.</p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-black uppercase text-red-500 block mb-1 ml-1">Senha de Acesso</label>
                          <div className="relative">
                              <Lock className="absolute left-4 top-3.5 text-gray-500" size={18}/>
                              <input 
                                  type="password" 
                                  className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 dark:border-slate-800 outline-none focus:border-red-500 transition-all ${darkMode ? 'bg-black/20 text-white' : 'bg-gray-50'}`}
                                  placeholder="Digite sua senha..."
                                  value={passwordConfirm}
                                  onChange={e => setPasswordConfirm(e.target.value)}
                                  autoFocus
                              />
                          </div>
                      </div>
                      <button 
                          onClick={handlePermanentDelete}
                          disabled={isDeleting || !passwordConfirm}
                          className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-3xl shadow-xl shadow-red-900/40 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                      >
                          {isDeleting ? <Loader2 className="animate-spin mx-auto" size={24}/> : 'EXCLUIR PERMANENTEMENTE'}
                      </button>
                      <button onClick={() => setDeleteConfirmModal({ isOpen: false, ids: [] })} className="w-full py-4 text-xs font-black uppercase text-gray-500 hover:text-gray-900 transition-colors">Cancelar Operação</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default SalesList;
