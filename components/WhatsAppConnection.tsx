
import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Power, Terminal, CheckCircle, LogOut, Info, ShieldCheck } from 'lucide-react';
import { createSession, getSessionStatus, logoutSession, checkBackendHealth } from '../services/whatsappService';
import { auth } from '../services/firebase';

const WhatsAppConnection: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
    const [status, setStatus] = useState<'DISCONNECTED' | 'PAIRING' | 'CONNECTED' | 'STANDALONE'>('DISCONNECTED');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>(['> Sistema pronto para envios nativos.']);

    const addLog = (msg: string) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 10));

    const checkStatus = async () => {
        if (!auth.currentUser) return;
        const isHealthy = await checkBackendHealth();
        
        if (!isHealthy) {
            setStatus('STANDALONE');
            return;
        }

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
            setStatus('STANDALONE');
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleConnect = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        addLog('Tentando estabelecer conexão com o Cloud Service...');
        try {
            const res = await createSession(auth.currentUser.uid);
            if (res.qr) {
                setQrCode(res.qr);
                setStatus('PAIRING');
                addLog('QR Code gerado. Escaneie para automação total.');
            } else if (res.status === 'STANDALONE') {
                setStatus('STANDALONE');
                addLog('Cloud Service indisponível. Operando em modo manual nativo.');
            }
        } catch (e) {
            setStatus('STANDALONE');
            addLog('Falha de conexão. Modo manual ativado automaticamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Smartphone size={28} className={status === 'CONNECTED' ? 'text-emerald-500' : 'text-indigo-400'} />
                    Status de Envio
                </h2>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${status === 'STANDALONE' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {status === 'STANDALONE' ? 'MODO NATIVO (MANUAL)' : 'MODO CLOUD (AUTO)'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`col-span-2 rounded-3xl p-8 border flex flex-col items-center justify-center min-h-[400px] ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} shadow-xl`}>
                    
                    {status === 'STANDALONE' && (
                        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-indigo-500 shadow-lg">
                                <ShieldCheck size={48} className="text-indigo-500"/>
                            </div>
                            <div className="max-w-md">
                                <h3 className="text-2xl font-black mb-2">Envio Nativo Ativo</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    O sistema está operando via <b>Firebase Firestore</b>. 
                                    Suas campanhas são salvas na nuvem e os envios utilizam a tecnologia de link direto, 
                                    garantindo 100% de segurança contra bloqueios sem precisar de servidores externos.
                                </p>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl text-left border border-indigo-100 dark:border-indigo-800">
                                <div className="flex items-start gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                                    <Info size={16} className="shrink-0"/>
                                    <span>Neste modo, você clica em "Enviar" e o sistema prepara o WhatsApp para você. O histórico é gravado automaticamente.</span>
                                </div>
                            </div>
                            <button onClick={handleConnect} disabled={loading} className="text-xs font-bold text-gray-400 hover:text-indigo-500 transition-colors">
                                {loading ? 'Tentando reconectar Cloud...' : 'Tentar ativar Modo Cloud Total'}
                            </button>
                        </div>
                    )}

                    {status === 'DISCONNECTED' && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto shadow-inner"><Power size={32} className="text-slate-500"/></div>
                            <button onClick={handleConnect} disabled={loading} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-lg transition-all active:scale-95">
                                {loading ? <RefreshCw className="animate-spin" size={20}/> : <Power size={20}/>} Iniciar Conexão Cloud
                            </button>
                        </div>
                    )}

                    {status === 'CONNECTED' && (
                        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500">
                                <CheckCircle size={64} className="text-emerald-500"/>
                            </div>
                            <h3 className="text-2xl font-black">Nuvem Sincronizada</h3>
                            <p className="text-gray-400">Automação total via Redis/Workers habilitada.</p>
                        </div>
                    )}
                </div>

                <div className={`rounded-3xl border flex flex-col overflow-hidden ${darkMode ? 'bg-black border-slate-800' : 'bg-slate-900 border-slate-700'}`}>
                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
                        <Terminal size={14} className="text-indigo-400"/>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Logs do Sistema</span>
                    </div>
                    <div className="flex-1 p-4 font-mono text-[10px] space-y-2 overflow-y-auto">
                        {logs.map((l, i) => <div key={i} className="text-indigo-300/80">{l}</div>)}
                        {loading && <div className="text-indigo-500 animate-pulse">_</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConnection;
