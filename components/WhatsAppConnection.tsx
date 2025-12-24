
import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Power, Terminal, CheckCircle, LogOut } from 'lucide-react';
import { createSession, getSessionStatus, logoutSession } from '../services/whatsappService';
import { auth } from '../services/firebase';

const WhatsAppConnection: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
    const [status, setStatus] = useState<'DISCONNECTED' | 'PAIRING' | 'CONNECTED'>('DISCONNECTED');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>(['> Aguardando ação...']);

    const addLog = (msg: string) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 10));

    const checkStatus = async () => {
        if (!auth.currentUser) return;
        try {
            const data = await getSessionStatus(auth.currentUser.uid);
            if (data.status === 'CONNECTED') {
                setStatus('CONNECTED');
                setQrCode(null);
            } else if (data.status === 'PAIRING' && data.qr) {
                setQrCode(data.qr);
                setStatus('PAIRING');
            } else {
                setStatus('DISCONNECTED');
            }
        } catch (e) {
            // Silently retry
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleConnect = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        addLog('Solicitando nova sessão ao backend...');
        try {
            const res = await createSession(auth.currentUser.uid);
            if (res.qr) {
                setQrCode(res.qr);
                setStatus('PAIRING');
                addLog('QR Code recebido. Escaneie no WhatsApp.');
            }
        } catch (e) {
            addLog('Erro ao conectar. Verifique o backend.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!auth.currentUser || !confirm('Deseja realmente desconectar?')) return;
        setLoading(true);
        try {
            await logoutSession(auth.currentUser.uid);
            setStatus('DISCONNECTED');
            addLog('Sessão encerrada.');
        } catch (e) {
            addLog('Erro ao encerrar sessão.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Smartphone size={28} className={status === 'CONNECTED' ? 'text-emerald-500' : 'text-gray-400'} />
                    Status da Conexão
                </h2>
                {status === 'CONNECTED' && (
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-400 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold">
                        <LogOut size={16}/> Desconectar
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`col-span-2 rounded-3xl p-8 border flex flex-col items-center justify-center min-h-[400px] ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} shadow-xl`}>
                    {status === 'DISCONNECTED' && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto shadow-inner"><Power size={32} className="text-slate-500"/></div>
                            <button onClick={handleConnect} disabled={loading} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-lg transition-all active:scale-95">
                                {loading ? <RefreshCw className="animate-spin" size={20}/> : <Power size={20}/>} Iniciar Conexão Real
                            </button>
                        </div>
                    )}
                    {status === 'PAIRING' && qrCode && (
                        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="bg-white p-4 rounded-xl shadow-2xl border-4 border-emerald-500">
                                <img src={qrCode} alt="WhatsApp QR" className="w-64 h-64"/>
                            </div>
                            <p className="text-sm font-medium text-gray-500">Abra o WhatsApp > Configurações > Dispositivos Conectados.</p>
                            <button onClick={handleConnect} className="text-xs font-bold text-blue-500 hover:underline">Novo QR Code</button>
                        </div>
                    )}
                    {status === 'CONNECTED' && (
                        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500">
                                <CheckCircle size={64} className="text-emerald-500"/>
                            </div>
                            <h3 className="text-2xl font-black">Conectado ao Cloud</h3>
                            <p className="text-gray-400">Suas campanhas serão processadas via Cloud Tasks/Redis.</p>
                        </div>
                    )}
                </div>

                <div className={`rounded-3xl border flex flex-col overflow-hidden ${darkMode ? 'bg-black border-slate-800' : 'bg-slate-900 border-slate-700'}`}>
                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
                        <Terminal size={14} className="text-emerald-500"/>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">System Monitor</span>
                    </div>
                    <div className="flex-1 p-4 font-mono text-[10px] space-y-2 overflow-y-auto">
                        {logs.map((l, i) => <div key={i} className="text-emerald-500/80">{l}</div>)}
                        {loading && <div className="text-emerald-500 animate-pulse">_</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConnection;
