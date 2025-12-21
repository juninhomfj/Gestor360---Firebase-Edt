
import React, { useEffect, useState } from 'react';
import { Cloud, Loader2, Database, WifiOff } from 'lucide-react';
import { getPendingSyncs } from '../storage/db';
import { auth, db } from '../services/firebase';
import SyncDetailsModal from './SyncDetailsModal';

const SyncStatus: React.FC = () => {
    const [pendingCount, setPendingCount] = useState(0);
    const [status, setStatus] = useState<'LOCAL_SAVED' | 'SYNCING' | 'OFFLINE' | 'CLOUD_SAVED'>('LOCAL_SAVED');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    useEffect(() => {
        const check = async () => {
            // Check IndexedDB queue
            const pending = await getPendingSyncs();
            setPendingCount(pending.length);

            // Check Firebase / Network
            const isOnline = navigator.onLine;
            // @ts-ignore
            const isCloudEnabled = db && db.type !== 'mock' && !!auth.currentUser;

            if (pending.length > 0 && isOnline && isCloudEnabled) {
                setStatus('SYNCING');
            } else if (isOnline && isCloudEnabled) {
                setStatus('CLOUD_SAVED');
            } else if (!isOnline) {
                setStatus('OFFLINE');
            } else {
                setStatus('LOCAL_SAVED');
            }
        };

        check();
        const interval = setInterval(check, 3000);
        return () => clearInterval(interval);
    }, []);

    const renderButton = () => {
        if (status === 'SYNCING') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-xs font-bold border border-blue-200 animate-pulse transition-all hover:bg-blue-200">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Sync Cloud...</span>
                </button>
            );
        }

        if (status === 'OFFLINE') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold border border-red-200 transition-all hover:bg-red-200">
                    <WifiOff size={14} />
                    <span>Modo Offline</span>
                </button>
            );
        }

        if (status === 'CLOUD_SAVED') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-200 transition-all hover:bg-emerald-200">
                    <Cloud size={14} className="fill-emerald-500 text-emerald-600" />
                    <span>Cloud Ativa</span>
                </button>
            );
        }

        return (
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 transition-all hover:bg-slate-200">
                <Database size={14} />
                <span>Local Only</span>
            </button>
        );
    };

    return (
        <>
            {renderButton()}
            <SyncDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};

export default SyncStatus;
