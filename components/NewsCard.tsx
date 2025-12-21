
import React, { useState } from 'react';
import { ChevronRight, Calendar, Tag, X } from 'lucide-react';

export interface NewsItem {
  id: number;
  title: string;
  date: string;
  summary: string;
  content: string;
  category: string;
}

const NewsCard: React.FC<{ news: NewsItem }> = ({ news }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
        <div 
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 cursor-pointer card-hover-glow relative overflow-hidden group"
          onClick={() => setIsModalOpen(true)}
        >
          {/* Subtle bg decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150 duration-500 pointer-events-none"></div>

          <div className="flex justify-between items-start mb-3 relative z-10">
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md tracking-wide ${
                news.category === 'Sistema' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                news.category === 'Mercado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
                {news.category}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar size={12}/> {news.date}
            </span>
          </div>
          
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
              {news.title}
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
              {news.summary}
          </p>
          
          <div className="mt-4 flex items-center text-xs font-bold text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
              Ler completo <ChevronRight size={14} className="ml-1"/>
          </div>
        </div>

        {/* MODAL DE LEITURA */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start">
                        <div className="pr-8">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    {news.category}
                                </span>
                                <span className="text-xs text-gray-400">{news.date}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                                {news.title}
                            </h2>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsModalOpen(false); }}
                            className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X size={20} className="text-gray-500 dark:text-gray-300" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-loose">
                            {news.content.split('\n').map((paragraph, idx) => (
                                <p key={idx} className="mb-4">{paragraph}</p>
                            ))}
                        </div>
                        
                        {/* Tags / Extra Meta */}
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-wrap gap-2">
                            <span className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-slate-800 rounded-md">
                                <Tag size={12}/> {news.category}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-slate-800 rounded-md">
                                <Tag size={12}/> Gestor360
                            </span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default NewsCard;
