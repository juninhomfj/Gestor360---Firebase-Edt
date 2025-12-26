import React, { useState, useRef } from 'react';
import { User, UserStatus } from '../types';
import { logout, updateUser, deactivateUser } from '../services/auth';
import { 
  Save, User as UserIcon, LogOut, Camera, CheckCircle, 
  AlertTriangle, MessageSquare, Shield, Lock, UserX, ShieldAlert, Key
} from 'lucide-react';
import { optimizeImage } from '../utils/fileHelper';

interface UserProfileProps {
  user: User; 
  onUpdate: (user: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user: currentUser, onUpdate }) => {
  const isSuper = currentUser.role === 'DEV' || currentUser.role === 'ADMIN';
  const isRoot = currentUser.role === 'DEV';
  
  const [name, setName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username || '');
  const [tel, setTel] = useState(currentUser.tel || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser.profilePhoto || '');
  const [contactVisibility, setContactVisibility] = useState(currentUser.contactVisibility || 'PUBLIC');
  
  const [modules, setModules] = useState(currentUser.permissions || {});
  
  const [isSaving, setIsSaving] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const updateData = {
        name: name.trim(),
        username: username.trim(),
        tel: tel.trim(),
        profilePictureUrl: profilePhoto,
        contactVisibility: contactVisibility,
        permissions: modules
      };

      await updateUser(currentUser.id, updateData);
      const updatedUser: User = { ...currentUser, ...updateData, profilePhoto: profilePhoto } as any;

      setMessage({ type: 'success', text: 'Perfil atualizado!' });
      onUpdate(updatedUser);
      localStorage.setItem('sys_session_v1', JSON.stringify(updatedUser));
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erro ao salvar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateUser(currentUser.id);
      logout();
    } catch (e) {
      alert("Erro ao desativar.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const optimized = await optimizeImage(file, 200, 0.7);
    setProfilePhoto(optimized);
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
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FOTO E MÓDULOS */}
          <div className="space-y-6 order-2 lg:order-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" /> : <div className="text-4xl font-bold text-indigo-300">{currentUser.name.charAt(0).toUpperCase()}</div>}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-slate-900"><Camera size={16} /></button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white">@{username || 'usuario'}</p>
                    <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentUser.role === 'DEV' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        <Shield size={10} className="mr-1"/> {currentUser.role}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-xs font-black text-gray-400 uppercase mb-4 flex items-center gap-2 tracking-widest">
                    <Lock size={14} /> Permissões de Acesso
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {Object.keys(modules).map((mod) => (
                        <div key={mod} className={`flex items-center justify-between p-2 rounded-lg text-[10px] font-bold uppercase transition-all ${modules[mod as keyof typeof modules] ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                            <span className="truncate">{mod}</span>
                            {modules[mod as keyof typeof modules] ? <CheckCircle size={12}/> : <Lock size={12}/>}
                        </div>
                    ))}
                </div>
                {!isSuper && <p className="text-[10px] text-gray-400 mt-4 italic text-center">Permissões bloqueadas pelo Admin.</p>}
            </div>
          </div>

          {/* DADOS CADASTRAIS */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <Shield className="text-indigo-500" size={16} /> Identidade do Usuário
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nome Completo</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Apelido / Usuário</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Telefone Corporativo</label>
                        <input type="tel" value={tel} onChange={e => setTel(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="+55..." />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">E-mail (Login)</label>
                        <input type="email" value={currentUser.email} disabled className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-slate-800 opacity-50 text-gray-400 font-mono text-sm" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6">
                <button onClick={() => setShowDeactivateConfirm(true)} className="text-red-500 text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-2"><UserX size={14}/> Desativar Conta</button>
                <button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-12 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/20 active:scale-95 disabled:opacity-50 transition-all uppercase text-xs tracking-widest">
                    <Save size={20} /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
          </div>
      </div>

      {showDeactivateConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-8 shadow-2xl border-2 border-red-500 animate-in zoom-in-95">
                  <div className="text-center mb-8">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={40} className="text-red-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Confirmar Inativação?</h3>
                      <p className="text-sm text-gray-500 mt-2">Você perderá acesso imediato. Dados serão preservados conforme política da empresa.</p>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 py-4 border rounded-xl font-bold text-gray-600 dark:text-gray-300">Voltar</button>
                      <button onClick={handleDeactivate} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black shadow-lg">Sim, Inativar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserProfile;