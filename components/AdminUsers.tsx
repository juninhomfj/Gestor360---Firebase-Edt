
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserModules, UserStatus } from '../types';
import { listUsers, createUser, updateUser, resendInvitation } from '../services/auth';
// Fix: Added missing 'atomicClearUserTables' to imports from services/logic
import { atomicClearUserTables } from '../services/logic';
import { 
    Trash2, Plus, Shield, Mail, AlertTriangle, 
    RefreshCw, Edit2, Check, Loader2, Send, Lock, Bomb, X, Clock, Database, ShoppingCart, DollarSign
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
    { id: 'sales', label: 'Vendas e Comissões', icon: ShoppingCart },
    { id: 'transactions', label: 'Financeiro (Extrato)', icon: DollarSign },
    { id: 'clients', label: 'Carteira de Clientes', icon: Shield },
    { id: 'receivables', label: 'Contas a Receber', icon: Database },
    { id: 'config', label: 'Configurações de Layout', icon: Edit2 },
];

const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [showInviteSuccess, setShowInviteSuccess] = useState<{ isOpen: boolean, email: string }>({ isOpen: false, email: '' });

  // Form State
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
      if (!resetPassword) return alert("Digite sua senha administrativa para confirmar.");
      if (!hardResetModal.targetUser) return;
      if (selectedTables.length === 0) return alert("Selecione pelo menos uma tabela para limpar.");
      
      // Validação de Segurança Firestore (RLS)
      if (hardResetModal.targetUser.id !== currentUser.id) {
          alert("Limitação de Segurança: Regras nativas do Firestore impedem que o Client SDK apague dados de outros usuários. Esta ação só funcionará se você estiver limpando sua própria conta.");
          return;
      }

      setIsResetting(true);
      try {
          await atomicClearUserTables(hardResetModal.targetUser.id, selectedTables);
          
          alert(`Tentativa de limpeza concluída! Se você possui permissões de escrita nos documentos, os dados foram resetados.`);
          
          setHardResetModal({ isOpen: false, targetUser: null });
          setResetPassword('');
          setSelectedTables(['sales']);
          
          if (hardResetModal.targetUser.id === currentUser.id) {
              window.location.reload();
          }
      } catch (e: any) {
          alert("Erro no reset: " + e.message);
      } finally {
          setIsResetting(false);
      }
  };

  const toggleTableSelection = (id: string) => {
      setSelectedTables(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleOpenEdit = (u: User) => {
      setEditingId(u.id);
      setNewName(u.name);
      setNewEmail(u.email);
      setNewRole(u.role);
      setNewModules(u.permissions || DEFAULT_MODULES);
      setIsFormOpen(true);
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

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          if (editingId) {
              await updateUser(editingId, { name: newName, role: newRole, permissions: newModules });
          } else {
              await createUser(currentUser.id, { name: newName, email: newEmail, role: newRole, modules_config: newModules });
              setShowInviteSuccess({ isOpen: true, email: newEmail });
          }
          resetForm();
          loadUsers();
      } catch(e: any) {
          setError(e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const getStatusBadge = (status: UserStatus) => {
      switch (status) {
          case 'ACTIVE': return <span className="text-emerald-500 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> ATIVO</span>;
          case 'PENDING': return <span className="text-amber-500 font-bold flex items-center gap-1"><Clock size={12}/> PENDENTE</span>;
          default: return <span className="text-red-500 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> BLOQUEADO</span>;
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <Shield size={24} className="text-indigo-600"/> Usuários Cloud Native
                </h3>
                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest opacity-60">Diretório Root: {users.length} perfis</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={loadUsers} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 transition-colors">
                    <RefreshCw size={20} className={isLoading ? "animate-spin text-indigo-500" : ""}/>
                </button>
                <button 
                    onClick={() => { resetForm(); setIsFormOpen(true); }}
                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all"
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
                        {editingId ? 'Editar Perfil Root' : 'Configurar Novo Usuário'}
                    </h4>
                    <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full"><X size={24}/></button>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Nome Completo</label>
                            <input className="w-full bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 p-4 rounded-xl outline-none focus:ring-2 ring-indigo-500 font-bold dark:text-white" value={newName} onChange={e => setNewName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">E-mail Corporativo</label>
                            <input type="email" className="w-full bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 p-4 rounded-xl outline-none focus:ring-2 ring-indigo-500 font-bold disabled:opacity-50 dark:text-white" value={newEmail} onChange={e => setNewEmail(e.target.value)} required disabled={!!editingId} />
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-slate-950/50 rounded-2xl border dark:border-slate-800">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">Nível de Autoridade</label>
                        <div className="flex flex-wrap gap-4 mb-8">
                            {['USER', 'ADMIN', 'DEV'].map(r => (
                                <button key={r} type="button" onClick={() => setNewRole(r as any)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all border ${newRole === r ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white dark:bg-slate-900 text-gray-400 border-gray-200 dark:border-slate-800'}`}>{r}</button>
                            ))}
                        </div>

                        <label className="block text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">Módulos Ativos</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.keys(DEFAULT_MODULES).map((mod) => (
                                <button
                                    key={mod}
                                    type="button"
                                    onClick={() => setNewModules(prev => ({ ...prev, [mod]: !prev[mod as keyof UserModules] }))}
                                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${newModules[mod as keyof UserModules] ? 'bg-emerald-500/10 border-emerald-500 shadow-md' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'}`}
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${newModules[mod as keyof UserModules] ? 'bg-emerald-50 text-white' : 'border-gray-300'}`}>
                                        {newModules[mod as keyof UserModules] && <Check size={14}/>}
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-wide ${newModules[mod as keyof UserModules] ? 'text-emerald-600' : 'text-gray-400'}`}>{mod}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button type="button" onClick={resetForm} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 rounded-xl font-bold text-gray-500">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-2xl flex items-center justify-center gap-3 transition-all hover:bg-indigo-700 active:scale-95">
                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Shield size={20}/>}
                            {editingId ? 'Sincronizar Cloud' : 'Criar e Notificar'}
                        </button>
                    </div>
                </form>
            </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b dark:border-slate-800">
                        <tr>
                            <th className="p-6">Identidade Cloud</th>
                            <th className="p-6">Nível</th>
                            <th className="p-6">Status Realtime</th>
                            <th className="p-6 text-center">Gestão de Dados</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shadow-inner shrink-0 overflow-hidden">
                                            {u.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover" alt="" /> : u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-black text-gray-900 dark:text-white text-lg flex items-center gap-2">
                                                {u.name} {u.id === currentUser.id && <span className="text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded font-black">VOCÊ</span>}
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
                                                className="p-3 bg-red-500 text-white rounded-xl hover:shadow-lg transition-all active:scale-95"
                                                title="RESET ATÔMICO SELETIVO"
                                            >
                                                <Bomb size={18}/>
                                            </button>
                                        )}
                                        <button onClick={() => handleOpenEdit(u)} className="p-3 bg-gray-100 dark:bg-slate-800 text-indigo-500 rounded-xl hover:shadow-lg transition-all"><Edit2 size={18}/></button>
                                        {u.userStatus === 'PENDING' && (
                                            <button onClick={() => resendInvitation(u.email)} className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl hover:shadow-lg transition-all"><Send size={18}/></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL RESET SELETIVO - RESTAURADA RESPONSIVIDADE E ALTURA */}
        {hardResetModal.isOpen && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 md:p-4">
                <div className="bg-slate-900 border-2 border-red-500 w-full max-w-lg rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500 shadow-lg shadow-red-500/20">
                            <Bomb size={32} className="md:size-[40px] animate-pulse" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase tracking-tighter">Limpeza Atômica</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Resetando dados de <span className="text-white font-bold">{hardResetModal.targetUser?.name}</span>.
                        </p>
                        {hardResetModal.targetUser?.id !== currentUser.id && (
                             <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-[10px] font-bold uppercase leading-tight">
                                <Shield size={12} className="inline mr-1"/> Regras de Segurança Cloud impedem a limpeza de terceiros via Web Client.
                             </div>
                        )}
                    </div>

                    <div className="space-y-3 mb-8">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Tabelas Alvo:</p>
                        <div className="grid grid-cols-1 gap-2">
                            {RESETTABLE_TABLES.map(table => (
                                <button 
                                    key={table.id}
                                    onClick={() => toggleTableSelection(table.id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedTables.includes(table.id) ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-black/40 border-slate-800 text-slate-500'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <table.icon size={18}/>
                                        <span className="text-xs font-black uppercase tracking-wide">{table.label}</span>
                                    </div>
                                    <div className={`w-5 h-5 rounded border ${selectedTables.includes(table.id) ? 'bg-red-500 text-white border-red-500' : 'border-slate-700'}`}>
                                        {selectedTables.includes(table.id) && <Check size={14}/>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                            <input 
                                type="password" 
                                placeholder="Senha de Admin"
                                className="w-full bg-black/60 border-2 border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-red-500 transition-all font-mono"
                                value={resetPassword}
                                onChange={e => setResetPassword(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleAtomicClear}
                            disabled={isResetting || !resetPassword || selectedTables.length === 0}
                            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-3xl shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                        >
                            {isResetting ? <Loader2 size={20} className="animate-spin" /> : "EXECUTAR RESET"}
                        </button>
                        <button 
                            onClick={() => setHardResetModal({ isOpen: false, targetUser: null })}
                            className="w-full py-2 text-slate-500 font-bold hover:text-white transition-colors"
                        >
                            Abortar Operação
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
