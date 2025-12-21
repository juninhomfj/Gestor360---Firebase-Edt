
import React, { useState, useEffect, useRef } from 'react';
import { User, InternalMessage } from '../types';
import { sendMessage, getMessages, markMessageRead, subscribeToMessages } from '../services/internalChat';
import { listUsers } from '../services/auth';
import { Send, Image as ImageIcon, X, User as UserIcon, Shield, CheckCheck, Loader2, Users, Search, Paperclip, MessageSquare } from 'lucide-react';
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

    const isAdmin = currentUser.role === 'ADMIN';

    // 1. Carga Inicial e Realtime Subscription
    useEffect(() => {
        if (!isOpen) return;

        loadData();
        
        // Subscreve ao canal Realtime
        const channel = subscribeToMessages(currentUser.id, isAdmin, (newMsg) => {
            // Filtra para mostrar apenas se for o chat ativo ou broadcast
            const isCurrentChat = (newMsg.recipientId === 'ADMIN' && newMsg.senderId === activeChatId) ||
                                 (newMsg.recipientId === activeChatId) ||
                                 (newMsg.recipientId === 'BROADCAST' && activeChatId === 'BROADCAST');
            
            if (isCurrentChat) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === newMsg.id);
                    if (exists) return prev;
                    return [...prev, newMsg].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                });
                
                // Som de notificação se não for do próprio usuário
                if (newMsg.senderId !== currentUser.id) {
                    AudioService.play('NOTIFICATION');
                }
            }
        });

        if (channel) {
            setIsLive(true);
        }

        return () => {
            channel?.unsubscribe();
            setIsLive(false);
        };
    }, [isOpen, activeChatId]);

    const loadData = async () => {
        const [allMsgs, allUsers] = await Promise.all([
            getMessages(currentUser.id, isAdmin),
            listUsers()
        ]);
        
        setUsers(allUsers);

        let filtered = [];
        if (!isAdmin) {
            filtered = allMsgs;
            // Marcar lidas
            allMsgs.forEach(msg => {
                if (!msg.read && msg.senderId !== currentUser.id) {
                    markMessageRead(msg.id, currentUser.id);
                }
            });
        } else {
            if (activeChatId === 'BROADCAST') {
                filtered = allMsgs.filter(m => m.recipientId === 'BROADCAST');
            } else {
                filtered = allMsgs.filter(m => 
                    (m.senderId === activeChatId && m.recipientId === 'ADMIN') || 
                    (m.senderId === currentUser.id && m.recipientId === activeChatId)
                );
                // Marcar lidas
                filtered.forEach(msg => {
                    if (!msg.read && msg.senderId === activeChatId) {
                        markMessageRead(msg.id, currentUser.id);
                    }
                });
            }
        }
        setMessages(filtered.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, activeChatId]);

    const handleSend = async () => {
        if (!inputText.trim() && !selectedImage) return;
        setIsSending(true);

        let recipient = 'ADMIN';
        let type: any = 'CHAT';

        if (isAdmin) {
            recipient = activeChatId; 
            if (activeChatId === 'BROADCAST') type = 'BROADCAST';
        }

        try {
            const sentMsg = await sendMessage(
                currentUser,
                inputText,
                type,
                recipient,
                selectedImage || undefined
            );

            // Adiciona localmente para feedback instantâneo (Optimistic UI)
            setMessages(prev => [...prev, sentMsg]);
            setInputText('');
            setSelectedImage(null);
            AudioService.play('SUCCESS');
        } catch (e) {
            alert("Erro ao enviar mensagem.");
        } finally {
            setIsSending(false);
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("Imagem muito grande (Max 2MB).");
                return;
            }
            const base64 = await fileToBase64(file);
            setSelectedImage(base64);
        }
    };

    const filteredUsers = users.filter(u => 
        u.id !== currentUser.id && 
        (u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.username.toLowerCase().includes(searchUser.toLowerCase()))
    );

    const visibleUsers = isAdmin ? filteredUsers : filteredUsers.filter(u => u.role === 'ADMIN' || u.contactVisibility === 'PUBLIC');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
            <div className={`w-full md:max-w-4xl h-[100dvh] md:h-[80vh] flex overflow-hidden md:rounded-2xl shadow-2xl border animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
                
                {/* SIDEBAR */}
                <div className={`hidden md:flex w-1/3 border-r flex-col ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="p-4 border-b border-gray-200 dark:border-slate-800">
                        <h3 className="font-bold text-lg mb-4">Conversas</h3>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input 
                                className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200'}`}
                                placeholder="Buscar pessoa..."
                                value={searchUser}
                                onChange={e => setSearchUser(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isAdmin && (
                            <button 
                                onClick={() => setActiveChatId('BROADCAST')}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors border-b border-gray-100 dark:border-slate-800 ${activeChatId === 'BROADCAST' ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg">
                                    <Users size={20}/>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm">Canal de Transmissão</p>
                                    <p className="text-xs text-gray-500">Enviar para todos</p>
                                </div>
                            </button>
                        )}

                        {visibleUsers.map(user => (
                            <button 
                                key={user.id}
                                onClick={() => setActiveChatId(user.id)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors border-b border-gray-100 dark:border-slate-800 ${activeChatId === user.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                            >
                                <div className="relative">
                                    {user.profilePhoto ? (
                                        <img src={user.profilePhoto} className="w-10 h-10 rounded-full object-cover border border-white/20" alt=""/>
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                                            {user.name.charAt(0)}
                                        </div>
                                    )}
                                    {user.role === 'ADMIN' && (
                                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-900">
                                            <Shield size={10}/>
                                        </div>
                                    )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{user.name}</p>
                                    <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-black/20 h-full">
                    {/* HEADER */}
                    <div className={`p-4 border-b flex justify-between items-center shadow-sm z-10 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                            {isAdmin && activeChatId === 'BROADCAST' ? (
                                <>
                                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg">
                                        <Users size={20}/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Transmissão Geral</h3>
                                        {isLive && (
                                            <p className="text-xs text-orange-500 font-bold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                                Tempo Real Ativo
                                            </p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-slate-700 flex items-center justify-center font-bold">
                                        {users.find(u => u.id === activeChatId)?.name.charAt(0) || <UserIcon/>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold">
                                            {users.find(u => u.id === activeChatId)?.name || 'Suporte'}
                                        </h3>
                                        {isLive && (
                                            <p className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                Chat Realtime
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500">
                            <X size={24}/>
                        </button>
                    </div>

                    {/* MESSAGES */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="h-full flex items-center justify-center opacity-30">
                                <p className="text-center">
                                    <MessageSquare size={48} className="mx-auto mb-2"/>
                                    Inicie a conversa...
                                </p>
                            </div>
                        )}
                        
                        {messages.map(msg => {
                            const isMe = msg.senderId === currentUser.id;
                            const isBroadcast = msg.recipientId === 'BROADCAST';
                            
                            return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                                    <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative ${
                                        isBroadcast 
                                        ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800'
                                        : (isMe ? 'bg-blue-600 text-white rounded-tr-sm shadow-indigo-500/20' : 'bg-white dark:bg-slate-800 dark:text-white rounded-tl-sm border border-gray-200 dark:border-slate-700')
                                    }`}>
                                        {!isMe && isBroadcast && (
                                            <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">📢 Comunicado Oficial</p>
                                        )}
                                        {!isMe && !isBroadcast && (
                                            <p className="text-[10px] font-bold opacity-50 mb-1">{msg.senderName}</p>
                                        )}
                                        
                                        {msg.image && (
                                            <div className="mb-2 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                                                <img src={msg.image} className="max-w-full cursor-pointer hover:opacity-90" onClick={() => window.open(msg.image)} alt="Attachment" />
                                            </div>
                                        )}
                                        
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        
                                        <div className={`flex justify-end items-center gap-1 mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                            <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            {isMe && !isBroadcast && (
                                                <CheckCheck size={12} className={msg.read ? 'text-green-300' : ''}/>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* INPUT AREA */}
                    <div className={`p-4 ${darkMode ? 'bg-slate-900' : 'bg-white'} border-t border-gray-200 dark:border-slate-800 safe-area-pb`}>
                        {selectedImage && (
                            <div className="flex items-center gap-2 mb-2 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg w-fit border border-indigo-100 dark:border-indigo-800">
                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Imagem pronta para envio</span>
                                <button onClick={() => setSelectedImage(null)} className="text-red-500 hover:text-red-600"><X size={14}/></button>
                            </div>
                        )}
                        <div className="flex gap-2 items-end">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                <Paperclip size={20}/>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                            
                            <textarea 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={activeChatId === 'BROADCAST' ? "Escreva um comunicado para todos..." : "Digite sua mensagem..."}
                                className={`flex-1 p-3 rounded-xl border resize-none focus:ring-2 focus:ring-blue-500 outline-none max-h-32 min-h-[48px] ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                rows={1}
                            />
                            
                            <button 
                                onClick={handleSend}
                                disabled={(!inputText.trim() && !selectedImage) || isSending}
                                className={`p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-all active:scale-90 ${(!inputText.trim() && !selectedImage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InternalChatSystem;
