
import React, { useState, useEffect } from 'react';
import { CommissionRule, ProductType } from '../types';
import { Save, Plus, Trash2, Lock, Download, Upload } from 'lucide-react';

interface CommissionEditorProps {
  initialRules: CommissionRule[];
  type: ProductType;
  onSave: (type: ProductType, rules: CommissionRule[]) => void;
  readOnly?: boolean;
}

const CommissionEditor: React.FC<CommissionEditorProps> = ({ initialRules, type, onSave, readOnly = false }) => {
  const [rules, setRules] = useState<{ id: string; minPercent: string; maxPercent: string; commissionRate: string; }[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Essencial: Atualizar o estado sempre que o TIPO mudar para evitar "vazamento" de dados
  useEffect(() => {
      if (initialRules) {
          setRules(initialRules.sort((a,b) => a.minPercent - b.minPercent).map(r => ({
              id: r.id,
              minPercent: r.minPercent.toString(),
              maxPercent: r.maxPercent === null ? '' : r.maxPercent.toString(),
              commissionRate: (r.commissionRate * 100).toString()
          })));
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
    const finalRules: CommissionRule[] = rules.map(r => ({
        id: r.id,
        minPercent: parseFloat(r.minPercent) || 0,
        maxPercent: r.maxPercent === '' ? null : parseFloat(r.maxPercent),
        commissionRate: (parseFloat(r.commissionRate) || 0) / 100
    }));
    onSave(type, finalRules); // Passa o tipo explicitamente
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
                  setRules(imported);
                  setIsDirty(true);
              }
          } catch (err) { alert("Formato inválido."); }
      };
      reader.readAsText(file);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden relative">
      <div className={`p-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-950 flex justify-between items-center`}>
        <h3 className="text-lg font-bold">Configurando: {type}</h3>
        <div className="flex gap-2">
            {!readOnly && (
                <>
                    <label className="p-2 cursor-pointer hover:bg-white/10 rounded text-gray-600"><Upload size={18}/><input type="file" className="hidden" accept=".json" onChange={handleImport}/></label>
                    <button onClick={() => {
                        const blob = new Blob([JSON.stringify(rules)], {type:'application/json'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `comissao_${type.toLowerCase()}.json`; a.click();
                    }} className="p-2 hover:bg-white/10 rounded text-gray-600"><Download size={18}/></button>
                </>
            )}
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-12 gap-2 mb-4 text-[10px] font-black uppercase text-gray-400">
          <div className="col-span-3">Margem Min (%)</div>
          <div className="col-span-3">Margem Max (%)</div>
          <div className="col-span-4">Taxa Comissão (%)</div>
          <div className="col-span-2"></div>
        </div>

        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3"><input type="number" className="w-full bg-transparent border rounded p-2 text-sm" value={rule.minPercent} onChange={(e) => handleChange(rule.id, 'minPercent', e.target.value)} disabled={readOnly}/></div>
              <div className="col-span-3"><input type="number" className="w-full bg-transparent border rounded p-2 text-sm" value={rule.maxPercent} placeholder="Acima" onChange={(e) => handleChange(rule.id, 'maxPercent', e.target.value)} disabled={readOnly}/></div>
              <div className="col-span-4 relative"><input type="number" className="w-full bg-transparent border-2 border-emerald-500/20 rounded p-2 text-sm font-bold" value={rule.commissionRate} onChange={(e) => handleChange(rule.id, 'commissionRate', e.target.value)} disabled={readOnly}/></div>
              <div className="col-span-2 flex justify-center">{!readOnly && <button onClick={() => removeRule(rule.id)} className="text-red-500"><Trash2 size={16} /></button>}</div>
            </div>
          ))}
        </div>

        {!readOnly && (
            <div className="mt-6 flex justify-between items-center border-t dark:border-slate-800 pt-6">
                <button onClick={addRule} className="text-sm font-bold text-indigo-500 flex items-center gap-2"><Plus size={16} /> Adicionar Faixa</button>
                <button onClick={handleSave} disabled={!isDirty} className={`px-8 py-2 rounded-lg font-bold transition-all ${isDirty ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>Salvar Alterações</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default CommissionEditor;
