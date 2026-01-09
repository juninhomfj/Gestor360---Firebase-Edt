
import React, { useState, useEffect } from 'react';
import { User, Company } from '../types';
import { getCompany } from '../services/fiscalService';
import FiscalCompanyForm from './FiscalCompanyForm';
import FiscalDashboard from './FiscalDashboard';
import { Loader2, ShieldCheck } from 'lucide-react';

interface Props {
    currentUser: User;
    darkMode: boolean;
}

const FiscalModule: React.FC<Props> = ({ currentUser, darkMode }) => {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCompany();
    }, [currentUser.id]);

    const loadCompany = async () => {
        setLoading(true);
        const data = await getCompany(currentUser.id);
        setCompany(data);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in">
                <Loader2 className="animate-spin text-indigo-500 mb-4" size={40}/>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Iniciando Motor Fiscal...</p>
            </div>
        );
    }

    if (!company) {
        return <FiscalCompanyForm currentUser={currentUser} onSaved={setCompany} darkMode={darkMode} />;
    }

    return <FiscalDashboard company={company} currentUser={currentUser} darkMode={darkMode} />;
};

export default FiscalModule;
