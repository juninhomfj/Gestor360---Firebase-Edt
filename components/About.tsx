
import React from 'react';
import { ShoppingBag, Heart, Cpu } from 'lucide-react';
import BrazilFlag from './BrazilFlag';

const About: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-in fade-in zoom-in duration-500 pb-24">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-6 rounded-2xl shadow-xl mb-8 transform hover:scale-110 transition-transform duration-300">
        <ShoppingBag size={64} className="text-white" />
      </div>
      
      <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 mb-2">
        Gestor360
      </h1>
      <p className="text-gray-500 text-lg mb-8 max-w-md">
        Sistema integrado de gestão de comissões, vendas e inteligência comercial.
      </p>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 max-w-2xl w-full text-left space-y-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white border-b dark:border-slate-700 pb-2 flex items-center gap-2">
            <Cpu size={20} className="text-blue-500"/> Sobre o Sistema
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
            Versão: <span className="font-mono bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700">2.0 (Stable)</span>
        </p>
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            Este aplicativo foi desenvolvido para otimizar o fluxo de representantes comerciais, permitindo cálculo preciso de margens complexas e controle financeiro completo com Inteligência Artificial Gemini.
        </p>
        
        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-700">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Créditos & Origem</h3>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-gray-800 dark:text-gray-200">
                <div className="flex items-center space-x-2">
                    <span>Desenvolvido com</span>
                    <Heart size={16} className="text-red-500 fill-current animate-pulse" />
                    <span>por <strong>Hypelab</strong></span>
                </div>

                <BrazilFlag />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center md:text-left">
                Todos os direitos reservados &copy; {new Date().getFullYear()}
            </p>
        </div>
      </div>
    </div>
  );
};

export default About;
