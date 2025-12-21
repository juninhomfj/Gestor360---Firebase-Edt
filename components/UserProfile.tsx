
import React, { useState, useRef } from 'react';
import { User, UserStatus } from '../types';
import { logout, updateUser, deactivateUser } from '../services/auth';
import { 
  Save, User as UserIcon, LogOut, Camera, CheckCircle, 
  AlertTriangle, MessageSquare, Shield, Lock, UserX, ShieldAlert
} from 'lucide-react';
import { optimizeImage } from '../utils/fileHelper';

interface UserProfileProps {
  user: User; 
  onUpdate: (user: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user: currentUser, onUpdate }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  
  const [name, setName] = useState(currentUser.name);
  const [tel, setTel] = useState(currentUser.tel || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser.profilePhoto || '');
  const [contactVisibility, setContactVisibility] = useState(currentUser.contactVisibility || 'PUBLIC');
  
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
        tel: tel.trim(),
        profilePictureUrl: profilePhoto,
        contactVisibility: contactVisibility
      };

      await updateUser(currentUser.id, updateData);
      
      const updatedUser: User = {
        ...currentUser,
        ...updateData,
        profilePhoto: profilePhoto
      };

      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      onUpdate(updatedUser);
      localStorage.setItem('sys_session_v1', JSON.stringify(updatedUser));
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setIsSaving(true);
    try {
      await deactivateUser(currentUser.id);
      alert("Sua conta foi desativada. Você será desconectado.");
      logout();
    } catch (e) {
      alert("Erro ao desativar conta.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 1MB.");
      return;
    }
    const optimized = await optimizeImage(file, 200, 0.7);
    setProfilePhoto(optimized);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <UserIcon className="text-indigo-600" /> Meu Perfil
        </h1>
        <button onClick={logout} className="text-red-500 font-bold text-sm hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2">
            <LogOut size={18}/> Sair do Sistema
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar e Status */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-4xl font-bold text-indigo-300">{currentUser.name.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-slate-900">
                    <Camera size={16} />
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <div className="text-center">
                    <p className="font-bold dark:text-white">@{currentUser.username}</p>
                    <div className={`mt-2 inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        <Shield size={10} className="mr-1"/> {currentUser.role}
                    </div>
                </div>
            </div>

            {/* Módulos */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                    <Lock size={14} /> Módulos Disponíveis
                </h3>
                <div className="space-y-2">
                    {Object.entries(currentUser.modules).map(([mod, active]) => (
                        <div key={mod} className={`flex items-center justify-between p-2 rounded text-xs ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                            <span className="capitalize font-bold">{mod}</span>
                            {active ? <CheckCircle size={14}/> : <Lock size={14}/>}
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-4 italic text-center">Permissões gerenciadas pelo administrador.</p>
            </div>
          </div>

          {/* Dados e Configurações */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2">
                    <Shield className="text-indigo-500" size={20} /> Informações Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-slate-950 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp de Contato</label>
                        <input type="tel" value={tel} onChange={e => setTel(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-slate-950 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="+55..." />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2">
                    <MessageSquare className="text-blue-500" size={20} /> Comunicação e Chat Interno
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Minha Visibilidade</label>
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button 
                                onClick={() => setContactVisibility('PUBLIC')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${contactVisibility === 'PUBLIC' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow' : 'text-gray-500'}`}
                            >Público</button>
                            <button 
                                onClick={() => setContactVisibility('PRIVATE')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${contactVisibility === 'PRIVATE' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow' : 'text-gray-500'}`}
                            >Privado</button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">No modo privado, somente administradores poderão ver e iniciar chats com você.</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6">
                <button 
                    onClick={() => setShowDeactivateConfirm(true)}
                    className="text-red-500 text-xs font-bold hover:underline flex items-center gap-2"
                >
                    <UserX size={14}/> Desativar Minha Conta
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-12 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    <Save size={20} />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
          </div>
      </div>

      {/* Modal Confirmar Desativação */}
      {showDeactivateConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-red-500 animate-in zoom-in-95">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><ShieldAlert size={32} className="text-red-600" /></div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirmar Encerramento</h3>
                      <p className="text-sm text-gray-500 mt-2">Sua conta ficará marcada como INATIVA. Você não poderá mais logar e seus dados ficarão congelados para auditoria.</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 py-3 border rounded-lg font-bold text-gray-500">Voltar</button>
                      <button onClick={handleDeactivate} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold">Sim, Desativar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserProfile;
