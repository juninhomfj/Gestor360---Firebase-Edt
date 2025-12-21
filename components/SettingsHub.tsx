
import React, { useState, useEffect, useRef } from 'react';
import { CommissionRule, ProductType, ReportConfig, SystemConfig, AppTheme, User, Sale, AiUsageStats, ProductLabels, DuplicateGroup, Transaction, SyncEntry } from '../types';
import CommissionEditor from './CommissionEditor';
import ClientUnification from './ClientUnification';
import DeduplicationReview from './DeduplicationReview';
import ClientList from './ClientList';
import ClientSearch from './ClientSearch';
import ClientMergeList from './ClientMergeList';
import { Settings, BarChart3, Shield, Cloud, AlertCircle, Clock, Download, Palette, Check, User as UserIcon, Monitor, Volume2, Upload, PlayCircle, Trash2, FileAudio, CheckCircle2, X, Image, Globe, Music, ShoppingBag, Gift, Database, Server, Key, Eye, EyeOff, LayoutTemplate, Activity, Zap, Sparkles, Filter, HelpCircle, Mail, Send, Tag, Hammer, FileJson, FileSearch, RefreshCw, ScanLine, Loader2, ToggleLeft, ToggleRight, Layers, ArrowRight, Wifi, WifiOff, HardDrive, ArrowLeft, Users, Save, Box } from 'lucide-react';
import { getSystemConfig, saveSystemConfig, takeSnapshot, saveSales, exportEncryptedBackup, DEFAULT_SYSTEM_CONFIG, DEFAULT_PRODUCT_LABELS, getFinanceData, auditDataDuplicates, saveFinanceData } from '../services/logic';
import { getDailyUsage } from '../services/aiService';
import { fileToBase64 } from '../utils/fileHelper';
import { getPendingSyncs } from '../storage/db';
import { auth, db } from '../services/firebase';
import BackupModal from './BackupModal';
import UserProfile from './UserProfile';
import AdminUsers from './AdminUsers';
import DevRoadmap from './DevRoadmap';
import DatabaseInspector from './DatabaseInspector'; 
import TrashBin from './TrashBin'; 

interface SettingsHubProps {
  rulesBasic: CommissionRule[];
  rulesNatal: CommissionRule[];
  rulesCustom: CommissionRule[]; 
  reportConfig: ReportConfig;
  onSaveRules: (type: ProductType, rules: CommissionRule[]) => void;
  onSaveReportConfig: (config: ReportConfig) => void;
  darkMode?: boolean;
  defaultTab?: string;
  onThemeChange?: (theme: AppTheme) => void;
  currentUser: User;
  onUpdateUser: (user: User) => void;
  sales: Sale[]; 
  onUpdateSales: (sales: Sale[]) => void;
  onNotify: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void; 
}

const SettingsHub: React.FC<SettingsHubProps> = ({ 
  rulesBasic, rulesNatal, rulesCustom, reportConfig, onSaveRules, onSaveReportConfig,
  darkMode, defaultTab, onThemeChange, currentUser, onUpdateUser, sales, onUpdateSales, onNotify
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SYSTEM' | 'USERS' | 'CLOUD' | 'COMMISSIONS' | 'DATA' | 'ROADMAP' | 'SOUNDS' | 'TRASH' | 'CLIENTS'>('PROFILE');
  const [commissionTab, setCommissionTab] = useState<ProductType>(ProductType.BASICA); 
  const [showMobileContent, setShowMobileContent] = useState(false);
  
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Cloud Stats (Firebase)
  const [syncStats, setSyncStats] = useState({ pending: 0, isOnline: true, isConnected: false });
  const [isSyncing, setIsSyncing] = useState(false);

  const [notificationSound, setNotificationSound] = useState('');
  const [alertSound, setAlertSound] = useState('');
  const [successSound, setSuccessSound] = useState('');
  const [warningSound, setWarningSound] = useState('');
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [targetAudioField, setTargetAudioField] = useState<string | null>(null);

  useEffect(() => {
      const loadConfig = async () => {
          const cfg = await getSystemConfig();
          setSystemConfig(cfg);
          setNotificationSound(cfg.notificationSound || '');
          setAlertSound(cfg.alertSound || '');
          setSuccessSound(cfg.successSound || '');
          setWarningSound(cfg.warningSound || '');
      };
      loadConfig();
      refreshCloudStats();
      const interval = setInterval(refreshCloudStats, 5000);
      return () => clearInterval(interval);
  }, []);

  const refreshCloudStats = async () => {
      const pending = await getPendingSyncs();
      const online = navigator.onLine;
      // @ts-ignore
      const connected = db && db.type !== 'mock' && !!auth.currentUser;
      setSyncStats({ pending: pending.length, isOnline: online, isConnected: connected });
  };

  const handleSysConfigChange = (key: keyof SystemConfig, val: any) => {
      const newConfig = { ...systemConfig, [key]: val };
      setSystemConfig(newConfig);
      saveSystemConfig(newConfig); 
      if (key === 'theme' && onThemeChange) onThemeChange(val as AppTheme);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !targetAudioField) return;
      try {
          const base64 = await fileToBase64(file);
          if (targetAudioField === 'notificationSound') setNotificationSound(base64);
          if (targetAudioField === 'successSound') setSuccessSound(base64);
          if (targetAudioField === 'alertSound') setAlertSound(base64);
          if (targetAudioField === 'warningSound') setWarningSound(base64);
          onNotify('SUCCESS', 'Áudio carregado!');
      } catch (err) {
          onNotify('ERROR', 'Erro ao carregar áudio.');
      }
      if (audioInputRef.current) audioInputRef.current.value = '';
      setTargetAudioField(null);
  };

  const handleSaveSystemSettings = () => {
      const newConfig = { 
          ...systemConfig, 
          notificationSound, alertSound, successSound, warningSound 
      };
      setSystemConfig(newConfig);
      saveSystemConfig(newConfig);
      onNotify('SUCCESS', 'Configurações salvas!');
  };

  const handleTabSelect = (id: any) => {
      setActiveTab(id);
      setShowMobileContent(true);
  };

  const isAdmin = currentUser.role === 'ADMIN';
  const hasSalesModule = currentUser.modules?.sales || isAdmin;
  const hasFinanceModule = currentUser.modules?.finance || isAdmin;

  const NavBtn = ({ id, icon: Icon, label, show = true }: any) => {
      if (!show) return null;
      const active = activeTab === id;
      return (
          <button 
            onClick={() => handleTabSelect(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all mb-1 text-left ${
                active 
                ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 shadow-md border border-indigo-100')
                : (darkMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
            }`}
          >
              <Icon size={18} />
              {label}
          </button>
      )
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 relative">
       <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />

       <div className={`w-full md:w-64 shrink-0 flex flex-col ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} rounded-xl p-4 h-fit border border-gray-200 dark:border-slate-700 ${showMobileContent ? 'hidden md:flex' : 'flex'} overflow-y-auto max-h-full`}>
           <h2 className="px-4 mb-2 mt-4 text-xs font-bold uppercase tracking-wider opacity-50">Geral</h2>
           <NavBtn id="PROFILE" icon={UserIcon} label="Meu Perfil & IA" />
           <NavBtn id="SOUNDS" icon={Volume2} label="Sons & Notificações" />
           
           <h2 className="px-4 mb-2 mt-4 text-xs font-bold uppercase tracking-wider opacity-50">Módulos</h2>
           <NavBtn id="COMMISSIONS" icon={Settings} label="Regras de Vendas" show={hasSalesModule} />
           <NavBtn id="CLIENTS" icon={Users} label="Gestão de Clientes" show={hasSalesModule} />
           <NavBtn id="DATA" icon={Database} label="Dados & Manutenção" show={hasSalesModule || hasFinanceModule} />
           <NavBtn id="TRASH" icon={Trash2} label="Lixeira" />

           {isAdmin && (
               <>
                   <div className="my-2 border-t dark:border-slate-700 border-gray-200"></div>
                   <h2 className="px-4 mb-2 mt-4 text-xs font-bold uppercase tracking-wider opacity-50">Admin</h2>
                   <NavBtn id="USERS" icon={Shield} label="Gerenciar Usuários" />
                   <NavBtn id="CLOUD" icon={Server} label="Infraestrutura Cloud" />
                   <NavBtn id="ROADMAP" icon={Hammer} label="Roadmap & Dev" />
               </>
           )}
       </div>

       <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar ${!showMobileContent ? 'hidden md:block' : 'block'}`}>
           <div className="md:hidden mb-4 flex items-center">
               <button onClick={() => setShowMobileContent(false)} className="flex items-center gap-2 text-sm font-bold px-3 py-2 bg-slate-800 text-white rounded-lg">
                   <ArrowLeft size={16} /> Voltar ao Menu
               </button>
           </div>

           {activeTab === 'PROFILE' && <UserProfile user={currentUser} onUpdate={onUpdateUser} />}
           {activeTab === 'USERS' && isAdmin && <AdminUsers currentUser={currentUser} />}
           
           {activeTab === 'CLOUD' && isAdmin && (
               <div className="space-y-6 animate-in fade-in">
                   <div className={`p-6 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-blue-500/10 p-3 rounded-full text-blue-500"><Activity size={24} /></div>
                            <div>
                                <h4 className="font-bold text-lg">Firebase Cloud Services</h4>
                                <p className="text-sm opacity-60 text-gray-500 dark:text-gray-400">Status da conexão em tempo real com o Google Cloud Firestore.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-lg bg-black/10">
                                <span className="text-xs uppercase font-bold opacity-50">Conexão</span>
                                <p className={`text-lg font-bold ${syncStats.isConnected ? 'text-emerald-500' : 'text-red-500'}`}>{syncStats.isConnected ? 'ATIVO' : 'DESCONECTADO'}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-black/10">
                                <span className="text-xs uppercase font-bold opacity-50">Internet</span>
                                <p className={`text-lg font-bold ${syncStats.isOnline ? 'text-emerald-500' : 'text-amber-500'}`}>{syncStats.isOnline ? 'ONLINE' : 'OFFLINE'}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 border-t dark:border-slate-700 pt-6">
                            <button onClick={refreshCloudStats} className="px-4 py-2 rounded-lg border font-bold text-sm">Verificar Agora</button>
                        </div>
                   </div>
               </div>
           )}

           {activeTab === 'COMMISSIONS' && hasSalesModule && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex p-1 rounded-xl w-fit flex-wrap gap-2 bg-gray-100 dark:bg-slate-800">
                    <button onClick={() => setCommissionTab(ProductType.BASICA)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.BASICA ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}>Básica</button>
                    <button onClick={() => setCommissionTab(ProductType.NATAL)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.NATAL ? 'bg-red-600 text-white shadow-md' : 'text-gray-500'}`}>Natal</button>
                    <button onClick={() => setCommissionTab(ProductType.CUSTOM)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.CUSTOM ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500'}`}>Outros</button>
                </div>
                <div className="animate-in slide-in-from-bottom-2">
                    <CommissionEditor type={commissionTab} initialRules={commissionTab === ProductType.BASICA ? rulesBasic : (commissionTab === ProductType.NATAL ? rulesNatal : rulesCustom)} onSave={(r) => onSaveRules(commissionTab, r)} readOnly={!isAdmin} currentUser={currentUser} />
                </div>
              </div>
           )}

           {activeTab === 'DATA' && (hasSalesModule || hasFinanceModule) && (
               <div className="space-y-6 animate-in fade-in">
                   {isAdmin && <DatabaseInspector darkMode={!!darkMode} />}
                   <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} rounded-xl shadow-sm border p-6`}>
                       <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Clock size={20} className="text-blue-500" /> Backup Local</h3>
                       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                           <p className="text-sm opacity-70">Sincronização com nuvem automática via Firebase SDK.</p>
                           <button onClick={() => setShowBackupModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Exportar .v360</button>
                       </div>
                   </div>
               </div>
           )}
           
           {activeTab === 'SOUNDS' && (
                <div className={`p-6 rounded-xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Volume2 size={22} className="text-purple-500" /> Sons do Sistema</h3>
                    <div className="space-y-4">
                        <SoundRow label="Venda Sucesso" value={successSound} onUpload={() => { setTargetAudioField('successSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(successSound).play()} onDelete={() => setSuccessSound('')} />
                        <SoundRow label="Notificação" value={notificationSound} onUpload={() => { setTargetAudioField('notificationSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(notificationSound).play()} onDelete={() => setNotificationSound('')} />
                    </div>
                    <button onClick={handleSaveSystemSettings} className="mt-8 px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl w-full md:w-auto">Salvar Sons</button>
                </div>
           )}

           {activeTab === 'TRASH' && <TrashBin darkMode={!!darkMode} />}
           {activeTab === 'ROADMAP' && isAdmin && <DevRoadmap />}
       </div>

       <BackupModal isOpen={showBackupModal} mode="BACKUP" onClose={() => setShowBackupModal(false)} onSuccess={() => {}} />
    </div>
  );
};

const SoundRow = ({ label, value, onUpload, onTest, onDelete }: any) => (
    <div className="p-4 rounded-xl border bg-black/5 dark:bg-black/20 border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <span className="font-bold text-sm">{label}</span>
        <div className="flex gap-2">
            {value && <button onClick={onTest} className="p-2 text-blue-500"><PlayCircle size={18}/></button>}
            <button onClick={onUpload} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold">{value ? 'Trocar' : 'Upload'}</button>
            {value && <button onClick={onDelete} className="p-2 text-red-500"><Trash2 size={18}/></button>}
        </div>
    </div>
);

const ThemeCard = ({ themeId, name, colors, active, onSelect }: any) => (
    <button onClick={() => onSelect(themeId)} className={`p-2 rounded-lg border-2 transition-all ${active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent'}`}>
        <div className="flex gap-1 h-4 w-full rounded overflow-hidden mb-1">
            {colors.map((c: string) => <div key={c} className="flex-1 h-full" style={{background: c}}></div>)}
        </div>
        <span className="text-[10px] font-bold uppercase">{name}</span>
    </button>
);

export default SettingsHub;
