
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, LayoutDashboard, ShoppingCart, PieChart, Users, Settings, Moon, Sun, Monitor, LogOut, Plus, DollarSign, User, ShieldCheck } from 'lucide-react';
import { AppMode, AppTheme } from '../types';
import { dbGetAll } from '../storage/db';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setAppMode: (mode: AppMode) => void;
  setActiveTab: (tab: string) => void;
  setTheme: (theme: AppTheme) => void;
  onLogout: () => void;
  onNewSale: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ 
    isOpen, onClose, setAppMode, setActiveTab, setTheme, onLogout, onNewSale 
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dbResults, setDbResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const staticActions = [
      { id: 'goto_dashboard', label: 'Ir para Dashboard', icon: <LayoutDashboard size={16}/>, group: 'Navegação', action: () => { setAppMode('SALES'); setActiveTab('dashboard'); } },
      { id: 'goto_sales', label: 'Ir para Vendas', icon: <ShoppingCart size={16}/>, group: 'Navegação', action: () => { setAppMode('SALES'); setActiveTab('sales'); } },
      { id: 'goto_finance', label: 'Ir para Finanças', icon: <PieChart size={16}/>, group: 'Navegação', action: () => { setAppMode('FINANCE'); setActiveTab('fin_dashboard'); } },
      { id: 'goto_crm', label: 'Ir para Hub de Clientes', icon: <Users size={16}/>, group: 'Navegação', action: () => { setAppMode('SALES'); setActiveTab('settings'); } },
      { id: 'new_sale', label: 'Nova Venda', icon: <Plus size={16}/>, group: 'Ações', action: () => onNewSale() },
      { id: 'theme_dark', label: 'Tema Escuro', icon: <Moon size={16}/>, group: 'Aparência', action: () => setTheme('dark') },
      { id: 'theme_light', label: 'Tema Claro', icon: <Sun size={16}/>, group: 'Aparência', action: () => setTheme('neutral') },
      { id: 'theme_glass', label: 'Tema Glass', icon: <Monitor size={16}/>, group: 'Aparência', action: () => setTheme('glass') },
      { id: 'logout', label: 'Sair do Sistema', icon: <LogOut size={16}/>, group: 'Sistema', action: () => onLogout() },
  ];

  useEffect(() => {
      if (isOpen) {
          setTimeout(() => inputRef.current?.focus(), 50);
          setSelectedIndex(0);
          setSearch('');
          setDbResults([]);
      }
  }, [isOpen]);

  // Omni-Search Logic
  useEffect(() => {
      if (search.length < 2) {
          setDbResults([]);
          return;
      }

      const performSearch = async () => {
          const [sales, trans, clients] = await Promise.all([
              dbGetAll('sales'),
              dbGetAll('transactions'),
              dbGetAll('clients')
          ]);

          const lower = search.toLowerCase();
          
          const results: any[] = [];

          clients.filter(c => !c.deleted && c.name.toLowerCase().includes(lower)).forEach(c => {
              results.push({ id: `cli_${c.id}`, label: c.name, group: 'Clientes', icon: <User size={16}/>, action: () => { setAppMode('SALES'); setActiveTab('settings'); } });
          });

          sales.filter(s => !s.deleted && s.client.toLowerCase().includes(lower)).forEach(s => {
              results.push({ id: `sale_${s.id}`, label: `Venda: ${s.client} - R$ ${s.valueSold}`, group: 'Vendas', icon: <ShoppingCart size={16} className="text-emerald-500"/>, action: () => { setAppMode('SALES'); setActiveTab('sales'); } });
          });

          trans.filter(t => !t.deleted && t.description.toLowerCase().includes(lower)).forEach(t => {
              results.push({ id: `tx_${t.id}`, label: `Transação: ${t.description}`, group: 'Finanças', icon: <DollarSign size={16} className="text-blue-500"/>, action: () => { setAppMode('FINANCE'); setActiveTab('fin_transactions'); } });
          });

          setDbResults(results.slice(0, 10));
      };

      performSearch();
  }, [search]);

  const filteredActions = [
      ...staticActions.filter(a => a.label.toLowerCase().includes(search.toLowerCase())),
      ...dbResults
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredActions[selectedIndex]) {
              filteredActions[selectedIndex].action();
              onClose();
          }
      } else if (e.key === 'Escape') {
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
        <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-slate-800">
                <Search className="text-gray-400" size={20} />
                <input 
                    ref={inputRef}
                    className="flex-1 bg-transparent outline-none text-lg text-gray-800 dark:text-white placeholder-gray-400"
                    placeholder="Busque vendas, clientes, transações ou comandos..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={handleKeyDown}
                />
                <div className="text-xs font-bold text-gray-400 border border-gray-200 dark:border-slate-700 px-2 py-1 rounded">ESC</div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar">
                {filteredActions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum resultado encontrado.</div>
                ) : (
                    filteredActions.map((action, idx) => (
                        <button
                            key={action.id}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                idx === selectedIndex 
                                ? 'bg-indigo-600 text-white' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                            onClick={() => { action.action(); onClose(); }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                        >
                            <div className={idx === selectedIndex ? 'text-white' : 'text-gray-400'}>{action.icon}</div>
                            <div className="flex-1">
                                <span className="block font-medium text-sm">{action.label}</span>
                                <span className={`text-[10px] opacity-70 ${idx === selectedIndex ? 'text-indigo-200' : 'text-gray-400'}`}>{action.group}</span>
                            </div>
                            {idx === selectedIndex && <ArrowRight size={16} className="text-white"/>}
                        </button>
                    ))
                )}
            </div>
            
            <div className="p-2 bg-gray-50 dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 flex justify-between px-4">
                <span className="flex items-center gap-1"><ShieldCheck size={10}/> Omni-Search v2.7</span>
                <div className="flex gap-2">
                    <span>⇅ Selecionar</span>
                    <span>↵ Confirmar</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default CommandPalette;
