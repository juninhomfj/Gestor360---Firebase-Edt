
import React, { useState, useEffect } from 'react';
import { Smartphone, Link, ExternalLink, QrCode, CheckCircle, Wifi, Shield, Power, Terminal, RefreshCw, Battery, Signal } from 'lucide-react';
import { WAInstance } from '../types';

interface WhatsAppConnectionProps {
    darkMode: boolean;
}

// Simulador de instância (Mock para UI)
const MOCK_INSTANCE: WAInstance = {
    id: 'inst_001',
    name: 'Atendimento Principal',
    status: 'DISCONNECTED',
    batteryLevel: 0,
    createdAt: new Date().toISOString()
};

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ darkMode }) => {
    const [instance, setInstance] = useState<WAInstance>(MOCK_INSTANCE);
    const [logs, setLogs] = useState<string[]>(['> Sistema iniciado...', '> Aguardando comando de conexão...']);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
    };

    const handleConnect = () => {
        setLoading(true);
        setInstance(prev => ({ ...prev, status: 'PAIRING' }));
        addLog('Iniciando handshake com servidor WhatsApp...');
        
        // Simulação de delay de rede e geração de QR
        setTimeout(() => {
            addLog('Gerando QR Code de autenticação...');
            setQrCode('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=Gestor360-Auth-Token-Simulation');
            setLoading(false);
            
            // Simulação de leitura do QR Code pelo usuário (automático após 5s para demo ou clique)
            addLog('Aguardando leitura do QR Code...');
        }, 2000);
    };

    const handleSimulateScan = () => {
        if (instance.status !== 'PAIRING') return;
        
        setLoading(true);
        setQrCode(null);
        addLog('QR Code detectado! Validando credenciais...');
        
        setTimeout(() => {
            setInstance({
                ...instance,
                status: 'CONNECTED',
                phone: '5511999999999',
                batteryLevel: 85,
                profilePicUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gestor360Bot'
            });
            addLog('Sessão autenticada com sucesso.');
            addLog('Sincronizando contatos e grupos...');
            addLog('Instância pronta para uso.');
            setLoading(false);
        }, 2500);
    };

    const handleDisconnect = () => {
        if (confirm('Desconectar instância? Isso interromperá todos os envios.')) {
            setInstance(MOCK_INSTANCE);
            setQrCode(null);
            addLog('Sessão encerrada pelo usuário.');
            addLog('Instância desconectada.');
        }
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-6">
            
            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <div className="relative">
                            <Smartphone size={28} className={instance.status === 'CONNECTED' ? 'text-emerald-500' : 'text-gray-400'} />
                            {instance.status === 'CONNECTED' && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                            )}
                        </div>
                        Gerenciador de Instâncias
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Conecte seu WhatsApp para habilitar o disparador.
                    </p>
                </div>
                
                <div className="flex gap-2">
                    {instance.status === 'CONNECTED' && (
                        <div className="flex items-center gap-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                            <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                                <Battery size={14}/> {instance.batteryLevel}%
                            </div>
                            <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                                <Signal size={14}/> Online
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[400px]">
                
                {/* LEFT: SERVER STATUS / VIRTUAL MACHINE */}
                <div className={`col-span-2 rounded-3xl p-8 border relative overflow-hidden flex flex-col items-center justify-center ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-900 border-gray-200'} shadow-2xl`}>
                    
                    {/* Header do Terminal */}
                    <div className="absolute top-0 left-0 right-0 h-8 bg-slate-800 flex items-center px-4 gap-2 border-b border-slate-700">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">root@gestor360-vm:~/whatsapp-server</span>
                    </div>

                    {/* CONTEÚDO DA VM */}
                    <div className="mt-8 w-full flex flex-col items-center z-10">
                        
                        {instance.status === 'DISCONNECTED' && (
                            <div className="text-center space-y-6 animate-in zoom-in">
                                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto border-4 border-slate-700">
                                    <Power size={48} className="text-slate-500" />
                                </div>
                                <div>
                                    <h3 className="text-white text-xl font-bold">Servidor Parado</h3>
                                    <p className="text-slate-400 text-sm mt-2">Nenhuma instância ativa detectada.</p>
                                </div>
                                <button 
                                    onClick={handleConnect}
                                    disabled={loading}
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/50 transition-all flex items-center gap-2 mx-auto"
                                >
                                    {loading ? <RefreshCw size={20} className="animate-spin"/> : <Power size={20}/>}
                                    Iniciar Instância
                                </button>
                            </div>
                        )}

                        {instance.status === 'PAIRING' && (
                            <div className="text-center space-y-6 w-full max-w-sm">
                                <div 
                                    onClick={handleSimulateScan}
                                    className="bg-white p-4 rounded-xl mx-auto w-64 h-64 flex items-center justify-center relative cursor-pointer group"
                                >
                                    {qrCode ? (
                                        <>
                                            <img src={qrCode} alt="Scan Me" className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 bg-emerald-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg backdrop-blur-sm">
                                                <p className="text-white font-bold">Simular Scan</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400">
                                            <RefreshCw size={32} className="animate-spin mb-2 text-emerald-600"/>
                                            <span className="text-xs">Gerando QR Code...</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-white text-lg font-bold">Escaneie com seu Celular</h3>
                                    <p className="text-slate-400 text-xs mt-2">
                                        Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar Aparelho
                                    </p>
                                </div>
                            </div>
                        )}

                        {instance.status === 'CONNECTED' && (
                            <div className="text-center space-y-6 animate-in fade-in">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full border-4 border-emerald-500 p-1 mx-auto">
                                        <img src={instance.profilePicUrl} className="w-full h-full rounded-full object-cover bg-slate-800" />
                                    </div>
                                    <div className="absolute bottom-2 right-1/2 translate-x-12 bg-emerald-500 text-white p-1.5 rounded-full border-4 border-slate-900">
                                        <CheckCircle size={16} />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-white text-2xl font-bold">{instance.name}</h3>
                                    <p className="text-emerald-400 font-mono text-sm mt-1">{instance.phone}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                        <span className="text-slate-400 text-xs uppercase font-bold block mb-1">Uptime</span>
                                        <span className="text-white font-mono">00:04:23</span>
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                        <span className="text-slate-400 text-xs uppercase font-bold block mb-1">Disparos</span>
                                        <span className="text-emerald-400 font-mono">0</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleDisconnect}
                                    className="text-red-500 hover:text-red-400 text-sm font-bold flex items-center gap-2 mx-auto mt-4"
                                >
                                    <Power size={14}/> Desconectar
                                </button>
                            </div>
                        )}

                    </div>

                    {/* Matrix Background Effect */}
                    <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(0deg,transparent_24%,rgba(32,197,94,0.1)_25%,rgba(32,197,94,0.1)_26%,transparent_27%,transparent_74%,rgba(32,197,94,0.1)_75%,rgba(32,197,94,0.1)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(32,197,94,0.1)_25%,rgba(32,197,94,0.1)_26%,transparent_27%,transparent_74%,rgba(32,197,94,0.1)_75%,rgba(32,197,94,0.1)_76%,transparent_77%,transparent)] bg-[length:50px_50px]"></div>
                </div>

                {/* RIGHT: LOGS / CONSOLE */}
                <div className={`col-span-1 rounded-3xl border flex flex-col overflow-hidden ${darkMode ? 'bg-black border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                        <Terminal size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">System Logs</span>
                    </div>
                    <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 custom-scrollbar bg-black/50">
                        {logs.map((log, idx) => (
                            <div key={idx} className="text-emerald-500/80 border-l-2 border-emerald-500/20 pl-2">
                                {log}
                            </div>
                        ))}
                        <div className="w-2 h-4 bg-emerald-500 animate-pulse mt-2"></div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WhatsAppConnection;
