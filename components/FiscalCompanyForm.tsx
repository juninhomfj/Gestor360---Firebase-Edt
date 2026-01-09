
import React, { useState } from 'react';
import { Company, TaxRegime, User } from '../types';
import { saveCompany, fetchCnpjData } from '../services/fiscalService';
import { Building2, Search, Save, ShieldAlert, Loader2, Info } from 'lucide-react';

interface Props {
    currentUser: User;
    onSaved: (company: Company) => void;
    darkMode: boolean;
}

const FiscalCompanyForm: React.FC<Props> = ({ currentUser, onSaved, darkMode }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Company>>({
        cnpj: '',
        razaoSocial: '',
        nomeFantasia: '',
        uf: 'SP',
        municipio: '',
        regimeTributario: 'SIMPLES_NACIONAL',
    });

    const handleLookup = async () => {
        if (!formData.cnpj || formData.cnpj.length < 14) return;
        setLoading(true);
        try {
            const data: any = await fetchCnpjData(formData.cnpj);
            setFormData(prev => ({
                ...prev,
                razaoSocial: data.razao_social || '',
                nomeFantasia: data.nome_fantasia || '',
                uf: data.uf || 'SP',
                municipio: data.municipio || '',
                cnaePrincipal: data.cnae_principal
            }));
        } catch (e) {
            alert("CNPJ não encontrado ou erro no servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.cnpj || !formData.razaoSocial) return alert("Preencha os dados obrigatórios.");
        
        const company: Company = {
            id: crypto.randomUUID(),
            userId: currentUser.id,
            cnpj: formData.cnpj!,
            razaoSocial: formData.razaoSocial!,
            nomeFantasia: formData.nomeFantasia || formData.razaoSocial!,
            uf: formData.uf!,
            municipio: formData.municipio!,
            enderecoFiscal: formData.enderecoFiscal || '',
            regimeTributario: formData.regimeTributario as TaxRegime,
            cnaePrincipal: formData.cnaePrincipal || { codigo: '', descricao: '' },
            cnaesSecundarios: [],
            taxProfileVersion: 'v1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setLoading(true);
        try {
            await saveCompany(company);
            onSaved(company);
        } catch (e) {
            alert("Erro ao salvar empresa.");
        } finally {
            setLoading(false);
        }
    };

    const inputClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900';

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
            <div className="text-center">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl mb-6">
                    <Building2 size={40} />
                </div>
                <h2 className="text-3xl font-black tracking-tight">Configure sua Empresa</h2>
                <p className="text-gray-500 mt-2">O Fiscal 360 precisa dos dados básicos da sua PJ para iniciar os cálculos.</p>
            </div>

            <div className={`p-8 rounded-[2.5rem] border shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">CNPJ da Empresa</label>
                        <div className="flex gap-2">
                            <input 
                                className={`flex-1 p-4 rounded-2xl border outline-none focus:ring-2 ring-indigo-500 font-mono ${inputClass}`}
                                placeholder="00.000.000/0000-00"
                                value={formData.cnpj}
                                onChange={e => setFormData({...formData, cnpj: e.target.value})}
                            />
                            <button 
                                onClick={handleLookup}
                                disabled={loading}
                                className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                                <span className="hidden sm:inline font-bold">Consultar</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Razão Social</label>
                            <input className={`w-full p-4 rounded-2xl border outline-none ${inputClass}`} value={formData.razaoSocial} onChange={e => setFormData({...formData, razaoSocial: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Regime Tributário</label>
                            <select 
                                className={`w-full p-4 rounded-2xl border outline-none ${inputClass}`}
                                value={formData.regimeTributario}
                                onChange={e => setFormData({...formData, regimeTributario: e.target.value as any})}
                            >
                                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">UF</label>
                            <input className={`w-full p-4 rounded-2xl border outline-none ${inputClass}`} value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value})} />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 flex gap-3 text-xs text-amber-700 dark:text-amber-400">
                        <ShieldAlert size={18} className="shrink-0"/>
                        <p><b>Atenção:</b> O regime tributário define como os impostos serão estimados. Confirme com seu contador antes de prosseguir.</p>
                    </div>

                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        Salvar e Acessar Módulo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FiscalCompanyForm;
