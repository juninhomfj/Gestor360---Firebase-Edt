
import React, { useState, useEffect } from 'react';
import { Mail, Send, Bug, Download, Cloud, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { getSystemConfig } from '../services/logic';
import { Logger } from '../services/logger';

const Help: React.FC = () => {
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
      getSystemConfig().then(cfg => {
          setEmail(cfg.supportEmail || 'hypelab3@gmail.com');
          setTelegram(cfg.supportTelegram || 'naosoub0t');
      });
  }, []);

  const handleUploadLogs = async () => {
      setLoading(true);
      setStatusMsg(null);
      
      const success = await Logger.exportLogsToDrive();
      
      if (success) {
          setStatusMsg({ type: 'success', text: 'Relatório baixado no seu dispositivo.' });
      } else {
          setStatusMsg({ type: 'error', text: 'Falha ao gerar relatório.' });
      }
      setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">
      <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
              <Info size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Central de Ajuda</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
              Precisa de assistência ou encontrou um problema?
          </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* EMAIL CARD */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center hover:border-blue-300 transition-colors">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-lg flex items-center justify-center mb-4">
                  <Mail size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Suporte via E-mail</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Envie detalhes do seu problema ou sugestão.
              </p>
              <a 
                href={`mailto:${email}`} 
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline break-all"
              >
                  {email}
              </a>
          </div>

          {/* TELEGRAM CARD */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center hover:border-blue-300 transition-colors">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/20 text-sky-500 rounded-lg flex items-center justify-center mb-4">
                  <Send size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Suporte via Telegram</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Contato direto para dúvidas rápidas.
              </p>
              <a 
                href={`https://t.me/${telegram.replace('@', '')}`} 
                target="_blank"
                rel="noreferrer"
                className="bg-sky-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-sky-600 transition-colors flex items-center gap-2"
              >
                  <Send size={16} /> Abrir Telegram
              </a>
          </div>
      </div>

      {/* DIAGNOSTICS & LOGS */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
              <Bug className="text-amber-500" size={24} />
              <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Relatório de Erros</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                      Se o sistema apresentou falhas, gere um log para análise técnica.
                  </p>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  O sistema gera logs automáticos de erros críticos. Clique abaixo para baixar o arquivo e enviar ao suporte.
              </p>
              
              {statusMsg && (
                  <div className={`p-3 rounded-lg text-sm flex items-start gap-2 mb-3 ${statusMsg.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {statusMsg.type === 'success' ? <CheckCircle size={16} className="mt-0.5"/> : <AlertTriangle size={16} className="mt-0.5"/>}
                      {statusMsg.text}
                  </div>
              )}

              <button 
                onClick={handleUploadLogs}
                disabled={loading}
                className="w-full sm:w-auto bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                  {loading ? <span className="animate-spin">⏳</span> : <Download size={18} />}
                  {loading ? 'Gerando...' : 'Baixar Relatório de Logs'}
              </button>
          </div>
          
          <p className="text-[10px] text-gray-400 text-center">
              ID do Dispositivo: <span className="font-mono">{localStorage.getItem('device_id') || 'N/A'}</span>
          </p>
      </div>
    </div>
  );
};

export default Help;
