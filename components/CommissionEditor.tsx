
import React, { useState } from 'react';
import { CommissionRule, ProductType } from '../types';
import { Save, Plus, Trash2, AlertCircle, Lock, MessageSquare, Download, Upload } from 'lucide-react';
import { sendMessage } from '../services/internalChat';

interface CommissionEditorProps {
  initialRules: CommissionRule[];
  type: ProductType;
  onSave: (rules: CommissionRule[]) => void;
  readOnly?: boolean; // New Prop
  currentUser?: any; // To send message
}

const CommissionEditor: React.FC<CommissionEditorProps> = ({ initialRules, type, onSave, readOnly = false, currentUser }) => {
  const [rules, setRules] = useState<{
      id: string;
      minPercent: string;
      maxPercent: string;
      commissionRate: string; 
  }[]>(
    (initialRules || [])
    .sort((a, b) => a.minPercent - b.minPercent)
    .map(r => ({
        id: r.id,
        minPercent: r.minPercent.toString(),
        maxPercent: r.maxPercent === null ? '' : r.maxPercent.toString(),
        commissionRate: (r.commissionRate * 100).toString()
    }))
  );
  
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (id: string, field: string, value: string) => {
    if (readOnly) return;
    const cleanValue = value.replace(',', '.');
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      return { ...r, [field]: cleanValue };
    }));
    setIsDirty(true);
  };

  const addRule = () => {
    if (readOnly) return;
    const newRule = {
      id: crypto.randomUUID(),
      minPercent: '0',
      maxPercent: '0',
      commissionRate: '0'
    };
    setRules([...rules, newRule]);
    setIsDirty(true);
  };

  const removeRule = (id: string) => {
    if (readOnly) return;
    setRules(rules.filter(r => r.id !== id));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (readOnly) return;
    const finalRules: CommissionRule[] = rules.map(r => ({
        id: r.id,
        minPercent: parseFloat(r.minPercent) || 0,
        maxPercent: r.maxPercent === '' ? null : (parseFloat(r.maxPercent) || 0),
        commissionRate: (parseFloat(r.commissionRate) || 0) / 100
    }));

    const sorted = finalRules.sort((a, b) => a.minPercent - b.minPercent);
    onSave(sorted);
    
    setRules(sorted.map(r => ({
        id: r.id,
        minPercent: r.minPercent.toString(),
        maxPercent: r.maxPercent === null ? '' : r.maxPercent.toString(),
        commissionRate: (r.commissionRate * 100).toString()
    })));
    
    setIsDirty(false);
  };

  const handleRequestChange = async () => {
      if (currentUser) {
          const tableName = type === ProductType.BASICA ? 'Básica' : (type === ProductType.NATAL ? 'Natal' : 'Custom');
          await sendMessage(currentUser, `Solicito alteração na tabela de comissão: ${tableName}`, 'CHAT');
          alert("Solicitação enviada ao administrador.");
      }
  };

  const handleExport = () => {
      const dataStr = JSON.stringify(rules, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comissao_${type.toLowerCase()}.json`;
      a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              const importedRules = JSON.parse(content);
              if (Array.isArray(importedRules)) {
                  setRules(importedRules);
                  setIsDirty(true);
                  alert("Tabela importada! Clique em Salvar para confirmar.");
              }
          } catch (err) {
              alert("Erro ao ler arquivo. Formato inválido.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset
  };

  let colorClass = 'emerald';
  let title = 'Cesta Básica';

  if (type === ProductType.NATAL) {
      colorClass = 'red';
      title = 'Cesta de Natal';
  } else if (type === ProductType.CUSTOM) {
      colorClass = 'blue';
      title = 'Tabela Personalizada';
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative`}>
      {readOnly && (
          <div className="absolute top-0 right-0 p-2 bg-gray-100 rounded-bl-xl text-gray-500 text-xs font-bold flex items-center gap-1 z-10 border-l border-b border-gray-200">
              <Lock size={12} /> Somente Leitura (Global)
          </div>
      )}

      <div className={`p-4 border-b border-gray-100 bg-${colorClass}-50 flex justify-between items-center`}>
        <h3 className={`text-lg font-bold text-${colorClass}-800`}>Tabela: {title}</h3>
        <div className="flex gap-2">
            {!readOnly && (
                <>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-white rounded text-gray-600" title="Importar JSON">
                        <Upload size={16}/>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport}/>
                </>
            )}
            <button onClick={handleExport} className="p-1.5 hover:bg-white rounded text-gray-600" title="Exportar JSON">
                <Download size={16}/>
            </button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">De (%)</div>
          <div className="col-span-3">Até (%) <span className="text-[10px] lowercase font-normal">(vazio = acima de)</span></div>
          <div className="col-span-4">Comissão (%)</div>
          <div className="col-span-2 text-center">Ação</div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {rules.map((rule) => (
            <div key={rule.id} className="grid grid-cols-12 gap-2 items-center group">
              <div className="col-span-3">
                <input 
                  type="number" 
                  step="0.01"
                  className={`w-full bg-white text-gray-900 border border-gray-300 rounded p-1.5 text-sm ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  value={rule.minPercent}
                  onChange={(e) => handleChange(rule.id, 'minPercent', e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="col-span-3">
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="∞"
                  className={`w-full bg-white text-gray-900 border border-gray-300 rounded p-1.5 text-sm ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  value={rule.maxPercent}
                  onChange={(e) => handleChange(rule.id, 'maxPercent', e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="col-span-4 relative">
                <input 
                  type="number" 
                  step="0.01"
                  className={`w-full bg-white text-gray-900 border border-gray-300 rounded p-1.5 text-sm pr-6 font-semibold ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  value={rule.commissionRate}
                  onChange={(e) => handleChange(rule.id, 'commissionRate', e.target.value)}
                  disabled={readOnly}
                />
                <span className="absolute right-2 top-1.5 text-gray-400 text-sm">%</span>
              </div>
              <div className="col-span-2 flex justify-center">
                {!readOnly && (
                    <button 
                      onClick={() => removeRule(rule.id)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded-md transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-100">
           {!readOnly ? (
               <>
                   <button 
                    onClick={addRule}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Plus size={16} className="mr-1" />
                    Adicionar Faixa
                  </button>

                  <button 
                    onClick={handleSave}
                    disabled={!isDirty}
                    className={`px-4 py-2 rounded-lg flex items-center font-medium shadow-sm transition-all ${
                        isDirty 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Save size={18} className="mr-2" />
                    Salvar Alterações
                  </button>
               </>
           ) : (
               <div className="w-full flex justify-center">
                   <button onClick={handleRequestChange} className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-2">
                       <MessageSquare size={16} /> Solicitar alteração no Suporte
                   </button>
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default CommissionEditor;
