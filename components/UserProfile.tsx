import React, { useState, useRef } from 'react';
import { User, UserPermissions } from '../types';
import { logout, updateUser, deactivateUser } from '../services/auth';
import { requestAndSaveToken } from '../services/pushService';
import { 
  Save, User as UserIcon, LogOut, Camera, CheckCircle, 
  AlertTriangle, Shield, Lock, UserX, ShieldAlert, Bell, BellRing, Loader2
} from 'lucide-react';
import { optimizeImage } from '../utils/fileHelper';
import { safeFirstChar } from '../utils/stringUtils';

interface UserProfileProps {
  user: User; 
  onUpdate: (user: User) => void;
}

const DEFAULT_MODULES_FALLBACK: UserPermissions = {
    sales: true, finance: true, crm: true, whatsapp: false,
    reports: true, ai: true, dev: false, settings: true,
    news: true, receivables: true, distribution: true, imports: true
};

const UserProfile: React.FC<UserProfileProps> = ({ user: currentUser, onUpdate }) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [tel, setTel] = useState(currentUser?.tel || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser?.profilePhoto || '');
  const [contactVisibility, setContactVisibility] = useState(currentUser?.contactVisibility || 'PUBLIC');
  
  // Proteção de inicialização: Se permissions for null/undefined, usa o fallback padrão
  const [modules, setModules] = useState<UserPermissions>(currentUser?.permissions || DEFAULT_MODULES_FALLBACK);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isRegisteringPush, setIsRegisteringPush] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const updateData = {
        name: name.trim(),
        username: username.trim(),
        tel: tel.trim(),
        profilePhoto: profilePhoto,
        contactVisibility: contactVisibility,
        permissions: modules
      };

      await updateUser(currentUser.id, updateData);
      
      const updatedUser: User = { 
        ...currentUser, 
        ...updateData 
      };

      localStorage.setItem('sys_session_v1', JSON.stringify(updatedUser));
      onUpdate(updatedUser);
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnablePush = async () => {
      if (!currentUser?.id) return;
      setIsRegisteringPush(true);
      try {
          const token = await requestAndSaveToken(currentUser.id);
          if (token) {
              setMessage({ type: 'success', text: 'Notificações Push habilitadas!' });
          } else {
              setMessage({ type: 'error', text: 'Permissão de notificação negada.' });
          }
      } catch (e) {
          setMessage({ type: 'error', text: 'Falha ao registrar para notificações.' });
      } finally {
          setIsRegisteringPush(false);
          setTimeout(() => setMessage(null), 3000);
      }
  };

  const handleDeactivate = async () => {
    if (!currentUser?.id) return;
    try {
      await deactivateUser(currentUser.id);
      logout();
    } catch (e) {
      alert("Erro ao desativar conta.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const optimized = await optimizeImage(file, 400, 0.8);
        setProfilePhoto(optimized);
    } catch (err) {
        alert("Erro ao processar imagem.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <UserIcon className="text-indigo-600" /> Meu Perfil
        </h1>
        <button onClick={logout} className="text-red-500 font-bold text-sm hover:bg-red-50 p-2 rounded-lg flex items-center gap-2">
            <LogOut size={18}/> Sair
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 flex flex-col items-center shadow-sm">
                <div className="relative mb-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                    {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-4xl font-bold text-indigo-300">{safeFirstChar(name || currentUser?.name)}</div>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2.5 rounded-full shadow-lg border-2 border-white dark:border-slate-900 hover:bg-indigo-700 transition-colors"
                  >
                    <Camera size={16} />
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white">@{username || 'usuario'}</p>
                    <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentUser?.role === 'DEV' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        <Shield size={10} className="mr-1"/> {currentUser?.role || 'USER'}
                    </div>
                </div>
                
                <div className="w-full mt-6 pt-6 border-t dark:border-slate-800">
                    <button 
                        onClick={handleEnablePush}
                        disabled={isRegisteringPush}
                        className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${currentUser?.fcmToken ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-900/20'}`}
                    >
                        {isRegisteringPush ? <Loader2 size={16} className="animate-spin"/> : (currentUser?.fcmToken ? <BellRing size={16}/> : <Bell size={16}/>)}
                        {currentUser?.fcmToken ? 'Notificações Ativas' : 'Habilitar Notificações'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-xs font-black text-gray-400 uppercase mb-4 flex items-center gap-2 tracking-widest">
                    <Lock size={14} /> Permissões
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {/* Proteção: Garante que modules nunca seja null para o Object.keys */}
                    {Object.keys(modules || {}).map((mod) => (
                        <div key={mod} className={`flex items-center justify-between p-2 rounded-lg text-[10px] font-bold uppercase transition-all ${modules[mod as keyof typeof modules] ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                            <span className="truncate">{mod}</span>
                            {modules[mod as keyof typeof modules] ? <CheckCircle size={12}/> : <Lock size={12}/>}
                        </div>
                    ))}
                </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <Shield className="text-indigo-500" size={16} /> Identidade
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nome Completo</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Apelido</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Telefone</label>
                        <input type="tel" value={tel} onChange={e => setTel(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="+55..." />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6">
                <button onClick={() => setShowDeactivateConfirm(true)} className="text-red-500 text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-2 transition-all active:scale-95"><UserX size={14}/> Desativar Conta</button>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving} 
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-12 rounded-2xl flex items-center justify-center gap-2 shadow-xl transition-all uppercase text-xs tracking-widest"
                >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    {isSaving ? 'Salvando...' : 'Gravar Alterações'}
                </button>
            </div>
          </div>
      </div>

      {showDeactivateConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-2xl p-8 shadow-2xl border-2 border-red-500 animate-in zoom-in-95">
                  <div className="text-center mb-8">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={40} className="text-red-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Inativar conta?</h3>
                      <p className="text-sm text-gray-500 mt-2">Seu acesso será bloqueado imediatamente.</p>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 py-4 border rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50">Voltar</button>
                      <button onClick={handleDeactivate} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black shadow-lg hover:bg-red-700">Confirmar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserProfile;