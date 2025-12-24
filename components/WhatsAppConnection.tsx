
import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Power, Terminal, CheckCircle, AlertCircle } from 'lucide-react';
import { createSession, getSessionStatus } from '../services/whatsappService';
import { auth } from '../services/firebase';

const WhatsAppConnection: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
    const [status, setStatus] = useState<'DISCONNECTED' | 'PAIRING' | 'CONNECTED'>('DISCONNECTED');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>(['> Sistema aguardando...']);

    const addLog = (msg: string) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 10));

    const checkStatus = async () => {
        if (!auth.currentUser) return;
        try {
            const data = await getSessionStatus(auth.currentUser.uid);
            if (data.status === 'CONNECTED') setStatus('CONNECTED');
        } catch (e) {}
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleConnect = async () => {
        if (!auth.currentUser) return alert("Logue para conectar.");
        setLoading(true);
        addLog('Solicitando nova sessão ao backend...');
        try {
            const res = await createSession(auth.currentUser.uid);
            if (res.qr) {
                setQrCode(res.qr);
                setStatus('PAIRING');
                addLog('QR Code recebido. Escaneie para conectar.');
            }
        } catch (e) {
            addLog('Erro ao conectar com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Smartphone size={28} className={status === 'CONNECTED' ? 'text-emerald-500' : 'text-gray-400'} />
                    Conexão WhatsApp
                </h2>
                {status === 'CONNECTED' && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">ONLINE</span>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`col-span-2 rounded-3xl p-8 border flex flex-col items-center justify-center min-h-[400px] ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} shadow-xl`}>
                    {status === 'DISCONNECTED' && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto"><Power size={32} className="text-slate-500"/></div>
                            <button onClick={handleConnect} disabled={loading} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-700">
                                {loading ? <RefreshCw className="animate-spin" size={20}/> : <Power size={20}/>} Iniciar Conexão
                            </button>
                        </div>
                    )}
                    {status === 'PAIRING' && qrCode && (
                        <div className="text-center space-y-4">
                            <div className="bg-white p-4 rounded-xl shadow-lg border-4 border-emerald-500">
                                <img src={qrCode} alt="WhatsApp QR" className="w-64 h-64"/>
                            </div>
                            <p className="text-sm text-gray-500">Aponte a câmera do WhatsApp para este código.</p>
                            <button onClick={handleConnect} className="text-xs font-bold text-blue-500">Gerar novo código</button>
                        </div>
                    )}
                    {status === 'CONNECTED' && (
                        <div className="text-center space-y-4">
                            <CheckCircle size={64} className="text-emerald-500 mx-auto animate-bounce"/>
                            <h3 className="text-xl font-bold">Dispositivo Conectado</h3>
                            <p className="text-gray-400">Pronto para iniciar disparos de campanhas.</p>
                        </div>
                    )}
                </div>

                <div className={`rounded-3xl border flex flex-col overflow-hidden ${darkMode ? 'bg-black border-slate-800' : 'bg-slate-900 border-slate-700'}`}>
                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center gap-2"><Terminal size={14} className="text-emerald-500"/><span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Logs em Tempo Real</span></div>
                    <div className="flex-1 p-4 font-mono text-[10px] space-y-1 overflow-y-auto">
                        {logs.map((l, i) => <div key={i} className="text-emerald-500/80">{l}</div>)}
                        <div className="w-2 h-4 bg-emerald-500 animate-pulse inline-block"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConnection;
