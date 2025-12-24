
import React, { useState, useEffect, useRef } from 'react';
import { CommissionRule, ProductType, ReportConfig, SystemConfig, AppTheme, User, Sale, AiUsageStats, ProductLabels, DuplicateGroup, Transaction, SyncEntry } from '../types';
import CommissionEditor from './CommissionEditor';
import ClientList from './ClientList';
import { Settings, Shield, Server, Volume2, Trash2, Database, User as UserIcon, Palette, Activity, Hammer, X, ArrowLeft, Users, Save, PlayCircle, Plus } from 'lucide-react';
import { getSystemConfig, saveSystemConfig, DEFAULT_SYSTEM_CONFIG } from '../services/logic';
import { getPendingSyncs } from '../storage/db';
import { auth, db } from '../services/firebase';
import { fileToBase64 } from '../utils/fileHelper';
import BackupModal from './BackupModal';
import UserProfile from './UserProfile';
import AdminUsers from './AdminUsers';
import DevRoadmap from './DevRoadmap';
import TrashBin from './TrashBin'; 

interface SettingsHubProps {
  rulesBasic: CommissionRule[];
  rulesNatal: CommissionRule[];
  rulesCustom: CommissionRule[]; 
  reportConfig: ReportConfig;
  onSaveRules: (type: ProductType, rules: CommissionRule[]) => void;
  onSaveReportConfig: (config: ReportConfig) => void;
  darkMode?: boolean;
  onThemeChange?: (theme: AppTheme) => void;
  currentUser: User;
  onUpdateUser: (user: User) => void;
  sales: Sale[]; 
  onUpdateSales: (sales: Sale[]) => void;
  onNotify: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void; 
  isAdmin: boolean;
  isDev: boolean;
}

const SettingsHub: React.FC<SettingsHubProps> = ({ 
  rulesBasic, rulesNatal, rulesCustom, reportConfig, onSaveRules, onSaveReportConfig,
  darkMode, onThemeChange, currentUser, onUpdateUser, sales, onUpdateSales, onNotify,
  isAdmin, isDev
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SYSTEM' | 'USERS' | 'CLOUD' | 'COMMISSIONS' | 'ROADMAP' | 'SOUNDS' | 'TRASH' | 'CLIENTS'>('PROFILE');
  const [commissionTab, setCommissionTab] = useState<ProductType>(ProductType.BASICA); 
  const [showMobileContent, setShowMobileContent] = useState(false);
  
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [showBackupModal, setShowBackupModal] = useState(false);

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
  }, []);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !targetAudioField) return;
      try {
          const base64 = await fileToBase64(file);
          if (targetAudioField === 'notificationSound') setNotificationSound(base64);
          if (targetAudioField === 'successSound') setSuccessSound(base64);
          if (targetAudioField === 'alertSound') setAlertSound(base64);
          if (targetAudioField === 'warningSound') setWarningSound(base64);
          onNotify('SUCCESS', 'Som carregado com sucesso!');
      } catch (err) {
          onNotify('ERROR', 'Erro ao processar áudio.');
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
      onNotify('SUCCESS', 'Sons do sistema atualizados!');
  };

  const handleTabSelect = (id: any) => {
      setActiveTab(id);
      setShowMobileContent(true);
  };

  const NavBtn = ({ id, icon: Icon, label, show = true }: any) => {
      if (!show) return null;
      const active = activeTab === id;
      return (
          <button 
            onClick={() => handleTabSelect(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all mb-1 text-left ${
                active 
                ? 'bg-indigo-600 text-white shadow-lg'
                : (darkMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100')
            }`}
          >
              <Icon size={18} />
              {label}
          </button>
      )
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 relative animate-in fade-in">
       <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />

       <div className={`w-full md:w-64 shrink-0 flex flex-col ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} rounded-xl p-4 h-fit border border-gray-200 dark:border-slate-700 ${showMobileContent ? 'hidden md:flex' : 'flex'} overflow-y-auto max-h-full`}>
           <h2 className="px-4 mb-2 mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Perfil & App</h2>
           <NavBtn id="PROFILE" icon={UserIcon} label="Meu Perfil" />
           <NavBtn id="SOUNDS" icon={Volume2} label="Sons & Avisos" />
           
           <h2 className="px-4 mb-2 mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Módulos</h2>
           <NavBtn id="COMMISSIONS" icon={Settings} label="Tabelas de Comissão" />
           <NavBtn id="CLIENTS" icon={Users} label="Gestão de Clientes" />
           <NavBtn id="TRASH" icon={Trash2} label="Lixeira" />

           {(isAdmin || isDev) && (
               <>
                   <div className="my-4 border-t dark:border-slate-700 border-gray-200"></div>
                   <h2 className="px-4 mb-2 text-[10px] font-black uppercase tracking-widest text-amber-500">Administração</h2>
                   <NavBtn id="USERS" icon={Shield} label="Gerenciar Usuários" />
                   <NavBtn id="ROADMAP" icon={Hammer} label="Roadmap & Engenharia" />
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
           {activeTab === 'USERS' && (isAdmin || isDev) && <AdminUsers currentUser={currentUser} />}
           
           {activeTab === 'COMMISSIONS' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex p-1 rounded-xl w-fit flex-wrap gap-2 bg-gray-100 dark:bg-slate-800 shadow-inner">
                    <button onClick={() => setCommissionTab(ProductType.BASICA)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.BASICA ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}>Cesta Básica</button>
                    <button onClick={() => setCommissionTab(ProductType.NATAL)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.NATAL ? 'bg-red-600 text-white shadow-md' : 'text-gray-500'}`}>Cesta de Natal</button>
                </div>
                <CommissionEditor 
                    type={commissionTab} 
                    initialRules={commissionTab === ProductType.BASICA ? rulesBasic : rulesNatal} 
                    onSave={(t, r) => onSaveRules(t, r)} 
                    readOnly={!isDev && !isAdmin} 
                    currentUser={currentUser} 
                />
              </div>
           )}
           
           {activeTab === 'SOUNDS' && (
                <div className={`p-6 rounded-xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <Volume2 className="text-indigo-500" size={24}/>
                        <h3 className="text-lg font-bold">Eventos Sonoros do Sistema</h3>
                    </div>
                    <div className="space-y-4">
                        <SoundRow label="Notificação Padrão" value={notificationSound} onUpload={() => { setTargetAudioField('notificationSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(notificationSound).play()} onDelete={() => setNotificationSound('')} />
                        <SoundRow label="Sucesso em Lançamento" value={successSound} onUpload={() => { setTargetAudioField('successSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(successSound).play()} onDelete={() => setSuccessSound('')} />
                        <SoundRow label="Alerta Crítico / Erro" value={alertSound} onUpload={() => { setTargetAudioField('alertSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(alertSound).play()} onDelete={() => setAlertSound('')} />
                        <SoundRow label="Aviso de Pendência" value={warningSound} onUpload={() => { setTargetAudioField('warningSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(warningSound).play()} onDelete={() => setWarningSound('')} />
                    </div>
                    <div className="mt-8 pt-6 border-t dark:border-slate-700">
                        <button onClick={handleSaveSystemSettings} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg hover:bg-emerald-700">
                           <Save size={20} className="inline mr-2"/> Salvar Configuração de Áudio
                        </button>
                    </div>
                </div>
           )}

           {activeTab === 'TRASH' && <TrashBin darkMode={!!darkMode} />}
           {activeTab === 'ROADMAP' && (isAdmin || isDev) && <DevRoadmap />}
           {activeTab === 'CLIENTS' && <ClientList currentUser={currentUser} darkMode={!!darkMode} />}
       </div>

       <BackupModal isOpen={showBackupModal} mode="BACKUP" onClose={() => setShowBackupModal(false)} onSuccess={() => {}} />
    </div>
  );
};

const SoundRow = ({ label, value, onUpload, onTest, onDelete }: any) => (
    <div className="p-4 rounded-xl border bg-black/5 dark:bg-black/20 border-gray-200 dark:border-slate-700 flex items-center justify-between group transition-all hover:bg-black/10 dark:hover:bg-black/30">
        <div>
            <span className="font-bold text-sm block">{label}</span>
            <span className="text-[10px] text-gray-500 font-mono">{value ? 'Arquivo Carregado' : 'Sem áudio definido (Mudo)'}</span>
        </div>
        <div className="flex gap-2">
            {value && <button onClick={onTest} className="p-2 text-emerald-500 hover:scale-110 transition-transform" title="Testar Som"><PlayCircle size={20}/></button>}
            <button onClick={onUpload} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">{value ? 'Trocar' : 'Upload'}</button>
            {value && <button onClick={onDelete} className="p-2 text-red-400 hover:text-red-500 transition-colors" title="Remover"><Trash2 size={20}/></button>}
        </div>
    </div>
);

export default SettingsHub;
