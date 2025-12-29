
import React, { useState, useEffect } from 'react';
import { CommissionRule, ProductType, User } from '../types';
import { Save, Plus, Trash2, Lock, Download, Upload, AlertCircle } from 'lucide-react';

interface CommissionEditorProps {
  initialRules: CommissionRule[];
  type: ProductType;
  onSave: (type: ProductType, rules: CommissionRule[]) => void;
  readOnly?: boolean;
  currentUser: User;
}

const CommissionEditor: React.FC<CommissionEditorProps> = ({ initialRules, type, onSave, readOnly = false, currentUser }) => {
  const [rules, setRules] = useState<{ id: string; minPercent: string; maxPercent: string; commissionRate: string; }[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Sincroniza estado interno com as regras vindas do banco/pai
  useEffect(() => {
    if (initialRules) {
      const sanitized = initialRules
        .sort((a, b) => a.minPercent - b.minPercent)
        .map(r => {
          // BUG FIX: Garante que se o valor no banco estiver como 5 (antigo bug), ele seja tratado como 0.05
          // O padrão correto no banco é decimal (ex: 0.05 para 5%)
          let rate = r.commissionRate;
          if (rate > 1) rate = rate / 100; 

          return {
            id: r.id,
            minPercent: r.minPercent.toString(),
            maxPercent: r.maxPercent === null ? '' : r.maxPercent.toString(),
            commissionRate: (rate * 100).toFixed(2).replace(/\.00$/, '')
          };
        });
      setRules(sanitized);
      setIsDirty(false);
    }
  }, [type, initialRules]);

  const handleChange = (id: string, field: string, value: string) => {
    if (readOnly) return;
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value.replace(',', '.') } : r));
    setIsDirty(true);
  };

  const addRule = () => {
    setRules([...rules, { id: crypto.randomUUID(), minPercent: '0', maxPercent: '', commissionRate: '0' }]);
    setIsDirty(true);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    setIsDirty(true);
  };

  const handleSave = () => {
    // Converte de volta para decimais antes de salvar no Firestore
    const finalRules: CommissionRule[] = rules.map(r => ({
      id: r.id,
      minPercent: parseFloat(r.minPercent) || 0,
      maxPercent: r.maxPercent === '' ? null : parseFloat(r.maxPercent),
      commissionRate: (parseFloat(r.commissionRate) || 0) / 100,
      isActive: true
    }));
    onSave(type, finalRules);
    setIsDirty(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setRules(imported.map((r: any) => {
            // LÓGICA DE PROTEÇÃO: Detecta se o arquivo importado usa 0.05 ou 5
            let rate = parseFloat(r.commissionRate) || 0;
            if (rate > 0 && rate < 1) {
              // Se for decimal (0.04), converte para exibição (4)
              rate = rate * 100;
            } else if (rate > 100) {
              // Se for um valor absurdo (400), tenta corrigir para (4)
              rate = rate / 100;
            }
            
            return {
              id: r.id || crypto.randomUUID(),
              minPercent: (r.minPercent || 0).toString(),
              maxPercent: r.maxPercent === null ? '' : (r.maxPercent || '').toString(),
              commissionRate: rate.toString()
            };
          }));
          setIsDirty(true);
        }
      } catch (err) {
        alert("Erro no formato do arquivo. Certifique-se que é um JSON válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden relative">
      <div className={`p-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-950 flex justify-between items-center`}>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold">Tabela de Comissão: {type === ProductType.BASICA ? 'Cesta Básica' : 'Natal'}</h3>
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <>
              <label className="p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded text-gray-600 dark:text-gray-400" title="Importar Tabela">
                <Upload size={18} />
                <input type="file" className="hidden" accept=".json" onChange={handleImport} />
              </label>
              <button
                onClick={() => {
                  const finalRules = rules.map(r => ({
                    id: r.id,
                    minPercent: parseFloat(r.minPercent) || 0,
                    maxPercent: r.maxPercent === '' ? null : parseFloat(r.maxPercent),
                    commissionRate: (parseFloat(r.commissionRate) || 0) / 100,
                    isActive: true
                  }));
                  const blob = new Blob([JSON.stringify(finalRules, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tabela_comissao_${type.toLowerCase()}.json`;
                  a.click();
                }}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded text-gray-600 dark:text-gray-400"
                title="Exportar Tabela"
              >
                <Download size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-12 gap-2 mb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">
          <div className="col-span-3">Margem Min (%)</div>
          <div className="col-span-3">Margem Max (%)</div>
          <div className="col-span-4">Comissão (%)</div>
          <div className="col-span-2"></div>
        </div>

        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="grid grid-cols-12 gap-2 items-center animate-in fade-in duration-300">
              <div className="col-span-3">
                <input type="number" step="0.01" className="w-full bg-transparent border rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={rule.minPercent} onChange={(e) => handleChange(rule.id, 'minPercent', e.target.value)} disabled={readOnly} />
              </div>
              <div className="col-span-3">
                <input type="number" step="0.01" className="w-full bg-transparent border rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={rule.maxPercent} placeholder="Acima" onChange={(e) => handleChange(rule.id, 'maxPercent', e.target.value)} disabled={readOnly} />
              </div>
              <div className="col-span-4">
                <div className="relative">
                  <input type="number" step="0.01" className="w-full bg-transparent border-2 border-emerald-500/20 rounded p-2 text-sm font-bold focus:border-emerald-500 outline-none" value={rule.commissionRate} onChange={(e) => handleChange(rule.id, 'commissionRate', e.target.value)} disabled={readOnly} />
                  <span className="absolute right-3 top-2 text-xs font-bold text-emerald-600">%</span>
                </div>
              </div>
              <div className="col-span-2 flex justify-center">
                {!readOnly && (
                  <button onClick={() => removeRule(rule.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="text-center py-12 bg-gray-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
              <p className="text-gray-400 text-sm italic">Nenhuma regra definida. Adicione faixas ou importe um arquivo.</p>
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 dark:border-slate-800 pt-6">
            <button onClick={addRule} className="w-full sm:w-auto text-sm font-bold text-indigo-500 flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-4 py-2 rounded-lg transition-all">
              <Plus size={16} /> Adicionar Faixa
            </button>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {isDirty && (
                <span className="text-[10px] font-black text-amber-500 uppercase animate-pulse flex items-center gap-1">
                  <AlertCircle size={12}/> Alterações Pendentes
                </span>
              )}
              <button 
                onClick={handleSave} 
                disabled={!isDirty} 
                className={`w-full sm:w-auto px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${isDirty ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionEditor;
