
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserModules, UserStatus } from '../types';
import { listUsers, createUser, updateUser, deactivateUser } from '../services/auth';
import { 
    Trash2, Plus, Shield, User as UserIcon, Mail, AlertTriangle, 
    Lock, ShieldAlert, RefreshCw, Layers, Edit2, CheckSquare, 
    Square, Loader2, Users, Send, UserCheck, UserX 
} from 'lucide-react';

interface AdminUsersProps {
  currentUser: User;
}

const DEFAULT_MODULES: UserModules = {
    sales: true,
    finance: true,
    whatsapp: false,
    crm: true,
    ai: true,
    dev: false,
    reports: true,
    news: true,
    receivables: true,
    distribution: true,
    imports: true,
    /* Fixed: Added missing settings permission */
    settings: true,
};

const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [newModules, setNewModules] = useState<UserModules>(DEFAULT_MODULES);
  const [error, setError] = useState('');

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
      setNewModules(u.modules || DEFAULT_MODULES);
      setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          if (editingId) {
              await updateUser(editingId, {
                  name: newName,
                  role: newRole,
                  modules_config: newModules
              });
              alert("Usuário atualizado!");
          } else {
              // Fixed: Added username to satisfy the createUser function signature.
              await createUser(currentUser.id, { 
                  name: newName, 
                  email: newEmail, 
                  username: newEmail.split('@')[0],
                  role: newRole, 
                  modules_config: newModules 
              });
              alert('Convite enviado! O usuário definirá sua senha via e-mail.');
          }
          resetForm();
          loadUsers();
      } catch(e: any) {
          setError(e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const toggleModule = (key: keyof UserModules) => {
      setNewModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleStatus = async (user: User) => {
      const newStatus: UserStatus = user.userStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (!confirm(`Deseja alterar o status de ${user.name} para ${newStatus}?`)) return;
      
      try {
          await updateUser(user.id, { userStatus: newStatus });
          loadUsers();
      } catch (e) {
          alert("Erro ao alterar status.");
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Users size={20} className="text-indigo-600"/> Gestão de Acessos Administrativa
                </h3>
                <p className="text-xs text-gray-500 mt-1">Apenas administradores podem gerenciar outros usuários e seus módulos.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={loadUsers} className="p-3 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 transition-colors">
                    <RefreshCw size={18} className={isLoading ? "animate-spin text-blue-500" : ""}/>
                </button>
                <button 
                    onClick={() => { resetForm(); setIsFormOpen(true); }}
                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={18} /> Convidar Usuário
                </button>
            </div>
        </div>

        {isFormOpen && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/50 animate-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                        {editingId ? <Edit2 size={20} /> : <Send size={20}/>}
                        {editingId ? 'Editar Permissões' : 'Configurar Novo Acesso'}
                    </h4>
                    <button onClick={resetForm}><UserX className="text-gray-400"/></button>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-6">
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertTriangle size={16}/>{error}</div>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                            <input className="w-full border p-3 rounded-lg dark:bg-slate-950 dark:border-slate-800" value={newName} onChange={e => setNewName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail (Convite)</label>
                            <input type="email" className="w-full border p-3 rounded-lg dark:bg-slate-950 dark:border-slate-800 disabled:opacity-50" value={newEmail} onChange={e => setNewEmail(e.target.value)} required disabled={!!editingId} />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Papel do Usuário (Role)</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setNewRole('USER')} className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${newRole === 'USER' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500'}`}>USER</button>
                                <button type="button" onClick={() => setNewRole('ADMIN')} className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${newRole === 'ADMIN' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500'}`}>ADMIN</button>
                            </div>
                        </div>

                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Módulos Ativos</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.keys(DEFAULT_MODULES).map((mod) => (
                                <button
                                    key={mod}
                                    type="button"
                                    onClick={() => toggleModule(mod as keyof UserModules)}
                                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${newModules[mod as keyof UserModules] ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'}`}
                                >
                                    {newModules[mod as keyof UserModules] ? <CheckSquare className="text-indigo-600" size={16}/> : <Square className="text-gray-300" size={16}/>}
                                    <span className={`text-xs font-bold capitalize ${newModules[mod as keyof UserModules] ? 'text-indigo-900 dark:text-white' : 'text-gray-400'}`}>{mod}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={resetForm} className="flex-1 py-3 bg-white border rounded-lg font-bold text-gray-500">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg flex items-center justify-center gap-2">
                            {isLoading ? <Loader2 className="animate-spin"/> : (editingId ? 'Salvar Permissões' : 'Enviar Acesso')}
                        </button>
                    </div>
                </form>
            </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-400 font-bold uppercase text-[10px] tracking-widest border-b dark:border-slate-700">
                    <tr>
                        <th className="p-4">Usuário</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                    {users.map(u => (
                        <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${u.userStatus === 'INACTIVE' ? 'opacity-50' : ''}`}>
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 font-bold">
                                        {u.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold dark:text-white">{u.name}</div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                            </td>
                            <td className="p-4">
                                <span className={`font-bold text-xs ${u.userStatus === 'ACTIVE' ? 'text-emerald-500' : 'text-red-500'}`}>{u.userStatus}</span>
                            </td>
                            <td className="p-4">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => handleOpenEdit(u)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"><Edit2 size={16}/></button>
                                    <button onClick={() => handleToggleStatus(u)} className={`p-2 rounded transition-colors ${u.userStatus === 'ACTIVE' ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                                        {u.userStatus === 'ACTIVE' ? <UserX size={16}/> : <UserCheck size={16}/>}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default AdminUsers;
