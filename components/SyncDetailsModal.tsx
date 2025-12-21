
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Server, ArrowUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { getPendingSyncs } from '../storage/db';
import { SyncEntry } from '../types';

interface SyncDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SyncDetailsModal: React.FC<SyncDetailsModalProps> = ({ isOpen, onClose }) => {
    const [queue, setQueue] = useState<SyncEntry[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

    const loadQueue = async () => {
        const pending = await getPendingSyncs();
        setQueue(pending);
    };

    useEffect(() => {
        if (isOpen) {
            loadQueue();
            const interval = setInterval(loadQueue, 2000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const handleForceSync = async () => {
        setIsSyncing(true);
        // Firebase handles sync automatically via real-time writes. 
        // This button acts as a re-verification trigger.
        await loadQueue();
        setTimeout(() => {
            setIsSyncing(false);
            setLastSyncTime(new Date().toLocaleTimeString());
        }, 1500);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]">
                
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400`}>
                            <Server size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white">Firestore Sync</h3>
                            <p className="text-xs text-gray-500">Persistência Direta</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {queue.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                                <CheckCircle size={32} />
                            </div>
                            <h4 className="font-bold text-lg text-gray-800 dark:text-white">Nuvem Atualizada</h4>
                            <p className="text-sm text-gray-500 mt-2">
                                Seus dados locais estão em harmonia com o Google Cloud Firestore.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <span>Itens Pendentes ({queue.length})</span>
                                <span>Status</span>
                            </div>
                            <div className="space-y-2">
                                {queue.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                                        <span className="text-sm font-bold opacity-70">{item.table}</span>
                                        <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded">Aguardando...</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-slate-800">
                    <button 
                        onClick={handleForceSync}
                        disabled={isSyncing}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                    >
                        <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                        Verificar Sincronia
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default SyncDetailsModal;
