
import React from 'react';
import { X, ShieldCheck, Zap, MessageCircle, Split, Users, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface WhatsAppTutorialProps {
  onClose: () => void;
}

const WhatsAppTutorial: React.FC<WhatsAppTutorialProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
                <MessageCircle size={24} className="animate-pulse"/>
            </div>
            <div>
                <h2 className="text-xl font-bold">Domine o WhatsApp Marketing</h2>
                <p className="text-emerald-100 text-sm">Guia rápido de boas práticas e funcionalidades.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
            
            {/* SECTION 1: PLAYER */}
            <div className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-xl">1</div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">O Modo "Player" (Segurança Anti-Bloqueio)</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Diferente de robôs ilegais, o Gestor360 usa um "Player Manual". Nós geramos a fila, copiamos a mensagem e abrimos o WhatsApp Web para você. 
                        <strong>Você clica em enviar.</strong> Isso simula o comportamento humano natural e reduz drasticamente o risco de banimento.
                    </p>
                    <div className="mt-3 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
                        <ShieldCheck size={16}/> 
                        <span>Dica: Mantenha um intervalo de 10 a 20 segundos entre envios.</span>
                    </div>
                </div>
            </div>

            {/* SECTION 2: MEDIA (NEW) */}
            <div className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-bold text-xl">2</div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                        Envio de Mídia (Imagens/Vídeos) <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">NOVO</span>
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-3">
                        Para enviar imagens, usamos uma estratégia segura de "Área de Transferência":
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                        <li>No Player, clique em <strong>"1. Copiar Imagem"</strong>.</li>
                        <li>Clique em <strong>"2. Abrir WhatsApp"</strong>.</li>
                        <li>Quando o chat abrir, pressione <strong>Ctrl+V</strong> (Colar) e envie.</li>
                    </ol>
                </div>
            </div>

            {/* SECTION 3: A/B TESTING */}
            <div className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center font-bold text-xl">3</div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Teste A/B Integrado</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Na dúvida de qual texto converte mais? Ative o <strong>Teste A/B</strong> ao criar a campanha. 
                        O sistema alternará automaticamente entre a <em>Mensagem A</em> e a <em>Mensagem B</em>.
                        No final, verifique o Dashboard para ver qual teve mais sucesso.
                    </p>
                </div>
            </div>

            {/* SECTION 4: SMART IMPORT */}
            <div className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold text-xl">4</div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Importação Inteligente</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Não perca tempo cadastrando contatos. Use o botão <strong>"Importar de Vendas"</strong> na aba Contatos.
                        O sistema varre todo seu histórico de vendas, extrai telefones únicos e cria etiquetas automáticas (ex: "Cliente_Natal").
                    </p>
                </div>
            </div>

        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-end">
            <button 
                onClick={onClose}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
            >
                <Zap size={20} className="fill-current" /> Entendi, vamos vender!
            </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppTutorial;
