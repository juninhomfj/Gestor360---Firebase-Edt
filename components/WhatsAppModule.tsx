
import React, { useState, useEffect } from 'react';
import { MessageCircle, Users, Send, Play, CheckCircle, Plus, ExternalLink, Copy, ArrowRight, BarChart2, Wand2, Smartphone, Volume2, Loader2, Sparkles, TrendingUp, DollarSign, UploadCloud, Archive, RotateCcw } from 'lucide-react';
import { WAContact, WATag, WACampaign, WAMessageQueue, Sale } from '../types';
import { getWAContacts, getWATags, getWACampaigns, saveWACampaign, createCampaignQueue, getWAQueue, updateQueueStatus, copyToClipboard, openWhatsAppWeb, copyImageToClipboard, exportWAContactsToServer, createWACampaignRemote } from '../services/whatsappService';
import { WhatsAppManualLogger } from '../services/whatsappLogger';
import { archiveWACampaign } from '../services/logic';
import { generateAudioMessage } from '../services/aiService';
import WhatsAppPreview from './WhatsAppPreview';
import WhatsAppCampaignWizard from './WhatsAppCampaignWizard';
import WhatsAppDashboard from './WhatsAppDashboard';
import WhatsAppConnection from './WhatsAppConnection';
import WhatsAppContacts from './WhatsAppContacts';
import { auth } from '../services/firebase';

interface WhatsAppModuleProps {
    darkMode: boolean;
    sales?: Sale[];
}

const WhatsAppModule: React.FC<WhatsAppModuleProps> = ({ darkMode, sales = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'DASHBOARD' | 'CONTACTS' | 'PLAYER' | 'STATS' | 'CONNECTION'>('DASHBOARD');
  const [contacts, setContacts] = useState<WAContact[]>([]);
  const [tags, setTags] = useState<WATag[]>([]);
  const [campaigns, setCampaigns] = useState<WACampaign[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<WACampaign | null>(null);
  const [queue, setQueue] = useState<WAMessageQueue[]>([]);
  const [currentItem, setCurrentItem] = useState<WAMessageQueue | null>(null);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [mediaCopied, setMediaCopied] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { 
    loadData(); 
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream.getTracks().forEach(track => track.stop());
            console.info("[WhatsAppModule] Permissões de mídia autorizadas.");
        }
    } catch (e) {
        console.warn("[WhatsAppModule] Permissões negadas pelo usuário.");
    }
  };

  const loadData = async () => {
      const [c, t, cmp] = await Promise.all([getWAContacts(), getWATags(), getWACampaigns()]);
      setContacts(c); setTags(t); setCampaigns(cmp);
  };

  const handleStartCampaign = async (campaign: WACampaign) => {
      const q = await getWAQueue(campaign.id);
      const pending = q.filter(i => i.status === 'PENDING');
      if (pending.length === 0) return alert("Esta campanha já foi processada.");
      
      setQueue(q);
      setActiveCampaign(campaign);
      setCurrentItem(pending[0]);
      setActiveSubTab('PLAYER');
      
      const logId = await WhatsAppManualLogger.startInteraction(campaign.id, contacts.find(c => c.id === pending[0].contactId)!, campaign.config.speed);
      setActiveLogId(logId);
  };

  const handleArchive = async (campaignId: string, status: boolean) => {
      await archiveWACampaign(campaignId, status);
      loadData();
  };

  const handleExportToServer = async () => {
      setExporting(true);
      try {
          await exportWAContactsToServer();
          alert("Contatos exportados!");
      } catch (e: any) {
          alert("Erro ao exportar: " + e.message);
      } finally {
          setExporting(false);
      }
  };

  const handleAction = async (action: 'COPY_TEXT' | 'COPY_IMAGE' | 'OPEN_WA' | 'CONFIRM' | 'TTS') => {
      if (!currentItem || !activeLogId) return;

      if (action === 'COPY_IMAGE') {
          if (currentItem.media?.data) {
              const success = await copyImageToClipboard(currentItem.media.data);
              if (success) setMediaCopied(true);
              await WhatsAppManualLogger.logStep(activeLogId, 'mediaCopiedAt');
          }
      } else if (action === 'COPY_TEXT') {
          await copyToClipboard(currentItem.message);
          await WhatsAppManualLogger.logStep(activeLogId, 'messageCopiedAt');
      } else if (action === 'OPEN_WA') {
          openWhatsAppWeb(currentItem.phone, currentItem.message);
          await WhatsAppManualLogger.logStep(activeLogId, 'whatsappOpenedAt');
      } else if (action === 'TTS') {
          setGeneratingAudio(true);
          const audio = await generateAudioMessage(currentItem.message);
          if (audio) new Audio(audio).play();
          setGeneratingAudio(false);
      } else if (action === 'CONFIRM') {
          await WhatsAppManualLogger.logStep(activeLogId, 'completedAt');
          await updateQueueStatus(currentItem.id, 'SENT');
          
          const next = queue.find(i => i.status === 'PENDING' && i.id !== currentItem.id);
          if (next) {
              setCurrentItem(next);
              setMediaCopied(false);
              const logId = await WhatsAppManualLogger.startInteraction(activeCampaign!.id, contacts.find(c => c.id === next.contactId)!, activeCampaign!.config.speed);
              setActiveLogId(logId);
          } else {
              alert("Fila finalizada!");
              setActiveSubTab('DASHBOARD');
          }
      }
  };

  const visibleCampaigns = campaigns.filter(c => (c as any).isArchived === showArchived);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500">
        {showWizard && (
            <WhatsAppCampaignWizard 
                contacts={contacts} 
                tags={tags} 
                onClose={() => setShowWizard(false)} 
                onSave={async (data, target) => {
                    const newCamp: WACampaign = {
                        id: crypto.randomUUID(),
                        name: data.name!,
                        messageTemplate: data.messageTemplate!,
                        targetTags: data.targetTags || [],
                        status: 'DRAFT',
                        totalContacts: target.length,
                        sentCount: 0,
                        config: data.config || { speed: 'SAFE', startTime: '08:00', endTime: '18:00' },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        deleted: false,
                        userId: auth.currentUser?.uid || ''
                    };
                    
                    try {
                        await createWACampaignRemote(newCamp, target);
                    } catch (e) {
                        console.warn("Falha sincronização remota.");
                    }

                    await saveWACampaign(newCamp);
                    await createCampaignQueue(newCamp.id, newCamp.messageTemplate, target, newCamp.targetTags, data.abTest, data.media);
                    setShowWizard(false);
                    loadData();
                }} 
                darkMode={darkMode} 
            />
        )}

        <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                <MessageCircle className="text-emerald-500" /> WhatsApp <span className="text-emerald-500">Marketing</span>
            </h1>
            <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800">
                {['DASHBOARD', 'CONTACTS', 'CONNECTION', 'STATS'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveSubTab(tab as any)} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === tab ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-hidden">
            {activeSubTab === 'DASHBOARD' && (
                <div className="space-y-6 h-full overflow-y-auto pb-10">
                    <div className="p-10 rounded-3xl border-2 border-dashed border-indigo-200 dark:border-slate-800 flex flex-col items-center text-center bg-indigo-50/20 dark:bg-indigo-900/10">
                        <div className="w-20 h-20 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl mb-6 animate-float">
                            <Wand2 size={32} />
                        </div>
                        <h3 className="text-2xl font-black mb-2">Novo Disparo Estratégico</h3>
                        <p className="text-sm text-gray-500 max-w-md mx-auto mb-8">Segmente seu público e execute com segurança anti-bloqueio.</p>
                        <div className="flex gap-4">
                          <button onClick={() => setShowWizard(true)} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-900/30 hover:scale-105 transition-all">Iniciar Wizard</button>
                          <button onClick={handleExportToServer} disabled={exporting} className="px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                            {exporting ? <Loader2 className="animate-spin" size={20}/> : <UploadCloud size={20}/>}
                            Exportar p/ Servidor
                          </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center px-2">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{showArchived ? 'Campanhas Arquivadas' : 'Campanhas Ativas'}</h4>
                        <button onClick={() => setShowArchived(!showArchived)} className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 hover:underline">
                            {showArchived ? <RotateCcw size={12}/> : <Archive size={12}/>}
                            {showArchived ? 'Ver Ativas' : 'Ver Arquivadas'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {visibleCampaigns.map(c => (
                            <div key={c.id} className={`p-6 rounded-2xl border transition-all hover:shadow-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg truncate flex-1">{c.name}</h4>
                                    <button onClick={() => handleArchive(c.id, !showArchived)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-lg">
                                        {showArchived ? <RotateCcw size={16}/> : <Archive size={16}/>}
                                    </button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{c.totalContacts} Contatos</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                                </div>
                                <button onClick={() => handleStartCampaign(c)} className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                    <Play size={16} fill="currentColor" /> {showArchived ? 'Visualizar' : 'Retomar Disparos'}
                                </button>
                            </div>
                        ))}
                        {visibleCampaigns.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-400 text-sm italic">Nenhuma campanha {showArchived ? 'arquivada' : 'ativa'} encontrada.</div>
                        )}
                    </div>
                </div>
            )}

            {activeSubTab === 'CONNECTION' && <WhatsAppConnection darkMode={darkMode} />}

            {activeSubTab === 'PLAYER' && currentItem && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    <div className="flex flex-col justify-center space-y-6 max-w-md mx-auto w-full">
                        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-500/20 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><Smartphone size={100} /></div>
                            
                            <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">Protocolo de Envio Manual</p>
                            <h2 className="text-3xl font-black mb-1">{contacts.find(c => c.id === currentItem.contactId)?.name || 'Lead'}</h2>
                            <p className="font-mono text-sm text-gray-500 mb-8">{currentItem.phone}</p>

                            <div className="space-y-4">
                                {currentItem.media && (
                                    <button onClick={() => handleAction('COPY_IMAGE')} className={`w-full p-4 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${mediaCopied ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 dark:border-slate-700'}`}>
                                        <span className="flex items-center gap-2"><Copy size={20}/> 1. Copiar Imagem</span>
                                        {mediaCopied && <CheckCircle size={18}/>}
                                    </button>
                                )}
                                <button onClick={() => handleAction('COPY_TEXT')} className="w-full p-4 rounded-xl border-2 border-indigo-200 dark:border-slate-700 font-bold flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors">
                                    <Copy size={20}/> {currentItem.media ? '2.' : '1.'} Copiar Texto
                                </button>
                                <button onClick={() => handleAction('OPEN_WA')} className="w-full p-5 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-between hover:bg-emerald-700 shadow-lg transition-all active:scale-95">
                                    <span className="flex items-center gap-3"><ExternalLink size={24}/> Abrir WhatsApp</span>
                                    <ArrowRight size={24}/>
                                </button>
                                <button onClick={() => handleAction('TTS')} disabled={generatingAudio} className="w-full py-2 text-xs font-bold text-blue-500 flex items-center justify-center gap-2 opacity-70 hover:opacity-100">
                                    <Volume2 size={14}/> {generatingAudio ? 'Gerando...' : 'Ouvir IA'}
                                </button>
                            </div>

                            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                                <button onClick={() => handleAction('CONFIRM')} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-900/20 active:scale-95">Confirmar Envio</button>
                                <button onClick={() => handleAction('CONFIRM')} className={`px-6 py-4 rounded-2xl font-bold ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>Pular</button>
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center justify-center">
                        <WhatsAppPreview text={currentItem.message} media={currentItem.media?.data} mediaType={currentItem.media?.type} contactName={contacts.find(c => c.id === currentItem.contactId)?.name} isDarkMode={darkMode} />
                    </div>
                </div>
            )}

            {activeSubTab === 'STATS' && (
                <div className="h-full overflow-y-auto">
                    {campaigns.length > 0 ? (
                        <WhatsAppDashboard campaignId={activeCampaign?.id || campaigns[0].id} darkMode={darkMode} />
                    ) : (
                        <div className="p-20 text-center opacity-50">Sem dados.</div>
                    )}
                </div>
            )}
            
            {activeSubTab === 'CONTACTS' && (
              <WhatsAppContacts contacts={contacts} tags={tags} onUpdate={loadData} darkMode={darkMode} sales={sales} />
            )}
        </div>
    </div>
  );
};

export default WhatsAppModule;
