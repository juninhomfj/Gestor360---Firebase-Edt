
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, TrendingUp, X, Send, Copy, Bot, User, Mic, MicOff, StopCircle, PieChart, Wallet, Lightbulb, ExternalLink } from 'lucide-react';
import { sendMessageToAi, isAiAvailable } from '../services/aiService';
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
}

const QUICK_ACTIONS = [
    { label: 'Resumo Financeiro', prompt: 'Faça um resumo financeiro do mês atual, destacando receitas e despesas.', icon: <Wallet size={14}/> },
    { label: 'Análise de Gastos', prompt: 'Analise meus gastos e sugira onde posso economizar.', icon: <PieChart size={14}/> },
    { label: 'Previsão', prompt: 'Com base no histórico, qual a previsão para o próximo mês?', icon: <TrendingUp size={14}/> },
    { label: 'Dica Rápida', prompt: 'Me dê uma dica rápida sobre gestão financeira para hoje.', icon: <Lightbulb size={14}/> },
];

const AiConsultant: React.FC<AiConsultantProps> = ({ isOpen, onClose, sales, transactions, darkMode, userKeys }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<any[]>([]); // Gemini history format
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
      const w = window as any;
      if (w.webkitSpeechRecognition || w.SpeechRecognition) {
          const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
          const recog = new SpeechRecognition();
          recog.continuous = false;
          recog.interimResults = false;
          recog.lang = 'pt-BR';

          recog.onstart = () => setIsListening(true);
          recog.onend = () => setIsListening(false);
          
          recog.onresult = (event: any) => {
              const transcript = event.results[0][0].transcript;
              if (transcript) {
                  setInput(transcript);
                  setTimeout(() => handleSend(transcript), 500);
              }
          };

          recog.onerror = (event: any) => {
              console.error("Speech Error", event.error);
              setIsListening(false);
          };

          setRecognition(recog);
      }
  }, []);

  if (!isOpen) return null;

  const toggleListening = () => {
      if (!recognition) {
          alert("Seu navegador não suporta reconhecimento de voz.");
          return;
      }
      if (isListening) {
          recognition.stop();
      } else {
          recognition.start();
      }
  };

  // Safe check for Key presence and user preference
  const isEnabled = userKeys?.isGeminiEnabled && isAiAvailable();

  const handleSend = async (overrideText?: string) => {
      const textToSend = overrideText || input;
      if (!textToSend.trim()) return;
      
      if (!isAiAvailable()) {
          alert("IA indisponível no momento.");
          return;
      }
      
      const userMsg = textToSend;
      setInput('');
      setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
      setLoading(true);

      try {
          const result = await sendMessageToAi(userMsg, history, userKeys!, sales);
          setMessages(prev => [...prev, { role: 'model', text: result.text, grounding: result.grounding }]);
          setHistory(result.newHistory);
      } catch (e: any) {
          setMessages(prev => [...prev, { role: 'model', text: "Erro: " + e.message }]);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 flex justify-between items-center shrink-0 shadow-md relative z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md border border-white/20 shadow-inner">
                        <Sparkles className="text-white animate-pulse-slow" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-wide">Consultor IA Pro</h2>
                        <p className="text-indigo-100 text-[10px] font-medium flex items-center gap-2 uppercase tracking-wider opacity-80">
                            {userKeys?.aiPermissions?.canCreateTransactions ? '⚡ Automação' : '💬 Chat'} 
                            {userKeys?.aiPermissions?.canSearchWeb && '• 🌐 Online'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all">
                    <X size={24} />
                </button>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`} ref={scrollRef}>
                {!isAiAvailable() && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm text-center shadow-sm">
                        ⚠️ <strong>Serviço de IA não configurado no servidor.</strong>
                    </div>
                )}

                {messages.length === 0 && isEnabled && (
                    <div className="text-center py-12 flex flex-col items-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <Bot size={40} className="text-indigo-400 opacity-80" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Olá! Sou seu assistente financeiro.</p>
                        <p className="text-xs mt-2 text-gray-400 max-w-xs leading-relaxed">
                            Posso analisar seus dados, criar lançamentos ou dar dicas de economia. O que deseja fazer?
                        </p>
                        {recognition && (
                            <button onClick={toggleListening} className="mt-6 flex items-center gap-2 mx-auto bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-5 py-2.5 rounded-full text-xs font-bold border border-indigo-100 dark:border-slate-700 hover:scale-105 transition-transform shadow-sm">
                                <Mic size={14}/> Falar com IA
                            </button>
                        )}
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                        <div className={`flex items-end gap-2 max-w-[85%]`}>
                            {msg.role === 'model' && (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mb-1 shadow-sm">
                                    <Sparkles size={12} className="text-white"/>
                                </div>
                            )}
                            
                            <div className={`p-3.5 text-sm leading-relaxed shadow-sm flex flex-col gap-3 ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                                <div>
                                    {msg.text.split('\n').map((line, i) => (
                                        <p key={i} className="mb-1 last:mb-0">{line}</p>
                                    ))}
                                </div>

                                {/* Fix: ALWAYS extract and list grounding URLs if available */}
                                {msg.grounding && msg.grounding.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-1">
                                            <ExternalLink size={10}/> Fontes Consultadas:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {msg.grounding.map((chunk, cIdx) => (
                                                chunk.web && (
                                                    <a 
                                                        key={cIdx} 
                                                        href={chunk.web.uri} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="text-[10px] px-2 py-1 rounded bg-white/20 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/40 transition-colors flex items-center gap-1 max-w-[150px] truncate"
                                                        title={chunk.web.title}
                                                    >
                                                        {chunk.web.title || chunk.web.uri}
                                                    </a>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mb-1">
                                    <User size={12} className="text-gray-500 dark:text-gray-400"/>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start animate-in fade-in">
                        <div className="flex items-end gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mb-1">
                                <Sparkles size={12} className="text-white animate-spin"/>
                            </div>
                            <div className={`px-4 py-3 rounded-2xl rounded-tl-none ${darkMode ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area & Quick Actions */}
            <div className={`border-t ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                
                {/* Quick Actions Bar */}
                {isEnabled && !loading && (
                    <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-slate-800/50">
                        {QUICK_ACTIONS.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSend(action.prompt)}
                                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                                    darkMode 
                                    ? 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white border border-slate-700' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-600 hover:text-white border border-gray-200'
                                }`}
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="p-4 flex gap-2 items-center">
                    {recognition && (
                        <button 
                            onClick={toggleListening}
                            disabled={!isEnabled || loading}
                            className={`p-3 rounded-xl transition-all shadow-sm flex items-center justify-center ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' : (darkMode ? 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}`}
                            title="Comando de Voz"
                        >
                            {isListening ? <StopCircle size={20}/> : <Mic size={20}/>}
                        </button>
                    )}

                    <input 
                        type="text"
                        disabled={!isEnabled || loading}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        className={`flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${darkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                        placeholder={isEnabled ? (isListening ? "Ouvindo sua voz..." : "Digite sua dúvida...") : "IA Indisponível"}
                    />
                    <button 
                        onClick={() => handleSend()}
                        disabled={!isEnabled || loading || !input.trim()}
                        className={`p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${(!input.trim() || !isEnabled) ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'}`}
                    >
                        <Send size={20} />
                    </button>
                </div>
                
                <div className={`px-4 pb-2 text-[9px] text-center ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                    IA alimentada pelo Google Gemini. Seus dados são processados com segurança.
                </div>
            </div>
        </div>
    </div>
  );
};

export default AiConsultant;
