
import React, { useState } from 'react';
import { Sale, ProductType, SaleFormData } from '../types';
import { CheckCircle, Clock, Truck, Send, Search, ClipboardList, AlertCircle, Calendar } from 'lucide-react';

interface BoletoControlProps {
  sales: Sale[];
  onUpdateSale: (updatedSale: Sale) => void;
}

const BoletoControl: React.FC<BoletoControlProps> = ({ sales, onUpdateSale }) => {
  const [filterType, setFilterType] = useState<'ALL' | ProductType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SENT' | 'PAID'>('PENDING'); // Default to PENDING for task list feel
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSales = sales.filter(sale => {
    if (filterType !== 'ALL' && sale.type !== filterType) return false;
    // Default filter logic:
    const status = sale.boletoStatus || 'PENDING';
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    
    if (searchTerm && !(sale.client || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleStatusChange = (sale: Sale, newStatus: 'PENDING' | 'SENT' | 'PAID') => {
    const updatedSale: Sale = { ...sale, boletoStatus: newStatus };
    onUpdateSale(updatedSale);
  };

  const updateTracking = (sale: Sale, code: string) => {
     const updatedSale: Sale = { ...sale, trackingCode: code };
     onUpdateSale(updatedSale);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                <ClipboardList className="mr-2 text-indigo-600" />
                Tarefas de Envio (Boletos/NF)
            </h1>
            <p className="text-gray-500 text-sm mt-1">
                Acompanhe clientes que exigem envio manual de documentos para pagamento.
            </p>
          </div>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-indigo-500 mt-0.5" size={20} />
          <div>
              <h4 className="font-bold text-indigo-800 text-sm">Controle Operacional</h4>
              <p className="text-xs text-indigo-700">
                  Esta lista serve para você não esquecer de enviar PDFs ou boletos para clientes específicos. 
                  Clientes com débito automático ou faturamento automático podem ser marcados como "Concluído" ou ignorados aqui.
              </p>
          </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 min-w-[200px]">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Buscar cliente..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            </div>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
            <select 
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-white text-gray-900"
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
            >
                <option value="ALL">Todos os Tipos</option>
                <option value={ProductType.BASICA}>Cesta Básica</option>
                <option value={ProductType.NATAL}>Cesta de Natal</option>
            </select>

            <select 
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-white text-gray-900 font-bold text-gray-700"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
            >
                <option value="ALL">Todas as Vendas</option>
                <option value="PENDING">📋 Pendente de Envio</option>
                <option value="SENT">📤 Enviado (Aguardando Pagto)</option>
                <option value="PAID">✅ Concluído</option>
            </select>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredSales.map(sale => (
          <div key={sale.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                
                {/* Info Column */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${sale.type === ProductType.BASICA ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {sale.type === ProductType.BASICA ? 'Básica' : 'Natal'}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10}/>
                        {sale.date ? new Date(sale.date).toLocaleDateString('pt-BR') : 'Sem data fat.'}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{sale.client || 'Cliente sem nome'}</h3>
                  <div className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{sale.quantity} un.</span> • Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.valueSold * sale.quantity)}
                  </div>
                </div>

                {/* Tracking Column */}
                <div className="w-full md:w-64 bg-gray-50 p-3 rounded-lg border border-gray-100">
                   <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Rastreio / Observação</label>
                   <div className="flex gap-2">
                     <input 
                        type="text" 
                        className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                        placeholder="Cód. Rastreio..."
                        value={sale.trackingCode || ''}
                        onChange={(e) => updateTracking(sale, e.target.value)}
                     />
                     {sale.trackingCode && (
                       <a 
                        href={`https://www.google.com/search?q=${sale.trackingCode}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                        title="Rastrear no Google"
                       >
                         <Truck size={18} />
                       </a>
                     )}
                   </div>
                </div>

                {/* Action Column */}
                <div className="flex flex-col items-center gap-2 min-w-[200px]">
                    <span className="text-xs font-bold text-gray-400 uppercase">Status da Tarefa</span>
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 w-full">
                        <button 
                          onClick={() => handleStatusChange(sale, 'PENDING')}
                          title="Pendente de Envio"
                          className={`flex-1 p-2 rounded-md flex justify-center transition-all ${(!sale.boletoStatus || sale.boletoStatus === 'PENDING') ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                           <Clock size={18} />
                        </button>
                        <button 
                          onClick={() => handleStatusChange(sale, 'SENT')}
                          title="Enviado para Cliente"
                          className={`flex-1 p-2 rounded-md flex justify-center transition-all ${sale.boletoStatus === 'SENT' ? 'bg-blue-500 shadow text-white' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                           <Send size={18} />
                        </button>
                        <button 
                          onClick={() => handleStatusChange(sale, 'PAID')}
                          title="Concluído / Pago"
                          className={`flex-1 p-2 rounded-md flex justify-center transition-all ${sale.boletoStatus === 'PAID' ? 'bg-emerald-500 shadow text-white' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                           <CheckCircle size={18} />
                        </button>
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                        {(!sale.boletoStatus || sale.boletoStatus === 'PENDING') && 'A enviar documento'}
                        {sale.boletoStatus === 'SENT' && 'Documento enviado'}
                        {sale.boletoStatus === 'PAID' && 'Finalizado'}
                    </div>
                </div>
            </div>
          </div>
        ))}
        {filteredSales.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <ClipboardList size={40} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-gray-500 font-medium">Nenhuma tarefa encontrada com este filtro.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default BoletoControl;
