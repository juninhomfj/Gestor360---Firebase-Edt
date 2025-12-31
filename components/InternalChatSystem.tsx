import React, { useState, useEffect, useRef } from 'react';
import { User, InternalMessage } from '../types';
import { sendMessage, getMessages, markMessageRead, subscribeToMessages } from '../services/internalChat';
import { getTicketStats } from '../services/logic';
import { listUsers } from '../services/auth';
import { Send, Image as ImageIcon, X, User as UserIcon, Shield, CheckCheck, Loader2, Users, Search, Paperclip, MessageSquare, CheckCircle, Bug, BarChart } from 'lucide-react';
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
    const [ticketCount, setTicketCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'DEV';

    useEffect(() => {
        if (!isOpen) return;
        loadData();
        getTicketStats().then(setTicketCount);
        const channel = subscribeToMessages(currentUser.id, isAdmin, (newMsg) => {
            const isCurrentChat = (newMsg.recipientId === 'ADMIN' && newMsg.senderId === activeChatId) ||
                                 (newMsg.recipientId === activeChatId) ||
                                 (newMsg.recipientId === 'BROADCAST' && activeChatId === 'BROADCAST');
            if (isCurrentChat) {
                setMessages(prev => [...prev, newMsg].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
            }
        });
        return () => channel?.unsubscribe();
    }, [isOpen, activeChatId]);

    const loadData = async () => {
        const [allMsgs, allUsers] = await Promise.all([getMessages(currentUser.id, isAdmin), listUsers()]);
        setUsers(allUsers);
        let filtered = isAdmin 
            ? allMsgs.filter(m => (m.senderId === activeChatId && m.recipientId === 'ADMIN') || (m.senderId === currentUser.id && m.recipientId === activeChatId))
            : allMsgs;
        setMessages(filtered.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    };

    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return;
        setIsSending(true);
        try {
            const sentMsg = await sendMessage(currentUser, inputText, 'CHAT', isAdmin ? activeChatId : 'ADMIN', selectedImage || undefined);
            setMessages(prev => [...prev, sentMsg]);
            setInputText('');
            setSelectedImage(null);
        } catch (e) { alert("Erro ao enviar."); } finally { setIsSending(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in">
            <div className={`w-full md:max-w-4xl h-[100dvh] md:h-[80vh] flex overflow-hidden md:rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
                
                <div className={`hidden md:flex w-1/3 border-r flex-col ${darkMode ? 'border-slate-800 bg-slate-900' : 'bg-gray-50'}`}>
                    <div className="p-4 border-b dark:border-slate-800">
                        <h3 className="font-bold text-lg">Conversas</h3>
                        <div className="mt-2 flex items-center gap-2 p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <BarChart size={14} className="text-indigo-500"/>
                            <span className="text-[10px] font-black uppercase">Tickets Ativos: {ticketCount}</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {users.filter(u => u.id !== currentUser.id).map(user => (
                            <button key={user.id} onClick={() => setActiveChatId(user.id)} className={`w-full p-4 flex items-center gap-3 border-b dark:border-slate-800 ${activeChatId === user.id ? 'bg-indigo-900/20' : ''}`}>
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs">{user.name.substring(0,2)}</div>
                                <div className="text-left"><p className="font-bold text-sm">{user.name}</p></div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col">
                    <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                        <h3 className="font-bold">Chat Interno</h3>
                        <button onClick={onClose}><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.senderId === currentUser.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}>
                                    {msg.type === 'BUG_REPORT' && <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-[10px] uppercase"><Bug size={14}/> Ticket de Suporte</div>}
                                    <p className="text-sm">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t dark:border-slate-800">
                        <div className="flex gap-2">
                            <input className={`flex-1 p-3 rounded-xl outline-none ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`} value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Digite..." onKeyDown={e => e.key === 'Enter' && handleSend()} />
                            <button onClick={handleSend} className="p-3 bg-blue-600 text-white rounded-xl"><Send size={20}/></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InternalChatSystem;