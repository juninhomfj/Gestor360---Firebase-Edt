import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImportMapping } from '../types';
import { X, ArrowRight, Check, AlertTriangle, Table } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: any[][];
  onConfirm: (mapping: ImportMapping) => void;
  darkMode?: boolean;
}

const FIELDS = [
  { key: 'date', label: 'Data Faturamento (Opcional)', required: false },
  { key: 'completionDate', label: 'Data Pedido', required: false },
  { key: 'type', label: 'Tipo (Cesta Básica ou Natal)', required: true },
  { key: 'client', label: 'Cliente', required: true },
  { key: 'quantity', label: 'Quantidade', required: true },
  { key: 'valueProposed', label: 'Valor Unitário Proposto', required: true },
  { key: 'valueSold', label: 'Valor Total Venda', required: true },
  { key: 'margin', label: 'Margem (%)', required: true },
  { key: 'obs', label: 'Observações', required: false },
];

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, fileData, onConfirm, darkMode }) => {
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRow, setPreviewRow] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && fileData && fileData.length > 0) {
      const headerRow = fileData[0].map(cell => String(cell || '').trim());
      setHeaders(headerRow);
      const dataRow = fileData.slice(1).find(row => row.some(cell => !!cell));
      setPreviewRow(dataRow || []);

      const initialMap: ImportMapping = {};
      FIELDS.forEach(field => {
        const index = headerRow.findIndex(h => 
          h && (h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0]) || 
          h.toLowerCase().includes(field.key.toLowerCase()))
        );
        initialMap[field.key] = index !== -1 ? index : -1;
      });
      setMapping(initialMap);
    }
  }, [isOpen, fileData]);

  const handleMapChange = (fieldKey: string, colIndex: number) => {
    setMapping(prev => ({ ...prev, [fieldKey]: colIndex }));
  };

  const handleConfirm = () => {
    const missing = FIELDS.filter(f => f.required && (mapping[f.key] === undefined || mapping[f.key] === -1));
    if (missing.length > 0) {
      alert(`Mapeie as colunas obrigatórias: ${missing.map(f => f.label).join(', ')}`);
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
        
        <div className={`p-4 md:p-6 border-b ${borderClass} flex justify-between items-center shrink-0`}>
          <div>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Table size={20} className="text-emerald-500"/> Importar de Planilha</h2>
            <p className="text-xs md:text-sm opacity-60">Asocie as colunas do seu arquivo aos campos do sistema.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
          <div className={`p-4 rounded-lg border flex gap-3 ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
             <AlertTriangle size={20} className="text-blue-500 shrink-0 mt-0.5" />
             <div className="text-xs opacity-80">
                 <p className="font-bold mb-1">Dicas de Compatibilidade:</p>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Aceita .xlsx, .xls e .csv.</li>
                    <li>No tipo, escreva "Cesta Básica" ou "Natal".</li>
                    <li>Campos com <span className="text-red-500">*</span> são obrigatórios.</li>
                 </ul>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FIELDS.map(field => (
                <div key={field.key} className={`p-3 rounded-lg border ${borderClass} ${darkMode ? 'bg-slate-800/30' : 'bg-gray-50'}`}>
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <select 
                        className={`w-full text-sm rounded-lg p-2 ${inputBg}`}
                        value={mapping[field.key] ?? -1}
                        onChange={(e) => handleMapChange(field.key, Number(e.target.value))}
                    >
                        <option value={-1}>-- Ignorar --</option>
                        {headers.map((h, idx) => (
                            <option key={idx} value={idx}>{h || `Coluna ${idx + 1}`}</option>
                        ))}
                    </select>
                </div>
            ))}
          </div>
        </div>

        <div className={`p-4 md:p-6 border-t ${borderClass} flex justify-end gap-3 shrink-0 ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
          <button onClick={onClose} className="px-6 py-2 rounded-lg border font-bold text-sm">Cancelar</button>
          <button onClick={handleConfirm} className="px-8 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            Confirmar Importação <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImportModal;
