
import React, { useState, useEffect, useRef } from 'react';
import { CommissionRule, ProductType, ReportConfig, SystemConfig, AppTheme, User, Sale, AiUsageStats, ProductLabels, DuplicateGroup, Transaction, SyncEntry } from '../types';
import CommissionEditor from './CommissionEditor';
import ClientList from './ClientList';
import { Settings, Shield, Server, Volume2, Trash2, Database, User as UserIcon, Palette, Activity, Hammer, X, ArrowLeft, Users, Save, PlayCircle, Plus, Bell, Key, MessageSquare } from 'lucide-react';
import { getSystemConfig, saveSystemConfig, DEFAULT_SYSTEM_CONFIG } from '../services/logic';
import { dbGetAll } from '../storage/db';
import { auth, db } from '../services/firebase';
import { fileToBase64 } from '../utils/fileHelper';
import BackupModal from './BackupModal';
import UserProfile from './UserProfile';
import AdminUsers from './AdminUsers';
import DevRoadmap from './DevRoadmap';
import TrashBin from './TrashBin'; 
import AdminMessaging from './AdminMessaging';

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
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SYSTEM' | 'USERS' | 'CLOUD' | 'COMMISSIONS' | 'ROADMAP' | 'SOUNDS' | 'TRASH' | 'CLIENTS' | 'MESSAGING'>('PROFILE');
  const [commissionTab, setCommissionTab] = useState<ProductType>(ProductType.BASICA); 
  const [showMobileContent, setShowMobileContent] = useState(false);
  
  const [systemConfig, setSystemConfig] = useState<SystemConfig & { fcmServerKey?: string }>(DEFAULT_SYSTEM_CONFIG);
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
      onNotify('SUCCESS', 'Configurações de sistema atualizadas!');
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
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all mb-1 text-left ${
                active 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                : (darkMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100')
            }`}
          >
              <Icon size={18} className={active ? 'text-white' : 'text-indigo-500'} />
              {label}
          </button>
      )
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col md:flex-row gap-6 relative animate-in fade-in pb-20">
       <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />

       {/* Sidebar Menu */}
       <div className={`w-full md:w-64 shrink-0 flex flex-col gap-1 ${showMobileContent ? 'hidden md:flex' : 'flex'}`}>
           <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200'} shadow-sm`}>
               <h2 className="px-2 mb-4 text-[10px] font-black uppercase tracking-widest text-indigo-500">Perfil & App</h2>
               <NavBtn id="PROFILE" icon={UserIcon} label="Meu Perfil" />
               <NavBtn id="SOUNDS" icon={Volume2} label="Sons & Avisos" />
               <NavBtn id="SYSTEM" icon={Settings} label="Sistema (Admin)" show={isAdmin} />
               
               <h2 className="px-2 mb-4 mt-6 text-[10px] font-black uppercase tracking-widest text-indigo-500">Módulos</h2>
               <NavBtn id="COMMISSIONS" icon={Settings} label="Tabelas de Comissão" />
               <NavBtn id="CLIENTS" icon={Users} label="Gestão de Clientes" />
               <NavBtn id="TRASH" icon={Trash2} label="Lixeira" />

               {(isAdmin || isDev) && (
                   <>
                       <div className="my-6 border-t dark:border-slate-800 border-gray-100"></div>
                       <h2 className="px-2 mb-4 text-[10px] font-black uppercase tracking-widest text-amber-500">Administração</h2>
                       <NavBtn id="USERS" icon={Shield} label="Usuários Cloud" />
                       <NavBtn id="MESSAGING" icon={Bell} label="Comunicados Hub" />
                       <NavBtn id="ROADMAP" icon={Hammer} label="Roadmap" />
                   </>
               )}
           </div>
       </div>

       {/* Content Area */}
       <div className={`flex-1 ${!showMobileContent ? 'hidden md:block' : 'block'}`}>
           {showMobileContent && (
               <div className="md:hidden mb-6 flex items-center">
                   <button onClick={() => setShowMobileContent(false)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl active:scale-95 transition-all border border-white/10">
                       <ArrowLeft size={16} /> Voltar ao Menu
                   </button>
               </div>
           )}

           <div className="space-y-6">
               {activeTab === 'PROFILE' && <UserProfile user={currentUser} onUpdate={onUpdateUser} />}
               {activeTab === 'USERS' && (isAdmin || isDev) && <AdminUsers currentUser={currentUser} />}
               {activeTab === 'MESSAGING' && (isAdmin || isDev) && <AdminMessaging currentUser={currentUser} darkMode={!!darkMode} />}
               
               {activeTab === 'SYSTEM' && isAdmin && (
                    <div className={`p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-8">
                            <Shield className="text-indigo-500" size={28}/>
                            <h3 className="text-xl font-black">Infraestrutura Administrativa</h3>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800">
                                <label className="block text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Bell size={14}/> Notificações Push (Gateway)
                                </label>
                                <p className="text-xs text-gray-500 mb-4">Insira sua <b>Server Key Legacy</b> do Firebase para habilitar notificações diretas para o seu dispositivo.</p>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                    <input 
                                        type="password"
                                        className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 ring-indigo-500 transition-all ${darkMode ? 'bg-black/40 border-slate-700 text-white' : 'bg-white border-gray-200'}`}
                                        placeholder="AAAA..."
                                        value={systemConfig.fcmServerKey || ''}
                                        onChange={e => setSystemConfig({...systemConfig, fcmServerKey: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t dark:border-slate-800 flex justify-end">
                            <button onClick={handleSaveSystemSettings} className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white font-black rounded-xl active:scale-95 transition-all shadow-xl hover:bg-indigo-700 uppercase text-xs tracking-widest">
                               <Save size={18} className="inline mr-2"/> Gravar Chave FCM
                            </button>
                        </div>
                    </div>
               )}

               {activeTab === 'COMMISSIONS' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                    <div className="flex p-1 rounded-xl w-fit flex-wrap gap-2 bg-gray-100 dark:bg-slate-800 shadow-inner">
                        <button onClick={() => setCommissionTab(ProductType.BASICA)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.BASICA ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}>Cesta Básica</button>
                        <button onClick={() => setCommissionTab(ProductType.NATAL)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.NATAL ? 'bg-red-600 text-white shadow-md' : 'text-gray-500'}`}>Cesta de Natal</button>
                    </div>
                    <div className="overflow-x-hidden">
                        <CommissionEditor 
                            type={commissionTab} 
                            initialRules={commissionTab === ProductType.BASICA ? rulesBasic : rulesNatal} 
                            onSave={(t, r) => onSaveRules(t, r)} 
                            readOnly={!isDev && !isAdmin} 
                            currentUser={currentUser} 
                        />
                    </div>
                  </div>
               )}
               
               {activeTab === 'SOUNDS' && (
                    <div className={`p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-8">
                            <Volume2 className="text-indigo-500" size={28}/>
                            <h3 className="text-xl font-black">Sons de Alerta</h3>
                        </div>
                        <div className="space-y-4">
                            <SoundRow label="Notificação Padrão" value={notificationSound} onUpload={() => { setTargetAudioField('notificationSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(notificationSound).play()} onDelete={() => setNotificationSound('')} />
                            <SoundRow label="Sucesso em Lançamento" value={successSound} onUpload={() => { setTargetAudioField('successSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(successSound).play()} onDelete={() => setSuccessSound('')} />
                            <SoundRow label="Alerta Crítico / Erro" value={alertSound} onUpload={() => { setTargetAudioField('alertSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(alertSound).play()} onDelete={() => setAlertSound('')} />
                            <SoundRow label="Aviso de Pendência" value={warningSound} onUpload={() => { setTargetAudioField('warningSound'); audioInputRef.current?.click(); }} onTest={() => new Audio(warningSound).play()} onDelete={() => setWarningSound('')} />
                        </div>
                        <div className="mt-10 pt-6 border-t dark:border-slate-800 flex justify-end">
                            <button onClick={handleSaveSystemSettings} className="w-full md:w-auto px-10 py-4 bg-emerald-600 text-white font-black rounded-xl active:scale-95 transition-all shadow-xl hover:bg-emerald-700 uppercase text-xs tracking-widest">
                               <Save size={18} className="inline mr-2"/> Salvar Configurações
                            </button>
                        </div>
                    </div>
               )}

               {activeTab === 'TRASH' && <TrashBin darkMode={!!darkMode} />}
               {activeTab === 'ROADMAP' && (isAdmin || isDev) && <DevRoadmap />}
               {activeTab === 'CLIENTS' && <ClientList currentUser={currentUser} darkMode={!!darkMode} />}
           </div>
       </div>

       <BackupModal isOpen={showBackupModal} mode="BACKUP" onClose={() => setShowBackupModal(false)} onSuccess={() => {}} />
    </div>
  );
};

const SoundRow = ({ label, value, onUpload, onTest, onDelete }: any) => (
    <div className="p-5 rounded-2xl border bg-black/5 dark:bg-white/5 border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group transition-all hover:border-indigo-500/30">
        <div>
            <span className="font-bold text-sm block mb-0.5">{label}</span>
            <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{value ? '✓ Áudio customizado carregado' : '× Som padrão (Silencioso)'}</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            {value && <button onClick={onTest} className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl hover:scale-110 transition-transform"><PlayCircle size={18}/></button>}
            <button onClick={onUpload} className="flex-1 sm:flex-none px-5 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20">{value ? 'Trocar' : 'Carregar'}</button>
            {value && <button onClick={onDelete} className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-50 hover:text-white transition-all"><Trash2 size={18}/></button>}
        </div>
    </div>
);

export default SettingsHub;
