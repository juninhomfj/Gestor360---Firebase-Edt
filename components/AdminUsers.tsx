
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserModules, UserStatus } from '../types';
import { listUsers, createUser, updateUser, resendInvitation } from '../services/auth';
import { atomicClearUserTables } from '../services/logic';
import { 
    Trash2, Plus, Shield, User as UserIcon, Mail, AlertTriangle, 
    RefreshCw, Edit2, CheckSquare, Square, Loader2, Users, Send, UserCheck, UserX, Save, X, Clock, Check, Bomb, Lock, CheckCircle
} from 'lucide-react';
import InvitationSentModal from './InvitationSentModal';

interface AdminUsersProps {
  currentUser: User;
}

const DEFAULT_MODULES: UserModules = {
    sales: true, finance: true, whatsapp: false, crm: true,
    ai: true, dev: false, reports: true, news: true,
    receivables: true, distribution: true, imports: true, settings: true,
};

const RESETTABLE_TABLES = [
    { id: 'sales', label: 'Vendas' },
    { id: 'transactions', label: 'Transações Financeiras' },
    { id: 'accounts', label: 'Contas Bancárias' },
    { id: 'wa_contacts', label: 'Contatos WhatsApp' },
    { id: 'clients', label: 'Carteira de Clientes' },
    { id: 'receivables', label: 'Comissões a Receber' }
];

const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [showInviteSuccess, setShowInviteSuccess] = useState<{ isOpen: boolean, email: string }>({ isOpen: false, email: '' });

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [newModules, setNewModules] = useState<UserModules>(DEFAULT_MODULES);
  const [error, setError] = useState('');

  // Segurança Hard Reset
  const [hardResetModal, setHardResetModal] = useState<{ isOpen: boolean, targetUser: User | null }>({ isOpen: false, targetUser: null });
  const [selectedTables, setSelectedTables] = useState<string[]>(['sales']);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
      loadUsers();
  }, []);

  const loadUsers = async () => {
      setIsLoading(true);
      try {
          const u = await listUsers();
          setUsers(u);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const handleAtomicClear = async () => {
      if (!resetPassword) return alert("Digite sua senha administrativa.");
      if (!hardResetModal.targetUser) return;
      if (selectedTables.length === 0) return alert("Selecione pelo menos uma tabela para limpar.");
      
      setIsResetting(true);
      try {
          await atomicClearUserTables(hardResetModal.targetUser.id, selectedTables);
          alert(`As tabelas selecionadas (${selectedTables.length}) foram limpas.`);
          setHardResetModal({ isOpen: false, targetUser: null });
          setResetPassword('');
          setSelectedTables(['sales']);
          if (hardResetModal.targetUser.id === currentUser.id) {
              window.location.reload();
          }
      } catch (e: any) {
          alert("Falha na limpeza: " + e.message);
      } finally {
          setIsResetting(false);
      }
  };

  const toggleTableSelection = (tableId: string) => {
      setSelectedTables(prev => 
          prev.includes(tableId) ? prev.filter(t => t !== tableId) : [...prev, tableId]
      );
  };

  const resetForm = () => {
      setIsFormOpen(false);
      setEditingId(null);
      setNewName('');
      setNewEmail('');
      setNewRole('USER');
      setNewModules(DEFAULT_MODULES);
      setError('');
  };

  const handleOpenEdit = (u: User) => {
      setEditingId(u.id);
      setNewName(u.name);
      setNewEmail(u.email);
      setNewRole(u.role);
      setNewModules(u.permissions || DEFAULT_MODULES);
      setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');
      try {
          if (editingId) {
              await updateUser(editingId, {
                  name: newName,
                  role: newRole,
                  permissions: newModules
              });
              alert("Perfil atualizado no Firestore!");
          } else {
              await createUser(currentUser.id, { 
                  name: newName, 
                  email: newEmail, 
                  username: newEmail.split('@')[0],
                  role: newRole, 
                  modules_config: newModules 
              });
              setShowInviteSuccess({ isOpen: true, email: newEmail });
          }
          resetForm();
          loadUsers();
      } catch(e: any) {
          setError("Falha ao gravar no Firestore.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleResendInvite = async (user: User) => {
      setSendingInviteId(user.id);
      try {
          await resendInvitation(user.email);
          setShowInviteSuccess({ isOpen: true, email: user.email });
      } catch (e) {
          alert("Erro ao reenviar convite.");
      } finally {
          setSendingInviteId(null);
      }
  };

  const toggleModule = (key: keyof UserModules) => {
      setNewModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleStatus = async (user: User) => {
      const isActivating = !user.isActive;
      if (!confirm(`Confirmar alteração de status para ${user.name}?`)) return;
      try {
          await updateUser(user.id, { isActive: isActivating });
          loadUsers();
      } catch (e) {
          alert("Erro ao atualizar status.");
      }
  };

  const getStatusBadge = (status: UserStatus) => {
      switch (status) {
          case 'ACTIVE': 
            return <span className="flex items-center gap-1.5 text-emerald-500 font-black text-[10px] tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> ATIVO</span>;
          case 'PENDING': 
            return <span className="flex items-center gap-1.5 text-amber-500 font-black text-[10px] tracking-widest"><Clock size={12}/> PENDENTE</span>;
          case 'INACTIVE': 
            return <span className="flex items-center gap-1.5 text-red-500 font-black text-[10px] tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> BLOQUEADO</span>;
          default: 
            return <span className="text-gray-500 font-black text-[10px] tracking-widest">OFFLINE</span>;
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <Shield size={24} className="text-indigo-600"/> Usuários Cloud
                </h3>
                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest opacity-60">Diretório Firebase Native: {users.length} perfis</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={loadUsers} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 transition-colors">
                    <RefreshCw size={20} className={isLoading ? "animate-spin text-indigo-500" : ""}/>
                </button>
                <button 
                    onClick={() => { resetForm(); setIsFormOpen(true); }}
                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={20} /> Novo Acesso
                </button>
            </div>
        </div>

        {isFormOpen && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-indigo-500/20 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-8">
                    <h4 className="text-2xl font-black flex items-center gap-2 tracking-tight">
                        {editingId ? <Edit2 size={24} className="text-amber-500" /> : <Plus size={24} className="text-indigo-500"/>}
                        {editingId ? 'Editar Perfil Cloud' : 'Configurar Novo Usuário'}
                    </h4>
                    <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full"><X size={24}/></button>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-8">
                    {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-sm flex items-center gap-2 font-bold animate-in shake"><AlertTriangle size={18}/>{error}</div>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Nome Completo</label>
                            <input className="w-full bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 p-4 rounded-xl outline-none focus:ring-2 ring-indigo-500 font-bold dark:text-white" value={newName} onChange={e => setNewName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">E-mail (ID de Login)</label>
                            <input type="email" className="w-full bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 p-4 rounded-xl outline-none focus:ring-2 ring-indigo-500 font-bold disabled:opacity-50 dark:text-white" value={newEmail} onChange={e => setNewEmail(e.target.value)} required disabled={!!editingId} />
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-slate-950/50 rounded-2xl border dark:border-slate-800">
                        <div className="mb-8">
                            <label className="block text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">Nível Hierárquico</label>
                            <div className="flex flex-wrap gap-4">
                                {['USER', 'ADMIN', 'DEV'].map(r => (
                                    <button key={r} type="button" onClick={() => setNewRole(r as any)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all border ${newRole === r ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white dark:bg-slate-900 text-gray-400 border-gray-200 dark:border-slate-800'}`}>{r}</button>
                                ))}
                            </div>
                        </div>

                        <label className="block text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">Módulos Ativos</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.keys(DEFAULT_MODULES).map((mod) => (
                                <button
                                    key={mod}
                                    type="button"
                                    onClick={() => toggleModule(mod as keyof UserModules)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${newModules[mod as keyof UserModules] ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-1 ring-emerald-500/50' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'}`}
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${newModules[mod as keyof UserModules] ? 'bg-emerald-50 border-emerald-500 text-white' : 'border-gray-300'}`}>
                                        {newModules[mod as keyof UserModules] && <Check size={14}/>}
                                    </div>
                                    <span className={`text-xs font-black uppercase tracking-wide ${newModules[mod as keyof UserModules] ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{mod}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button type="button" onClick={resetForm} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 rounded-xl font-bold text-gray-500 transition-colors hover:bg-gray-200">Descartar</button>
                        <button type="submit" disabled={isLoading} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-2xl flex items-center justify-center gap-3 transition-all hover:bg-indigo-700 active:scale-95">
                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                            {editingId ? 'Sincronizar Firestore' : 'Criar e Enviar Convite'}
                        </button>
                    </div>
                </form>
            </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] border-b dark:border-slate-800">
                        <tr>
                            <th className="p-6">Identidade Cloud</th>
                            <th className="p-6">Autoridade</th>
                            <th className="p-6">Status Realtime</th>
                            <th className="p-6 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                        {users.map(u => (
                            <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${u.userStatus === 'INACTIVE' ? 'opacity-40 grayscale' : ''}`}>
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shadow-inner shrink-0 overflow-hidden border border-white/10">
                                            {u.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover" alt="" /> : u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-black text-gray-900 dark:text-white text-lg flex items-center gap-2">
                                                {u.name} {u.id === currentUser.id && <span className="text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded font-black tracking-widest">SESSÃO ATIVA</span>}
                                            </div>
                                            <div className="text-xs text-gray-400 font-mono">@{u.username} • {u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : (u.role === 'DEV' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600')}`}>{u.role}</span>
                                </td>
                                <td className="p-6">{getStatusBadge(u.userStatus)}</td>
                                <td className="p-6">
                                    <div className="flex justify-center gap-3">
                                        {(currentUser.role === 'DEV' || currentUser.role === 'ADMIN') && (
                                            <button 
                                                onClick={() => setHardResetModal({ isOpen: true, targetUser: u })}
                                                className="p-3 bg-red-500 text-white rounded-xl hover:shadow-lg transition-all"
                                                title="RESET SELETIVO (Limpa tabelas deste usuário)"
                                            >
                                                <Bomb size={18}/>
                                            </button>
                                        )}
                                        {u.userStatus === 'PENDING' && (
                                            <button 
                                                onClick={() => handleResendInvite(u)} 
                                                disabled={sendingInviteId === u.id}
                                                className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl hover:shadow-lg transition-all flex items-center gap-1"
                                                title="Reenviar link de senha"
                                            >
                                                {sendingInviteId === u.id ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                                                <span className="text-[10px] font-bold uppercase hidden lg:inline">Reenviar</span>
                                            </button>
                                        )}
                                        <button onClick={() => handleOpenEdit(u)} className="p-3 bg-gray-100 dark:bg-slate-800 text-indigo-500 rounded-xl hover:shadow-lg transition-all"><Edit2 size={18}/></button>
                                        <button onClick={() => handleToggleStatus(u)} className={`p-3 rounded-xl transition-all ${u.isActive ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500'}`}>
                                            {u.isActive ? <UserX size={18} title="Bloquear"/> : <UserCheck size={18} title="Ativar"/>}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL DE RESET SELETIVO (EVOLUÍDO) */}
        {hardResetModal.isOpen && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <div className="bg-slate-900 border-2 border-red-500 w-full max-w-lg rounded-[2.5rem] p-10 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-in zoom-in-95">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500 shadow-lg shadow-red-500/20">
                            <Bomb size={40} className="animate-pulse" />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-2">RESET SELETIVO</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Selecione quais dados de <span className="text-white font-bold">{hardResetModal.targetUser?.name}</span> deseja apagar permanentemente.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                        {RESETTABLE_TABLES.map(table => (
                            <button 
                                key={table.id}
                                onClick={() => toggleTableSelection(table.id)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${selectedTables.includes(table.id) ? 'bg-red-500/10 border-red-500 text-red-500 shadow-lg shadow-red-500/20' : 'bg-black/20 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${selectedTables.includes(table.id) ? 'bg-red-500 border-red-500 text-white' : 'border-slate-700'}`}>
                                    {selectedTables.includes(table.id) && <Check size={14}/>}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider">{table.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                            <input 
                                type="password"
                                placeholder="Confirme sua senha de Admin"
                                className="w-full bg-black/40 border-2 border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-red-500 transition-all font-mono"
                                value={resetPassword}
                                onChange={e => setResetPassword(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleAtomicClear}
                            disabled={isResetting || !resetPassword || selectedTables.length === 0}
                            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-3xl shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]"
                        >
                            {isResetting ? <Loader2 size={20} className="animate-spin" /> : "EXECUTAR LIMPEZA"}
                        </button>
                        <button 
                            onClick={() => setHardResetModal({ isOpen: false, targetUser: null })}
                            className="w-full py-2 text-slate-500 font-bold hover:text-white transition-colors"
                        >
                            Abortar Missão
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showInviteSuccess.isOpen && (
            <InvitationSentModal 
                email={showInviteSuccess.email} 
                onClose={() => setShowInviteSuccess({ isOpen: false, email: '' })} 
            />
        )}
    </div>
  );
};

export default AdminUsers;
