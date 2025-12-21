
import React, { useState, useMemo } from 'react';
import { WAContact, WATag, WACampaign, WASpeed, WAMediaType } from '../types';
import { Users, MessageSquare, Play, CheckCircle, Tag, Wand2, Split, Image as ImageIcon, X, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { fileToBase64 } from '../utils/fileHelper';
import WhatsAppPreview from './WhatsAppPreview';
import { optimizeMessage } from '../services/aiService';
import { getSession } from '../services/auth';

interface WhatsAppCampaignWizardProps {
    contacts: WAContact[];
    tags: WATag[];
    onClose: () => void;
    onSave: (campaign: Partial<WACampaign>, targetContacts: WAContact[]) => void;
    darkMode: boolean;
}

const STEPS = [
    { id: 1, label: 'Público Alvo', icon: Users },
    { id: 2, label: 'Mensagem', icon: MessageSquare },
    { id: 3, label: 'Revisão', icon: CheckCircle },
];

const WhatsAppCampaignWizard: React.FC<WhatsAppCampaignWizardProps> = ({ contacts, tags, onClose, onSave, darkMode }) => {
    const [step, setStep] = useState(1);
    
    // Campaign State
    const [name, setName] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [template, setTemplate] = useState('Olá {primeiro_nome}, tudo bem?');
    const [speed, setSpeed] = useState<WASpeed>('SAFE');
    
    // A/B & Media
    const [enableAbTest, setEnableAbTest] = useState(false);
    const [templateB, setTemplateB] = useState('Oi {primeiro_nome}, como vai?');
    const [media, setMedia] = useState<{data: string, type: WAMediaType, name: string} | undefined>(undefined);
    
    // Logic
    const [isOptimizing, setIsOptimizing] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // --- AUDIENCE LOGIC ---
    const targetContacts = useMemo(() => {
        if (selectedTags.length === 0) return contacts; 
        return contacts.filter(c => c.tags.some(t => selectedTags.includes(t)));
    }, [contacts, selectedTags]);

    const handleTagToggle = (tagName: string) => {
        setSelectedTags(prev => 
            prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
        );
    };

    // --- MEDIA LOGIC ---
    const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert("Máximo 5MB."); return; }
        
        try {
            const base64 = await fileToBase64(file);
            let type: WAMediaType = 'DOCUMENT';
            if (file.type.startsWith('image/')) type = 'IMAGE';
            else if (file.type.startsWith('video/')) type = 'VIDEO';
            else if (file.type.startsWith('audio/')) type = 'AUDIO';
            setMedia({ data: base64, type, name: file.name });
        } catch (err) { alert("Erro no arquivo."); }
    };

    // --- AI LOGIC ---
    const handleOptimize = async (target: 'A' | 'B') => {
        const text = target === 'A' ? template : templateB;
        if (!text) return;
        setIsOptimizing(true);
        try {
            const user = getSession();
            if (!user?.keys?.isGeminiEnabled) throw new Error("IA não configurada no perfil.");
            const optimized = await optimizeMessage(text, 'PERSUASIVE', user.keys);
            if (target === 'A') setTemplate(optimized); else setTemplateB(optimized);
        } catch (e: any) {
            alert(e.message || "Erro na IA");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleFinish = () => {
        if (!name) { alert("Dê um nome para a campanha."); return; }
        if (targetContacts.length === 0) { alert("Selecione um público com contatos."); return; }

        const campaignData: Partial<WACampaign> = {
            name,
            messageTemplate: template,
            targetTags: selectedTags,
            config: { speed, startTime: '08:00', endTime: '18:00' },
            abTest: enableAbTest ? { enabled: true, templateB } : undefined,
            media
        };
        onSave(campaignData, targetContacts);
    };

    // --- STYLES ---
    const bgClass = darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200';
    const textClass = darkMode ? 'text-white' : 'text-gray-900';
    const inputClass = darkMode ? 'bg-black/20 border-slate-700 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in zoom-in-95">
            <div className={`w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${bgClass}`}>
                
                {/* HEADER */}
                <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-900 to-slate-900 text-white">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Wand2 size={24} className="text-purple-400"/> Criador de Campanha
                        </h2>
                        <p className="text-sm opacity-70">Configure seu disparo em 3 passos simples.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
                </div>

                {/* PROGRESS STEPS */}
                <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50">
                    {STEPS.map((s, idx) => {
                        const isActive = s.id === step;
                        const isDone = s.id < step;
                        return (
                            <div key={s.id} className={`flex-1 p-4 flex items-center justify-center gap-3 border-b-2 transition-colors ${isActive ? 'border-purple-500 text-purple-600 dark:text-purple-400' : (isDone ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500' : 'border-transparent text-gray-400')}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? 'bg-purple-100 dark:bg-purple-900/30' : (isDone ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-200 dark:bg-slate-800')}`}>
                                    {isDone ? <CheckCircle size={16}/> : s.id}
                                </div>
                                <span className="font-bold hidden sm:inline">{s.label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    
                    {/* LEFT PANEL (FORM) */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                        
                        {/* STEP 1: AUDIENCE */}
                        {step === 1 && (
                            <div className="space-y-6 animate-in slide-in-from-right">
                                <div>
                                    <label className={`block text-sm font-bold mb-2 ${textClass}`}>Nome da Campanha</label>
                                    <input 
                                        className={`w-full p-3 rounded-xl border outline-none ${inputClass}`}
                                        placeholder="Ex: Promoção Natal VIP"
                                        value={name} onChange={e => setName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className={`block text-sm font-bold mb-3 ${textClass}`}>Segmentação (Tags)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => handleTagToggle(tag.name)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${selectedTags.includes(tag.name) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'border-gray-300 dark:border-slate-600 text-gray-500 hover:border-purple-400'}`}
                                            >
                                                <Tag size={14}/> {tag.name}
                                            </button>
                                        ))}
                                        {tags.length === 0 && <p className="text-gray-500 text-sm">Nenhuma tag encontrada. Importe contatos primeiro.</p>}
                                    </div>
                                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                        {selectedTags.length === 0 
                                            ? `Selecionando TODOS os ${contacts.length} contatos.` 
                                            : `Selecionado: ${targetContacts.length} contatos (de ${contacts.length}).`}
                                    </p>
                                </div>

                                <div>
                                    <label className={`block text-sm font-bold mb-3 ${textClass}`}>Velocidade de Envio</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'FAST', label: 'Rápido', desc: '5-10s (Risco Médio)' },
                                            { id: 'SAFE', label: 'Seguro', desc: '15-30s (Recomendado)' },
                                            { id: 'SLOW', label: 'Lento', desc: '30-60s (Aquecimento)' }
                                        ].map((opt: any) => (
                                            <button 
                                                key={opt.id}
                                                onClick={() => setSpeed(opt.id)}
                                                className={`p-3 rounded-xl border text-left transition-all ${speed === opt.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                            >
                                                <div className={`font-bold text-sm ${speed === opt.id ? 'text-indigo-600 dark:text-indigo-400' : textClass}`}>{opt.label}</div>
                                                <div className="text-[10px] opacity-60">{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: MESSAGE */}
                        {step === 2 && (
                            <div className="space-y-6 animate-in slide-in-from-right">
                                {/* Media Upload */}
                                <div className={`p-4 rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${media ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`} onClick={() => fileInputRef.current?.click()}>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,audio/*" onChange={handleMediaSelect} />
                                    {media ? (
                                        <div className="text-center">
                                            <p className="text-emerald-600 font-bold flex items-center gap-2 justify-center">
                                                <ImageIcon size={20}/> {media.name}
                                            </p>
                                            <button onClick={(e) => { e.stopPropagation(); setMedia(undefined); }} className="text-xs text-red-500 hover:underline mt-1">Remover</button>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400">
                                            <ImageIcon size={24} className="mx-auto mb-2"/>
                                            <p className="text-sm font-bold">Adicionar Imagem ou Vídeo (Opcional)</p>
                                        </div>
                                    )}
                                </div>

                                {/* Message A */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className={`text-sm font-bold ${textClass}`}>Mensagem {enableAbTest && '(Variante A)'}</label>
                                        <button onClick={() => handleOptimize('A')} disabled={isOptimizing} className="text-xs text-purple-500 flex items-center gap-1 font-bold hover:underline">
                                            <Wand2 size={12}/> Melhorar com IA
                                        </button>
                                    </div>
                                    <textarea 
                                        className={`w-full p-4 rounded-xl border h-32 resize-none text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputClass}`}
                                        value={template}
                                        onChange={e => setTemplate(e.target.value)}
                                        placeholder="Olá {primeiro_nome}..."
                                    />
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {['{primeiro_nome}', '{nome}', '{saudacao}'].map(v => (
                                            <button key={v} onClick={() => setTemplate(prev => prev + ' ' + v)} className="text-[10px] bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* A/B Test Toggle */}
                                <div className="flex items-center gap-3 py-2">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={enableAbTest} onChange={e => setEnableAbTest(e.target.checked)} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                    </label>
                                    <span className={`text-sm font-bold flex items-center gap-2 ${textClass}`}><Split size={16}/> Teste A/B</span>
                                </div>

                                {/* Message B */}
                                {enableAbTest && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 border-l-2 border-purple-500 pl-4">
                                        <div className="flex justify-between items-center">
                                            <label className={`text-sm font-bold ${textClass}`}>Mensagem (Variante B)</label>
                                            <button onClick={() => handleOptimize('B')} disabled={isOptimizing} className="text-xs text-purple-500 flex items-center gap-1 font-bold hover:underline">
                                                <Wand2 size={12}/> Melhorar
                                            </button>
                                        </div>
                                        <textarea 
                                            className={`w-full p-4 rounded-xl border h-32 resize-none text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputClass}`}
                                            value={templateB}
                                            onChange={e => setTemplateB(e.target.value)}
                                            placeholder="Variação da mensagem..."
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 3: REVIEW */}
                        {step === 3 && (
                            <div className="space-y-6 animate-in slide-in-from-right">
                                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <h4 className="font-bold text-gray-500 text-xs uppercase mb-3">Resumo da Campanha</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                                            <span className="text-sm">Nome</span>
                                            <span className={`font-bold ${textClass}`}>{name}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                                            <span className="text-sm">Público Estimado</span>
                                            <span className={`font-bold text-emerald-500`}>{targetContacts.length} contatos</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                                            <span className="text-sm">Velocidade</span>
                                            <span className={`font-bold ${textClass}`}>{speed}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Mídia</span>
                                            <span className={`font-bold ${textClass}`}>{media ? media.name : 'Nenhuma'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center text-xs text-gray-500">
                                    <p>Ao clicar em Criar, a fila de envio será gerada.</p>
                                    <p>Você poderá iniciar o envio no painel principal.</p>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* RIGHT PANEL (PREVIEW) */}
                    <div className={`w-80 hidden md:flex flex-col border-l border-gray-200 dark:border-slate-800 ${darkMode ? 'bg-black/20' : 'bg-gray-50'} p-6 items-center justify-center`}>
                        <div className="scale-90 transform origin-top">
                            <WhatsAppPreview 
                                text={step === 2 && enableAbTest ? templateB : template}
                                media={media?.data}
                                mediaType={media?.type}
                                contactName="Cliente Exemplo"
                                isDarkMode={darkMode}
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-4 text-center">Pré-visualização aproximada (WhatsApp Android).</p>
                    </div>
                </div>

                {/* FOOTER */}
                <div className={`p-4 border-t border-gray-200 dark:border-slate-800 flex justify-between ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                    <button 
                        onClick={() => setStep(prev => Math.max(1, prev - 1))}
                        disabled={step === 1}
                        className="px-6 py-2.5 rounded-lg font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors flex items-center gap-2"
                    >
                        <ChevronLeft size={18}/> Voltar
                    </button>

                    {step < 3 ? (
                        <button 
                            onClick={() => setStep(prev => Math.min(3, prev + 1))}
                            className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-900/20"
                        >
                            Próximo <ChevronRight size={18}/>
                        </button>
                    ) : (
                        <button 
                            onClick={handleFinish}
                            className="px-8 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/20 animate-pulse"
                        >
                            <Save size={18}/> Criar Campanha
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default WhatsAppCampaignWizard;
