
import React, { useState, useEffect, useRef } from 'react';
import { User, InternalMessage } from '../types';
import { sendMessage, getMessages, markMessageRead, subscribeToMessages } from '../services/internalChat';
import { listUsers } from '../services/auth';
import { Send, Image as ImageIcon, X, User as UserIcon, Shield, CheckCheck, Loader2, Users, Search, Paperclip, MessageSquare, CheckCircle, Bug } from 'lucide-react';
import { fileToBase64 } from '../utils/fileHelper';
import { AudioService } from '../services/audioService';

interface InternalChatSystemProps {
    currentUser: User;
    isOpen: boolean;
    onClose: () => void;
    darkMode: boolean;
}

const InternalChatSystem: React.FC<InternalChatSystemProps> = ({ currentUser, isOpen, onClose, darkMode }) => {
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [activeChatId, setActiveChatId] = useState<string>('ADMIN'); 
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [searchUser, setSearchUser] = useState('');
    const [isLive, setIsLive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'DEV';

    useEffect(() => {
        if (!isOpen) return;
        loadData();
        const channel = subscribeToMessages(currentUser.id, isAdmin, (newMsg) => {
            const isCurrentChat = (newMsg.recipientId === 'ADMIN' && newMsg.senderId === activeChatId) ||
                                 (newMsg.recipientId === activeChatId) ||
                                 (newMsg.recipientId === 'BROADCAST' && activeChatId === 'BROADCAST');
            if (isCurrentChat) {
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                });
                if (newMsg.senderId !== currentUser.id) AudioService.play('NOTIFICATION');
            }
        });
        setIsLive(true);
        return () => channel?.unsubscribe();
    }, [isOpen, activeChatId]);

    const loadData = async () => {
        const [allMsgs, allUsers] = await Promise.all([getMessages(currentUser.id, isAdmin), listUsers()]);
        setUsers(allUsers);
        let filtered = [];
        if (!isAdmin) {
            filtered = allMsgs;
            allMsgs.forEach(msg => { if (!msg.read && msg.senderId !== currentUser.id) markMessageRead(msg.id, currentUser.id); });
        } else {
            if (activeChatId === 'BROADCAST') { filtered = allMsgs.filter(m => m.recipientId === 'BROADCAST'); } 
            else {
                filtered = allMsgs.filter(m => (m.senderId === activeChatId && m.recipientId === 'ADMIN') || (m.senderId === currentUser.id && m.recipientId === activeChatId));
                filtered.forEach(msg => { if (!msg.read && msg.senderId === activeChatId) markMessageRead(msg.id, currentUser.id); });
            }
        }
        setMessages(filtered.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    };

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, activeChatId]);

    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return;
        setIsSending(true);
        let recipient = isAdmin ? activeChatId : 'ADMIN';
        let type: any = 'CHAT';
        if (isAdmin && activeChatId === 'BROADCAST') type = 'BROADCAST';
        try {
            const sentMsg = await sendMessage(currentUser, inputText, type, recipient, selectedImage || undefined);
            setMessages(prev => [...prev, sentMsg]);
            setInputText('');
            setSelectedImage(null);
            AudioService.play('SUCCESS');
        } catch (e) { alert("Erro ao enviar."); } finally { setIsSending(false); }
    };

    const handleResolveTicket = async () => {
        if (!activeChatId || activeChatId === 'ADMIN') return;
        const confirmMsg = "Olá! Identificamos o problema relatado e já aplicamos a correção. Pode testar novamente?";
        await sendMessage(currentUser, confirmMsg, 'CHAT', activeChatId);
        alert("Ticket marcado como resolvido e usuário notificado.");
        loadData();
    };

    if (!isOpen) return null;

    const activeUser = users.find(u => u.id === activeChatId);
    const hasBugReport = messages.some(m => m.type === 'BUG_REPORT');

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
            <div className={`w-full md:max-w-4xl h-[100dvh] md:h-[80vh] flex overflow-hidden md:rounded-2xl shadow-2xl border animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
                
                {/* SIDEBAR */}
                <div className={`hidden md:flex w-1/3 border-r flex-col ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="p-4 border-b dark:border-slate-800">
                        <h3 className="font-bold text-lg mb-4">Conversas</h3>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200'}`} placeholder="Buscar..." value={searchUser} onChange={e => setSearchUser(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {isAdmin && (
                            <button onClick={() => setActiveChatId('BROADCAST')} className={`w-full p-4 flex items-center gap-3 border-b dark:border-slate-800 ${activeChatId === 'BROADCAST' ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white"><Users size={20}/></div>
                                <div className="text-left"><p className="font-bold text-sm">Transmissão Geral</p></div>
                            </button>
                        )}
                        {users.filter(u => u.id !== currentUser.id).map(user => (
                            <button key={user.id} onClick={() => setActiveChatId(user.id)} className={`w-full p-4 flex items-center gap-3 border-b dark:border-slate-800 ${activeChatId === user.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">{user.name.substring(0,2).toUpperCase()}</div>
                                <div className="text-left flex-1 min-w-0"><p className="font-bold text-sm truncate">{user.name}</p><p className="text-xs text-gray-500">@{user.username}</p></div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-black/20 h-full">
                    <div className={`p-4 border-b flex justify-between items-center z-10 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold">{activeUser?.name || 'Central de Mensagens'}</h3>
                            {isAdmin && hasBugReport && (
                                <button onClick={handleResolveTicket} className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-600 transition-all">
                                    <CheckCircle size={12}/> Resolver Ticket
                                </button>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500"><X size={24}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                        {messages.map(msg => {
                            const isMe = msg.senderId === currentUser.id;
                            return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.type === 'BUG_REPORT' ? 'bg-red-50 border-red-200 text-red-900' : (isMe ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700')}`}>
                                        {msg.type === 'BUG_REPORT' && <div className="flex items-center gap-2 mb-2 font-black text-[10px] uppercase text-red-600"><Bug size={14}/> Reporte de Erro</div>}
                                        {msg.image && <img src={msg.image} className="mb-2 rounded-lg max-w-full cursor-pointer" onClick={() => window.open(msg.image)} />}
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <div className="text-[9px] opacity-50 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className={`p-4 ${darkMode ? 'bg-slate-900' : 'bg-white'} border-t dark:border-slate-800`}>
                        <div className="flex gap-2 items-end">
                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-blue-500"><Paperclip size={20}/></button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async e => {
                                const f = e.target.files?.[0]; if(f) setSelectedImage(await fileToBase64(f));
                            }} />
                            <textarea 
                                value={inputText} onChange={e => setInputText(e.target.value)}
                                className={`flex-1 p-3 rounded-xl border outline-none resize-none max-h-32 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50'}`}
                                rows={1} placeholder="Digite..."
                            />
                            <button onClick={handleSend} disabled={!inputText.trim() && !selectedImage} className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg"><Send size={20}/></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InternalChatSystem;
