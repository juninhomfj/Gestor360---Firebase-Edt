
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Users, Send, Play, Pause, CheckCircle, Upload, Trash2, Plus, ExternalLink, Copy, SkipForward, ArrowRight, AlertTriangle, BarChart2, Settings, Wand2, Archive, Eye, EyeOff, Split, HelpCircle, Database, Image as ImageIcon, Video, Mic, FileAudio, Smartphone, Save, QrCode } from 'lucide-react';
import { WAContact, WATag, WACampaign, WAMessageQueue, WhatsAppErrorCode, UserKeys, Sale, WAMediaType } from '../types';
import { getWAContacts, saveWAContact, deleteWAContact, importWAContacts, parseCSVContacts, getWATags, getWACampaigns, saveWACampaign, createCampaignQueue, getWAQueue, updateQueueStatus, copyToClipboard, openWhatsAppWeb, archiveWACampaign, copyImageToClipboard } from '../services/whatsappService';
import { WhatsAppManualLogger } from '../services/whatsappLogger';
import { optimizeMessage, isAiAvailable } from '../services/aiService';
import { getSession } from '../services/auth';
import { fileToBase64, formatFileSize } from '../utils/fileHelper';
import WhatsAppFeedback from './WhatsAppFeedback';
import WhatsAppDashboard from './WhatsAppDashboard';
import WhatsAppSyncSettings from './WhatsAppSyncSettings';
import WhatsAppTutorial from './WhatsAppTutorial';
import WhatsAppPreview from './WhatsAppPreview';
import WhatsAppConnection from './WhatsAppConnection';
import WhatsAppContacts from './WhatsAppContacts';
import WhatsAppCampaignWizard from './WhatsAppCampaignWizard'; // New Import
import { auth } from '../services/firebase';

interface WhatsAppModuleProps {
    darkMode: boolean;
    sales?: Sale[];
}

const WhatsAppModule: React.FC<WhatsAppModuleProps> = ({ darkMode, sales = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'DASHBOARD' | 'CONTACTS' | 'PLAYER' | 'STATS' | 'SETTINGS' | 'CONNECT'>('DASHBOARD');
  
  // Data State
  const [contacts, setContacts] = useState<WAContact[]>([]);
  const [tags, setTags] = useState<WATag[]>([]);
  const [campaigns, setCampaigns] = useState<WACampaign[]>([]);
  
  // Player State
  const [activeCampaign, setActiveCampaign] = useState<WACampaign | null>(null);
  const [queue, setQueue] = useState<WAMessageQueue[]>([]);
  const [currentItem, setCurrentItem] = useState<WAMessageQueue | null>(null);

  // Logging & UI State
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showWizard, setShowWizard] = useState(false); // New Wizard State

  // Media Copy Feedback
  const [mediaCopied, setMediaCopied] = useState(false);

  useEffect(() => {
      loadData();
  }, []);

  const loadData = async () => {
      const [c, t, cmp] = await Promise.all([
          getWAContacts(),
          getWATags(),
          getWACampaigns()
      ]);
      setContacts(c);
      setTags(t);
      setCampaigns(cmp);
  };

  const handleCreateCampaign = async (campaignData: Partial<WACampaign>, targetContacts: WAContact[]) => {
      // Fix: Included all required fields for WACampaign
      const newCamp: WACampaign = {
          id: crypto.randomUUID(),
          name: campaignData.name!,
          messageTemplate: campaignData.messageTemplate!,
          targetTags: campaignData.targetTags || [],
          status: 'DRAFT',
          totalContacts: targetContacts.length,
          sentCount: 0,
          config: campaignData.config || { speed: 'SAFE', startTime: '08:00', endTime: '18:00' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          abTest: campaignData.abTest,
          media: campaignData.media,
          deleted: false,
          userId: auth.currentUser?.uid || ''
      };
      
      await saveWACampaign(newCamp);
      
      // Auto-generate queue immediately for better UX
      await createCampaignQueue(newCamp.id, newCamp.messageTemplate, targetContacts, newCamp.targetTags, newCamp.abTest, newCamp.media);
      
      setShowWizard(false);
      loadData();
      alert("Campanha criada e fila gerada com sucesso!");
  };

  const handleStartCampaign = async (campaign: WACampaign) => {
      let q = await getWAQueue(campaign.id);
      
      if (q.length === 0) {
          // Fallback if queue wasn't generated (rare now with wizard)
          const targetContacts = campaign.targetTags.length > 0 
            ? contacts.filter(c => c.tags.some(t => campaign.targetTags.includes(t)))
            : contacts; // All if no tags

          if (!confirm(`Gerar fila de envio para ${targetContacts.length} contatos?`)) return;
          await createCampaignQueue(campaign.id, campaign.messageTemplate, targetContacts, campaign.targetTags, campaign.abTest, campaign.media);
          q = await getWAQueue(campaign.id);
      } else {
          const pending = q.filter(i => i.status === 'PENDING');
          if (pending.length === 0) {
              alert("Todos os contatos desta campanha já foram processados.");
              return;
          }
      }

      setQueue(q);
      setActiveCampaign(campaign);
      
      const firstPending = q.find(i => i.status === 'PENDING');
      if (firstPending) {
          setCurrentItem(firstPending);
          await startLoggerFor(firstPending, campaign);
          setActiveSubTab('PLAYER');
      }
  };

  const startLoggerFor = async (item: WAMessageQueue, campaign: WACampaign) => {
      const contact = contacts.find(c => c.id === item.contactId);
      if (contact) {
          const logId = await WhatsAppManualLogger.startInteraction(
              campaign.id,
              contact,
              campaign.config.speed
          );
          setActiveLogId(logId);
          setMediaCopied(false); // Reset media state for new item
      }
  };

  // --- PLAYER ACTIONS ---

  const handleNext = async (status: 'SENT' | 'SKIPPED') => {
      if (!currentItem) return;
      setShowFeedback(true);
  };

  const handleFeedbackComplete = async (notes?: string, rating?: number, error?: { type: WhatsAppErrorCode; description: string }) => {
      if (!currentItem || !activeLogId) return;

      const isError = !!error;
      if (isError) {
          await WhatsAppManualLogger.logFailure(activeLogId, error.type, error.description);
          await updateQueueStatus(currentItem.id, 'FAILED'); 
      } else {
          await WhatsAppManualLogger.logStep(activeLogId, 'completedAt');
          await updateQueueStatus(currentItem.id, 'SENT'); 
      }

      const abNote = activeCampaign?.abTest?.enabled ? ` [Variante ${currentItem.variant}]` : '';
      if (notes || rating || abNote) {
          await WhatsAppManualLogger.addUserNotes(activeLogId, (notes || '') + abNote, rating as 1|2|3|4|5);
      }

      const updatedQueue = queue.map(i => i.id === currentItem.id ? { ...i, status: isError ? 'FAILED' : 'SENT' } : i) as WAMessageQueue[];
      setQueue(updatedQueue);
      setShowFeedback(false);
      setActiveLogId(null);

      const next = updatedQueue.find(i => i.status === 'PENDING');
      if (next && activeCampaign) {
          setCurrentItem(next);
          await startLoggerFor(next, activeCampaign);
      } else {
          alert("Campanha Concluída! Parabéns.");
          setActiveSubTab('DASHBOARD');
          setActiveCampaign(null);
          setCurrentItem(null);
          loadData(); 
      }
  };

  const handleCopyText = async () => {
      if (currentItem && activeLogId) {
          await copyToClipboard(currentItem.message);
          await WhatsAppManualLogger.logStep(activeLogId, 'messageCopiedAt');
      }
  };

  const handleCopyMedia = async () => {
      if (currentItem?.media?.data && activeLogId) {
          const success = await copyImageToClipboard(currentItem.media.data);
          if (success) {
              setMediaCopied(true);
              /* Fixed: mediaCopiedAt is now a valid key in ManualInteractionLog type */
              await WhatsAppManualLogger.logStep(activeLogId, 'mediaCopiedAt');
          } else {
              alert("Erro ao copiar mídia. O navegador pode não suportar este formato.");
          }
      }
  };

  const handleOpenWA = async () => {
      if (currentItem && activeLogId) {
          openWhatsAppWeb(currentItem.phone, currentItem.message);
          await WhatsAppManualLogger.logStep(activeLogId, 'whatsappOpenedAt');
      }
  };

  const handleArchive = async (c: WACampaign) => {
      if(confirm('Arquivar campanha?')) {
          await archiveWACampaign(c);
          loadData();
      }
  };

  // Glassmorphism classes
  const glassClass = darkMode 
    ? 'glass-panel border-slate-700/50' 
    : 'bg-white border-gray-200 shadow-sm';

  const displayCampaigns = campaigns.filter(c => !c.archived);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] relative animate-in fade-in duration-300">
        
        {showTutorial && <WhatsAppTutorial onClose={() => setShowTutorial(false)} />}
        
        {showWizard && (
            <WhatsAppCampaignWizard 
                contacts={contacts} 
                tags={tags} 
                onClose={() => setShowWizard(false)} 
                onSave={handleCreateCampaign}
                darkMode={darkMode}
            />
        )}

        {showFeedback && currentItem && (
            <WhatsAppFeedback 
                logId={activeLogId || 'unknown'}
                contactName={contacts.find(c => c.id === currentItem.contactId)?.name || currentItem.phone}
                phone={currentItem.phone}
                onComplete={handleFeedbackComplete}
                onSkip={() => handleFeedbackComplete()} 
            />
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
                <h1 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    <MessageCircle className="text-emerald-500" /> WhatsApp <span className="text-emerald-500">360</span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium tracking-wide">
                    Disparos manuais seguros (Anti-Bloqueio)
                </p>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={() => setShowTutorial(true)} className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors shadow-sm" title="Ajuda">
                    <HelpCircle size={20} />
                </button>

                <div className={`flex p-1 rounded-xl overflow-x-auto ${darkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
                    <TabButton id="DASHBOARD" label="Campanhas" icon={<Send size={16}/>} active={activeSubTab} onClick={setActiveSubTab} darkMode={darkMode} />
                    <TabButton id="CONTACTS" label="Contatos (CRM)" icon={<Users size={16}/>} active={activeSubTab} onClick={setActiveSubTab} darkMode={darkMode} />
                    <TabButton id="CONNECT" label="Instância" icon={<QrCode size={16}/>} active={activeSubTab} onClick={setActiveSubTab} darkMode={darkMode} />
                    <TabButton id="STATS" label="Stats" icon={<BarChart2 size={16}/>} active={activeSubTab} onClick={setActiveSubTab} darkMode={darkMode} />
                    <TabButton id="SETTINGS" label="Sync" icon={<Settings size={16}/>} active={activeSubTab} onClick={setActiveSubTab} darkMode={darkMode} />
                    {activeCampaign && (
                        <TabButton id="PLAYER" label="Executando..." icon={<Play size={16} className="animate-pulse"/>} active={activeSubTab} onClick={setActiveSubTab} darkMode={darkMode} isRunning />
                    )}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
            
            {activeSubTab === 'DASHBOARD' && (
                <div className="h-full overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    
                    <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center space-y-4 ${glassClass}`}>
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse-slow">
                            <Wand2 className="text-white" size={32} />
                        </div>
                        <div>
                            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Criar Nova Campanha</h3>
                            <p className="text-sm text-gray-500 max-w-md mx-auto">Configure mensagens, segmente seu público por tags e use IA para otimizar seus textos.</p>
                        </div>
                        <button 
                            onClick={() => setShowWizard(true)}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
                        >
                            <Plus size={20}/> Iniciar Wizard
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold opacity-70 px-2">Campanhas Ativas ({displayCampaigns.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {displayCampaigns.map((c: WACampaign) => (
                                <div key={c.id} className={`p-5 rounded-2xl border flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-lg ${glassClass}`}>
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className={`font-bold text-lg truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{c.name}</h4>
                                            <span className={`uppercase font-bold text-[10px] px-2 py-1 rounded ${c.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>{c.status}</span>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {c.media && <span className="bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded flex items-center gap-1 font-bold text-xs"><ImageIcon size={10}/> Mídia</span>}
                                            {c.abTest?.enabled && <span className="bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded flex items-center gap-1 font-bold text-xs"><Split size={10}/> Teste A/B</span>}
                                            <span className="bg-gray-500/20 text-gray-500 px-2 py-0.5 rounded font-bold text-xs">{c.totalContacts} contatos</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-2 pt-3 border-t border-gray-200 dark:border-slate-700">
                                        <button onClick={() => handleStartCampaign(c)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-1 transition-colors">
                                            <Play size={14} fill="currentColor"/> Iniciar
                                        </button>
                                        <button onClick={() => handleArchive(c)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                            <Archive size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'CONTACTS' && (
                <WhatsAppContacts 
                    contacts={contacts} 
                    tags={tags} 
                    onUpdate={loadData}
                    darkMode={darkMode}
                    sales={sales} 
                />
            )}

            {activeSubTab === 'CONNECT' && (
                <WhatsAppConnection darkMode={darkMode} />
            )}

            {activeSubTab === 'STATS' && (
                <div className="h-full overflow-y-auto">
                    {campaigns.length > 0 ? (
                        <div className="space-y-4">
                            <label className={`block text-sm font-bold p-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Selecione uma Campanha:</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
                                {campaigns.map(c => (
                                    <button 
                                        key={c.id} 
                                        className={`p-4 border rounded-xl text-left transition-all ${darkMode ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-emerald-500/50' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-emerald-300'}`}
                                    >
                                        <div className={`font-bold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{c.name}</div>
                                        <div className="text-xs opacity-50 mt-1">{c.totalContacts} contatos</div>
                                    </button>
                                ))}
                            </div>
                            <WhatsAppDashboard campaignId={campaigns[0]?.id} darkMode={darkMode} />
                        </div>
                    ) : (
                        <p className="p-8 text-center opacity-50">Crie uma campanha primeiro.</p>
                    )}
                </div>
            )}

            {activeSubTab === 'SETTINGS' && (
                <div className="h-full overflow-y-auto p-4">
                    <WhatsAppSyncSettings darkMode={darkMode} />
                </div>
            )}

            {/* --- IMPROVED PLAYER UI (GLASS) --- */}
            {activeSubTab === 'PLAYER' && currentItem && activeCampaign && (
                <div className={`h-full flex flex-col md:flex-row gap-6 p-4`}>
                    
                    {/* LEFT: CONTROLS */}
                    <div className={`flex-1 flex flex-col justify-center max-w-xl mx-auto w-full`}>
                        <div className={`rounded-3xl shadow-2xl overflow-hidden border ${glassClass} relative group`}>
                            
                            {/* Header with Aurora effect hint */}
                            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 text-white relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <MessageCircle size={120} />
                                </div>
                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold flex items-center gap-2 drop-shadow-md">
                                            {activeCampaign.name}
                                        </h2>
                                        <div className="flex items-center gap-2 mt-2 text-emerald-100">
                                            <div className="flex -space-x-2">
                                                <div className="w-6 h-6 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm"></div>
                                                <div className="w-6 h-6 rounded-full bg-white/10 border border-white/30 backdrop-blur-sm"></div>
                                            </div>
                                            <p className="text-xs font-bold px-2 py-1 bg-black/20 rounded-lg">
                                                Fila: {queue.findIndex(i => i.id === currentItem.id) + 1} / {queue.length}
                                            </p>
                                        </div>
                                    </div>
                                    {activeCampaign.abTest?.enabled && (
                                        <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold backdrop-blur-sm border border-white/30 shadow-sm">
                                            Variante {currentItem.variant}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="mt-5 w-full h-1.5 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div 
                                        className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-500 ease-out" 
                                        style={{ width: `${((queue.findIndex(i => i.id === currentItem.id) + 1) / queue.length) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-8 flex flex-col gap-6 relative">
                                <div className="flex items-center gap-4 bg-gray-50/50 dark:bg-black/20 p-4 rounded-2xl border border-gray-200/50 dark:border-white/5 backdrop-blur-sm">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                                        <Smartphone size={28} />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-0.5">Enviando para</p>
                                        <h3 className={`text-2xl font-black truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{contacts.find(c => c.id === currentItem.contactId)?.name || 'Sem nome'}</h3>
                                        <p className="text-sm font-mono opacity-70">{currentItem.phone}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* 1. MEDIA STEP (IF EXISTS) */}
                                    {currentItem.media && (
                                        <div className="relative group">
                                            <button 
                                                onClick={handleCopyMedia}
                                                className={`w-full p-4 rounded-xl border font-bold text-left flex items-center gap-4 transition-all relative overflow-hidden card-hover-glow ${
                                                    mediaCopied 
                                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                                                    : 'border-purple-500/30 bg-white/50 dark:bg-white/5 hover:border-purple-500 text-gray-700 dark:text-gray-200'
                                                }`}
                                            >
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm ${mediaCopied ? 'bg-emerald-500 text-white' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                                                    {mediaCopied ? <CheckCircle size={24}/> : <Copy size={24}/>}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="block text-xs opacity-70 uppercase tracking-wider font-bold mb-0.5">Passo 1</span>
                                                    <span className="text-lg font-bold">{mediaCopied ? 'Mídia Copiada' : 'Copiar Imagem'}</span>
                                                </div>
                                                {mediaCopied && <span className="text-xs font-bold bg-emerald-500/20 text-emerald-600 px-2 py-1 rounded">Feito</span>}
                                            </button>
                                        </div>
                                    )}

                                    {/* 2. OPEN WA STEP */}
                                    <button 
                                        onClick={handleOpenWA}
                                        className={`w-full p-5 rounded-xl font-bold text-left flex items-center gap-4 shadow-lg transition-all relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98] ${
                                            (currentItem.media && !mediaCopied) 
                                            ? 'bg-gray-100 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 text-gray-400 cursor-not-allowed' 
                                            : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white border-2 border-transparent shadow-emerald-500/20'
                                        }`}
                                        disabled={!!currentItem.media && !mediaCopied}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-white/20 text-white group-hover:scale-110 transition-transform`}>
                                            <ExternalLink size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="block text-xs opacity-80 uppercase tracking-wider font-bold mb-0.5">{currentItem.media ? 'Passo 2' : 'Ação Única'}</span>
                                            <span className="text-xl font-black">{currentItem.media ? 'Abrir & Colar (Ctrl+V)' : 'Abrir WhatsApp Web'}</span>
                                        </div>
                                        <ArrowRight size={24} className="opacity-70 group-hover:translate-x-2 transition-transform"/>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
                                    <button onClick={() => handleNext('SKIPPED')} className="py-3.5 text-sm font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-white/5">
                                        Pular Contato
                                    </button>
                                    <button onClick={() => handleNext('SENT')} className="py-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                                        Confirmar Envio
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: PREVIEW */}
                    <div className="hidden md:flex flex-1 justify-center items-center bg-gray-100/50 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-white/5 p-8 backdrop-blur-sm">
                        <WhatsAppPreview 
                            text={currentItem.message} 
                            media={currentItem.media?.data}
                            mediaType={currentItem.media?.type}
                            contactName={contacts.find(c => c.id === currentItem.contactId)?.name}
                            isDarkMode={darkMode}
                        />
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

const TabButton = ({ id, label, icon, active, onClick, darkMode, isRunning }: any) => (
    <button 
        onClick={() => onClick(id)}
        className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap mx-1 ${
            active === id 
            ? (isRunning ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-md') 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
        }`}
    >
        {icon}
        {label}
    </button>
);

export default WhatsAppModule;
