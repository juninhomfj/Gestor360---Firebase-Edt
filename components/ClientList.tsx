
import React, { useEffect, useState } from 'react';
import { Client } from '../types';
import { getMyClients } from '../services/clientSelectors';
import { User, ShieldCheck, Clock } from 'lucide-react';

interface ClientListProps {
    currentUser: { id: string };
    darkMode: boolean;
}

const ClientList: React.FC<ClientListProps> = ({ currentUser, darkMode }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadClients();
    }, [currentUser.id]);

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await getMyClients(currentUser.id);
            setClients(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Erro ao carregar clientes", error);
        } finally {
            setLoading(false);
        }
    };

    const cardClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
    const textClass = darkMode ? 'text-white' : 'text-gray-900';

    if (loading) {
        return <div className="p-4 text-center opacity-50">Carregando carteira...</div>;
    }

    return (
        <div className="space-y-4">
            <h3 className={`text-lg font-bold flex items-center gap-2 ${textClass}`}>
                <ShieldCheck className="text-emerald-500" size={20}/> 
                Minha Carteira ({clients.length})
            </h3>
            
            {clients.length === 0 ? (
                <div className={`p-8 text-center rounded-xl border border-dashed ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                    <User size={32} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm opacity-50">Você ainda não possui clientes vinculados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {clients.map(client => (
                        <div key={client.id} className={`p-4 rounded-xl border flex items-center justify-between ${cardClass}`}>
                            <div>
                                <p className={`font-bold ${textClass}`}>{client.name}</p>
                                <p className="text-xs opacity-50 flex items-center gap-1">
                                    <Clock size={10}/> Cadastrado em {new Date(client.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded">
                                MEU
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientList;
