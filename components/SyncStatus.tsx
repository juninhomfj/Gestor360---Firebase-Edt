
import React, { useEffect, useState } from 'react';
import { Cloud, Loader2, Database, WifiOff, Activity } from 'lucide-react';
import { getPendingSyncs } from '../storage/db';
import { auth, db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SessionTraffic } from '../services/logic';
import SyncDetailsModal from './SyncDetailsModal';

const SyncStatus: React.FC = () => {
    const [pendingCount, setPendingCount] = useState(0);
    const [status, setStatus] = useState<'LOCAL_SAVED' | 'SYNCING' | 'OFFLINE' | 'CLOUD_SAVED' | 'QUERYING'>('LOCAL_SAVED');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lastTraffic, setLastTraffic] = useState(0);
    
    useEffect(() => {
        const check = async () => {
            const pending = await getPendingSyncs();
            setPendingCount(pending.length);

            const isOnline = navigator.onLine;
            const isCloudEnabled = !!auth.currentUser;
            
            // Monitora tráfego para piscar "QUERYING"
            const currentTotal = SessionTraffic.reads + SessionTraffic.writes;
            if (currentTotal > lastTraffic) {
                setStatus('QUERYING');
                setLastTraffic(currentTotal);
                setTimeout(() => setStatus(isOnline && isCloudEnabled ? 'CLOUD_SAVED' : 'LOCAL_SAVED'), 800);
            } else if (pending.length > 0 && isOnline && isCloudEnabled) {
                setStatus('SYNCING');
            } else if (isOnline && isCloudEnabled) {
                setStatus('CLOUD_SAVED');
            } else if (!isOnline) {
                setStatus('OFFLINE');
            } else {
                setStatus('LOCAL_SAVED');
            }
        };

        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, [lastTraffic]);

    const renderButton = () => {
        if (status === 'QUERYING') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-black border border-indigo-400 animate-pulse transition-all">
                    <Activity size={14} className="animate-bounce" />
                    <span>CONSULTANDO...</span>
                </button>
            );
        }

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
