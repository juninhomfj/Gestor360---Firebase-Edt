import React, { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, ShoppingCart, X } from 'lucide-react';
import { AppMode } from '../types';

interface FABProps {
  appMode: AppMode;
  onNewSale: () => void;
  onNewIncome: () => void;
  onNewExpense: () => void;
  onNewTransfer: () => void;
}

const FAB: React.FC<FABProps> = ({ appMode, onNewSale, onNewIncome, onNewExpense, onNewTransfer }) => {
  const [isOpen, setIsOpen] = useState(false);

  // SALES MODE: Simple Button
  if (appMode === 'SALES') {
    return (
      <button
        onClick={onNewSale}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center"
        title="Nova Venda"
      >
        <Plus size={28} />
      </button>
    );
  }

  // FINANCE MODE: Speed Dial
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3">
      {/* Menu Items */}
      <div className={`transition-all duration-200 flex flex-col items-end space-y-3 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        
        <div className="flex items-center space-x-2">
            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 md:opacity-100 transition-opacity">Transferência</span>
            <button
                onClick={() => { onNewTransfer(); setIsOpen(false); }}
                className="w-10 h-10 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center"
            >
                <ArrowLeftRight size={20} />
            </button>
        </div>

        <div className="flex items-center space-x-2">
            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 md:opacity-100 transition-opacity">Nova Receita</span>
            <button
                onClick={() => { onNewIncome(); setIsOpen(false); }}
                className="w-10 h-10 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 flex items-center justify-center"
            >
                <TrendingUp size={20} />
            </button>
        </div>

        <div className="flex items-center space-x-2">
            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 md:opacity-100 transition-opacity">Nova Despesa</span>
            <button
                onClick={() => { onNewExpense(); setIsOpen(false); }}
                className="w-10 h-10 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 flex items-center justify-center"
            >
                <TrendingDown size={20} />
            </button>
        </div>
      </div>

      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isOpen ? 'bg-gray-700 text-white rotate-45' : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
      >
        <Plus size={28} />
      </button>
    </div>
  );
};

export default FAB;