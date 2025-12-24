
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, TrendingUp, X, Send, Copy, Bot, User, Mic, MicOff, PieChart, Wallet, Lightbulb, ExternalLink, Volume2, Loader2 } from 'lucide-react';
import { sendMessageToAi, isAiAvailable, generateAudioMessage } from '../services/aiService';
import { Sale, Transaction, UserKeys } from '../types';

interface AiConsultantProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  transactions: Transaction[];
  darkMode?: boolean;
  userKeys?: UserKeys;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    grounding?: any[];
    audioUrl?: string;
}

const QUICK_ACTIONS = [
    { label: 'Ritmo Financeiro', prompt: 'Calcule meu ritmo financeiro atual e me dê uma previsão de caixa.', icon: <TrendingUp size={14}/> },
    { label: 'Análise de ROI', prompt: 'Qual foi o retorno das minhas últimas campanhas de marketing?', icon: <PieChart size={14}/> },
    { label: 'Notícias Mercado', prompt: 'Pesquise as últimas tendências do mercado de cestas básicas e benefícios no Brasil.', icon: <ExternalLink size={14}/> },
];

const AiConsultant: React.FC<AiConsultantProps> = ({ isOpen, onClose, sales, transactions, darkMode, userKeys }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (overrideText?: string) => {
      const textToSend = overrideText || input;
      if (!textToSend.trim() || loading) return;
      
      setInput('');
      setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
      setLoading(true);

      try {
          const result = await sendMessageToAi(textToSend, history, userKeys!, sales);
          setMessages(prev => [...prev, { role: 'model', text: result.text, grounding: result.grounding }]);
          setHistory(result.newHistory);
      } catch (e: any) {
          setMessages(prev => [...prev, { role: 'model', text: "Ocorreu um erro técnico: " + e.message }]);
      } finally {
          setLoading(false);
      }
  };

  const handleTTS = async (text: string, idx: number) => {
      if (messages[idx].audioUrl) {
          new Audio(messages[idx].audioUrl).play();
          return;
      }
      
      const audioData = await generateAudioMessage(text);
      if (audioData) {
          setMessages(prev => prev.map((m, i) => i === idx ? { ...m, audioUrl: audioData } : m));
          new Audio(audioData).play();
      }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                    <Sparkles className="animate-pulse" size={24} />
                    <div>
                        <h2 className="font-bold tracking-tight">Consultor Gestor360</h2>
                        <p className="text-[10px] uppercase font-black tracking-widest opacity-70">IA Estratégica Nativa</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`} ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center py-12 flex flex-col items-center">
                        <Bot size={48} className="text-indigo-500 mb-4 opacity-50" />
                        <p className="text-sm font-medium text-gray-500">Olá! Como posso ajudar na sua estratégia hoje?</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : (darkMode ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700' : 'bg-white text-gray-800 rounded-tl-none')}`}>
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                            
                            {msg.role === 'model' && (
                                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2 items-center">
                                    <button onClick={() => handleTTS(msg.text, idx)} className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors" title="Ouvir Resposta">
                                        <Volume2 size={14}/>
                                    </button>
                                    
                                    {msg.grounding?.map((chunk, cIdx) => chunk.web && (
                                        <a key={cIdx} href={chunk.web.uri} target="_blank" className="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-600 transition-colors">
                                            <ExternalLink size={10}/> {chunk.web.title || 'Ver Fonte'}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && <div className="flex gap-1 ml-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-200"></div></div>}
            </div>

            <div className={`p-4 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-2">
                    {QUICK_ACTIONS.map((a, i) => (
                        <button key={i} onClick={() => handleSend(a.prompt)} className="whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-bold border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                            {a.icon} {a.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        className={`flex-1 p-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'}`}
                        placeholder="Pergunte qualquer coisa sobre seu negócio..."
                    />
                    <button onClick={() => handleSend()} className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-900/20 transition-all">
                        <Send size={20}/>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AiConsultant;
