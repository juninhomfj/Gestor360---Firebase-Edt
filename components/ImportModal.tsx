
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImportMapping } from '../types';
import { X, ArrowRight, Check, AlertTriangle, Table } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: any[][]; // Raw rows from Excel/CSV
  onConfirm: (mapping: ImportMapping) => void;
  darkMode?: boolean;
}

const FIELDS = [
  { key: 'date', label: 'Data Fat. (NF)', required: false },
  { key: 'completionDate', label: 'Data Pedido', required: false },
  { key: 'type', label: 'Tipo (Básica/Natal)', required: true },
  { key: 'client', label: 'Cliente', required: true },
  { key: 'quote', label: 'Nº Orçamento', required: false },
  { key: 'quantity', label: 'Qtd.', required: true },
  { key: 'valueProposed', label: 'Vlr. Proposto', required: true },
  { key: 'valueSold', label: 'Vlr. Venda', required: true },
  { key: 'margin', label: 'Margem (%)', required: true },
  { key: 'tracking', label: 'Rastreio', required: false },
  { key: 'boletoStatus', label: 'Status Boleto', required: false },
  { key: 'obs', label: 'Observações', required: false },
];

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, fileData, onConfirm, darkMode }) => {
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRow, setPreviewRow] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && fileData && fileData.length > 0) {
      // Assume first row is header
      const headerRow = fileData[0].map(cell => String(cell || '').trim());
      setHeaders(headerRow);
      
      // Assume second row is data (if exists)
      if (fileData.length > 1) {
        setPreviewRow(fileData[1]);
      } else {
        setPreviewRow([]);
      }

      // Auto-guess mapping based on header names
      const initialMap: ImportMapping = {};
      FIELDS.forEach(field => {
        const index = headerRow.findIndex(h => 
          h && (h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0]) || // Match "Data" in "Data Faturamento"
          h.toLowerCase() === field.key.toLowerCase())
        );
        if (index !== -1) {
          initialMap[field.key] = index;
        } else {
            initialMap[field.key] = -1; // Not mapped
        }
      });
      setMapping(initialMap);
    }
  }, [isOpen, fileData]);

  const handleMapChange = (fieldKey: string, colIndex: number) => {
    setMapping(prev => ({ ...prev, [fieldKey]: colIndex }));
  };

  const handleConfirm = () => {
    // Validate required fields
    const missing = FIELDS.filter(f => f.required && (mapping[f.key] === undefined || mapping[f.key] === -1));
    if (missing.length > 0) {
      alert(`Por favor, mapeie as colunas obrigatórias: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    onConfirm(mapping);
  };

  if (!isOpen) return null;

  const bgClass = darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-gray-900';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-2 md:p-4 backdrop-blur-sm">
      <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className={`p-4 md:p-6 border-b ${borderClass} flex justify-between items-center shrink-0`}>
          <div>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Table size={20} className="text-emerald-500"/> Validar Importação de Vendas
            </h2>
            <p className={`text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Relacione as colunas do arquivo com o sistema.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
          
          <div className={`p-4 rounded-lg border flex gap-3 ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
             <AlertTriangle size={20} className="text-blue-500 shrink-0 mt-0.5" />
             <div className="text-xs md:text-sm opacity-80">
                 <p className="font-bold mb-1">Dicas Importantes:</p>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Verifique se a <strong>primeira linha</strong> do seu arquivo contém os títulos.</li>
                    <li>
                        <strong>Valores Monetários:</strong> O sistema detecta automaticamente, mas prefira: <br/>
                        - Padrão BR: <code>1.000,00</code> (Vírgula para centavos)<br/>
                        - Padrão US: <code>1000.00</code> (Ponto para centavos)
                    </li>
                    <li>Campos marcados com <span className="text-red-500 font-bold">*</span> são obrigatórios.</li>
                 </ul>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {FIELDS.map(field => {
                const selectedIdx = mapping[field.key] ?? -1;
                const previewValue = selectedIdx !== -1 && previewRow[selectedIdx] !== undefined 
                    ? String(previewRow[selectedIdx]) 
                    : '-';

                return (
                    <div key={field.key} className={`p-3 rounded-lg border transition-all ${borderClass} ${darkMode ? 'bg-slate-800/30' : 'bg-gray-50 hover:bg-white hover:shadow-sm'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                {field.label} {field.required && <span className="text-red-500" title="Obrigatório">*</span>}
                            </label>
                            {selectedIdx !== -1 && <Check size={14} className="text-emerald-500"/>}
                        </div>
                        
                        <div className="space-y-2">
                            <select 
                                className={`w-full text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 ${inputBg}`}
                                value={selectedIdx}
                                onChange={(e) => handleMapChange(field.key, Number(e.target.value))}
                            >
                                <option value={-1}>-- Ignorar Coluna --</option>
                                {headers.map((h, idx) => (
                                    <option key={idx} value={idx}>
                                        {h} (Col {idx + 1})
                                    </option>
                                ))}
                            </select>

                            <div className={`text-xs p-2 rounded border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-gray-200 text-gray-500'}`}>
                                <span className="block text-[10px] uppercase font-bold opacity-50 mb-0.5">Pré-visualização (Linha 1):</span>
                                <div className="font-mono truncate h-4" title={previewValue}>
                                    {previewValue}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 md:p-6 border-t ${borderClass} flex flex-col sm:flex-row justify-end gap-3 shrink-0 bg-opacity-50 ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
          <button 
            onClick={onClose}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg border font-bold text-sm transition-colors ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-white text-gray-700'}`}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
          >
            Confirmar Importação <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImportModal;
