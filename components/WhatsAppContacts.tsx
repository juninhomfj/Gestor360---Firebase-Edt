
import React, { useState, useMemo } from 'react';
import { WAContact, WATag, Sale } from '../types';
import { Search, Plus, Filter, Tag, MoreHorizontal, Trash2, Edit2, Download, Upload, User, Smartphone, Calendar, Star } from 'lucide-react';
import { saveWAContact, deleteWAContact, importWAContacts, parseCSVContacts } from '../services/whatsappService';

interface WhatsAppContactsProps {
    contacts: WAContact[];
    tags: WATag[];
    onUpdate: () => void;
    darkMode: boolean;
    sales: Sale[];
}

const WhatsAppContacts: React.FC<WhatsAppContactsProps> = ({ contacts, tags, onUpdate, darkMode, sales }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTag, setFilterTag] = useState('ALL');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<WAContact | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Form State
    const [formData, setFormData] = useState({ name: '', phone: '', tags: '' });

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // --- LOGIC ---

    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
            const matchesTag = filterTag === 'ALL' || c.tags.includes(filterTag);
            return matchesSearch && matchesTag;
        });
    }, [contacts, searchTerm, filterTag]);

    const handleSave = async () => {
        if (!formData.name || !formData.phone) return;
        
        const contact: WAContact = {
            id: editingContact ? editingContact.id : crypto.randomUUID(),
            name: formData.name,
            phone: formData.phone.replace(/\D/g, ''),
            tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
            createdAt: editingContact ? editingContact.createdAt : new Date().toISOString(),
            source: 'MANUAL',
            updatedAt: new Date().toISOString()
        };

        await saveWAContact(contact);
        setIsFormOpen(false);
        setEditingContact(null);
        setFormData({ name: '', phone: '', tags: '' });
        onUpdate();
    };

    const handleEdit = (c: WAContact) => {
        setEditingContact(c);
        setFormData({ name: c.name, phone: c.phone, tags: c.tags.join(', ') });
        setIsFormOpen(true);
    };

    const handleDelete = async (ids: string[]) => {
        if (confirm(`Excluir ${ids.length} contatos?`)) {
            for (const id of ids) {
                await deleteWAContact(id);
            }
            setSelectedIds([]);
            onUpdate();
        }
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const parsed = parseCSVContacts(text);
        await importWAContacts(parsed);
        alert(`${parsed.length} contatos importados!`);
        onUpdate();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Calculate Lead Score (Simple Mock) based on Sales History logic
    // In real app, we would join with Sales table
    const getLeadScore = (phone: string) => {
        // If phone matches a sale, score 100, else 50
        const hasSale = sales.some(s => (s.client + ' ' + (s.observations || '')).includes(phone.slice(-8)));
        return hasSale ? 100 : 50;
    };

    // --- UI STYLES ---
    const bgClass = darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200';
    const textClass = darkMode ? 'text-white' : 'text-gray-800';
    const subTextClass = darkMode ? 'text-slate-400' : 'text-gray-500';
    const inputClass = darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';

    return (
        <div className="h-full flex flex-col p-4 space-y-4">
            
            {/* TOOLBAR */}
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 ${bgClass}`}>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input 
                            className={`w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                            placeholder="Buscar por nome ou telefone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <select 
                            className={`pl-9 pr-8 py-2 rounded-lg border text-sm outline-none appearance-none ${inputClass}`}
                            value={filterTag}
                            onChange={e => setFilterTag(e.target.value)}
                        >
                            <option value="ALL">Todas Tags</option>
                            <option value="Cliente_Natal">Cliente Natal</option>
                            <option value="Cliente_Basica">Cliente Básica</option>
                            {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-2">
                    {selectedIds.length > 0 && (
                        <button onClick={() => handleDelete(selectedIds)} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition-colors">
                            <Trash2 size={16}/> <span className="hidden md:inline">Excluir ({selectedIds.length})</span>
                        </button>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <Upload size={16}/> <span className="hidden md:inline">Importar</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportCSV} />
                    
                    <button onClick={() => { setEditingContact(null); setFormData({name:'', phone:'', tags:''}); setIsFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">
                        <Plus size={16}/> <span className="hidden md:inline">Novo Contato</span>
                    </button>
                </div>
            </div>

            {/* DATA TABLE (CRM STYLE) */}
            <div className={`flex-1 rounded-xl border overflow-hidden flex flex-col ${bgClass}`}>
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-xs uppercase font-bold border-b ${darkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            <tr>
                                <th className="p-4 w-10">
                                    <input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? filteredContacts.map(c => c.id) : [])} checked={selectedIds.length === filteredContacts.length && filteredContacts.length > 0} />
                                </th>
                                <th className="p-4">Nome / Lead</th>
                                <th className="p-4">Telefone</th>
                                <th className="p-4">Tags (Segmentação)</th>
                                <th className="p-4">Score</th>
                                <th className="p-4">Origem</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                            {filteredContacts.map(contact => (
                                <tr key={contact.id} className={`group hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${selectedIds.includes(contact.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <td className="p-4">
                                        <input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={() => setSelectedIds(prev => prev.includes(contact.id) ? prev.filter(id => id !== contact.id) : [...prev, contact.id])} />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'}`}>
                                                {contact.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className={`font-bold ${textClass}`}>{contact.name}</div>
                                                <div className="text-[10px] opacity-60 flex items-center gap-1">
                                                    <Calendar size={10}/> Criado em {new Date(contact.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-xs opacity-80">
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={14} className="text-emerald-500"/>
                                            {contact.phone}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {contact.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                    {tag}
                                                </span>
                                            ))}
                                            {contact.tags.length === 0 && <span className="text-xs opacity-30 italic">Sem tags</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1">
                                            <Star size={14} className={getLeadScore(contact.phone) > 50 ? "text-yellow-500 fill-current" : "text-gray-300"} />
                                            <span className={`font-bold ${getLeadScore(contact.phone) > 50 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                                {getLeadScore(contact.phone)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${contact.source === 'IMPORT' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {contact.source || 'MANUAL'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(contact)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDelete([contact.id])} className="p-1.5 hover:bg-red-100 text-red-600 rounded"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredContacts.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center opacity-50">Nenhum contato encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className={`p-3 border-t text-xs opacity-60 flex justify-between ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <span>Total: {filteredContacts.length} contatos</span>
                    <span>Mostrando 1-{filteredContacts.length}</span>
                </div>
            </div>

            {/* FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95`}>
                        <h3 className={`text-xl font-bold mb-4 ${textClass}`}>{editingContact ? 'Editar Contato' : 'Novo Contato'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${subTextClass}`}>Nome Completo</label>
                                <input className={`w-full p-2.5 rounded-lg border outline-none ${inputClass}`} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${subTextClass}`}>Telefone (WhatsApp)</label>
                                <input className={`w-full p-2.5 rounded-lg border outline-none ${inputClass}`} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="55..." />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${subTextClass}`}>Tags (separadas por vírgula)</label>
                                <input className={`w-full p-2.5 rounded-lg border outline-none ${inputClass}`} value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="Ex: VIP, Natal, Frio" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setIsFormOpen(false)} className={`flex-1 py-2.5 rounded-lg font-bold border ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-100'} ${textClass}`}>Cancelar</button>
                                <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default WhatsAppContacts;
