
import React, { useState } from 'react';
import { BookOpen, Award, PieChart, TrendingUp, Sparkles, MessageCircle, X, ChevronRight, Play, CheckCircle, Calculator, ShieldCheck, Zap } from 'lucide-react';

interface TrainingHubProps {
  onClose: () => void;
  darkMode: boolean;
}

const COURSES = [
    {
        id: 'abc',
        title: 'Domine a Curva ABC',
        desc: 'Aprenda a priorizar os 20% de clientes que trazem 80% do seu lucro.',
        icon: <Award className="text-amber-500" />,
        color: 'bg-amber-100 dark:bg-amber-900/30',
        content: [
            'A Curva ABC classifica seus clientes por faturamento acumulado.',
            'Classe A: Representam os 70% iniciais do seu lucro. Proteja-os a todo custo.',
            'Classe B: Os próximos 20%. Têm potencial de se tornarem Classe A.',
            'Classe C: Os 10% finais. Exigem baixo esforço de manutenção.'
        ]
    },
    {
        id: 'wa',
        title: 'WhatsApp Marketing Seguro',
        desc: 'Como fazer disparos em massa sem ser bloqueado.',
        icon: <MessageCircle className="text-emerald-500" />,
        color: 'bg-emerald-100 dark:bg-emerald-900/30',
        content: [
            'O "Modo Player" exige sua confirmação manual para cada envio, garantindo comportamento humano.',
            'Teste A/B: Envie dois textos diferentes e veja qual gera mais vendas.',
            'Tags: Segmente clientes por interesse (ex: Natal, VIP) antes de disparar.',
            'Mídia Segura: Use o botão de copiar imagem para colagem direta no chat.'
        ]
    },
    {
        id: 'fin',
        title: 'Governança Financeira',
        desc: 'Gestão de caixa, breakeven e fluxo provisionado.',
        icon: <Calculator className="text-blue-500" />,
        color: 'bg-blue-100 dark:bg-blue-900/30',
        content: [
            'Reconciliação: Sempre marque transações como "Auditadas" ao conferir o extrato.',
            'Provisionamento: Lance despesas futuras como "Pendentes" para visualizar sua projeção de 30 dias.',
            'Distribuição: O sistema permite dividir comissões líquidas entre contas PF e PJ automaticamente.',
            'Breakeven: A linha vermelha nos gráficos indica o ponto onde suas receitas cobrem as despesas fixas.'
        ]
    },
    {
        id: 'ai',
        title: 'IA e Retenção Churn',
        desc: 'Use o Gemini para recuperar clientes e analisar dados.',
        icon: <Sparkles className="text-purple-500" />,
        color: 'bg-purple-100 dark:bg-purple-900/30',
        content: [
            'O Consultor IA analisa suas vendas ativas e sugere correções de rota.',
            'Reativação IA: Gera textos persuasivos baseados no histórico real do cliente inativo.',
            'Grounding: A IA do Gestor360 acessa o Google Search para trazer notícias do mercado de benefícios.'
        ]
    }
];

const TrainingHub: React.FC<TrainingHubProps> = ({ onClose, darkMode }) => {
    const [selectedCourse, setSelectedCourse] = useState<typeof COURSES[0] | null>(null);

    const bgClass = darkMode ? 'bg-slate-900 text-white' : 'bg-white text-gray-900';
    const cardClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200';

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className={`w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col h-[85vh] ${bgClass}`}>
                
                {/* Header */}
                <div className="p-8 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/30">
                            <BookOpen size={28}/>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Academia Gestor360</h2>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Capacitação para o Nível Enterprise</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    
                    {/* Lista de Cursos */}
                    <div className="w-full md:w-80 border-r dark:border-slate-800 p-6 space-y-4 overflow-y-auto bg-gray-50/50 dark:bg-slate-900/50">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Módulos Disponíveis</h3>
                        {COURSES.map(course => (
                            <button
                                key={course.id}
                                onClick={() => setSelectedCourse(course)}
                                className={`w-full p-5 rounded-2xl border text-left transition-all group ${selectedCourse?.id === course.id ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white dark:bg-slate-800 shadow-xl' : cardClass + ' hover:border-indigo-300'}`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${course.color}`}>{course.icon}</div>
                                    <span className="font-bold text-sm">{course.title}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{course.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Conteúdo Detalhado */}
                    <div className="flex-1 flex flex-col p-8 md:p-12 overflow-y-auto bg-white dark:bg-slate-950">
                        {selectedCourse ? (
                            <div className="animate-in slide-in-from-right duration-500 h-full flex flex-col max-w-2xl mx-auto">
                                <div className="mb-10 text-center">
                                    <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl ${selectedCourse.color}`}>
                                        {/* Fix: Added explicit <any> generic type to resolve "size" property error during cloneElement */}
                                        {React.cloneElement(selectedCourse.icon as React.ReactElement<any>, { size: 40 })}
                                    </div>
                                    <h4 className="text-3xl font-black mb-3">{selectedCourse.title}</h4>
                                    <p className="text-gray-500 font-medium">{selectedCourse.desc}</p>
                                </div>

                                <div className="space-y-4 flex-1">
                                    {selectedCourse.content.map((point, i) => (
                                        <div key={i} className={`p-5 rounded-3xl flex items-start gap-4 border transition-all hover:translate-x-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5 font-black text-xs">
                                                {i + 1}
                                            </div>
                                            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 font-medium">{point}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-12 p-8 rounded-[2.5rem] bg-indigo-600 text-white flex items-center justify-between shadow-2xl shadow-indigo-900/40">
                                    <div>
                                        <p className="text-xs font-black uppercase opacity-70 mb-1 tracking-widest">Treinamento Concluído?</p>
                                        <p className="text-lg font-bold">Coloque em prática agora!</p>
                                    </div>
                                    <button 
                                        onClick={onClose}
                                        className="p-4 bg-white text-indigo-600 rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl flex items-center gap-2 font-black uppercase text-xs"
                                    >
                                        Abrir Módulo <Zap size={18} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 animate-pulse">
                                <ShieldCheck size={80} className="mb-6 text-indigo-500" />
                                <h4 className="text-2xl font-black mb-2 uppercase tracking-tighter">Central de Conhecimento</h4>
                                <p className="font-bold max-w-xs">Selecione um tópico à esquerda para visualizar o manual operacional.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-center flex justify-between px-8 items-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Gestor360 v3.1.5 • 2025</p>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500">
                        <span className="flex items-center gap-1"><CheckCircle size={12} className="text-emerald-500"/> Certificação Ativa</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TrainingHub;
