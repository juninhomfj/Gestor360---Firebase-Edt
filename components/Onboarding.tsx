
import React, { useState } from 'react';
import { FinanceAccount, CreditCard, TransactionCategory, PersonType, AppTheme } from '../types';
/* Fix: Added missing 'Lock' icon to the imports from lucide-react */
import { Wallet, CreditCard as CardIcon, CheckCircle, ArrowRight, Flag, User, Building2, Layers, Sparkles, AlertTriangle, Clock, Mic, ShoppingBag, PieChart, Info, BookOpen, Palette, Check, SkipForward, Cloud, Lock } from 'lucide-react';
import { auth } from '../services/firebase';

interface OnboardingProps {
  onComplete: (accounts: FinanceAccount[], cards: CreditCard[], categories: TransactionCategory[], theme: AppTheme) => void;
  onSkip?: () => void;
}

type ProfileMode = 'PF' | 'PJ' | 'BOTH';

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0); 
  const [profileMode, setProfileMode] = useState<ProfileMode>('PF');
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('glass');

  const [pfAccName, setPfAccName] = useState('Conta Pessoal Principal');
  const [pfAccBalance, setPfAccBalance] = useState('');
  
  const [pjAccName, setPjAccName] = useState('Conta Jurídica Principal');
  const [pjAccBalance, setPjAccBalance] = useState('');

  const [hasCard, setHasCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardType, setCardType] = useState<PersonType>('PF');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('15');

  const showPfInput = profileMode === 'PF' || profileMode === 'BOTH';
  const showPjInput = profileMode === 'PJ' || profileMode === 'BOTH';

  const handleFinish = () => {
      const newAccounts: FinanceAccount[] = [];
      const uid = auth.currentUser?.uid || '';

      if (showPfInput) {
          newAccounts.push({
              id: crypto.randomUUID(),
              name: pfAccName || 'Conta Pessoal',
              type: 'CHECKING',
              balance: parseFloat(pfAccBalance) || 0,
              color: 'purple',
              isAccounting: true,
              includeInDistribution: true,
              personType: 'PF',
              isActive: true,
              deleted: false,
              createdAt: new Date().toISOString(),
              userId: uid
          });
      }

      if (showPjInput) {
          newAccounts.push({
              id: crypto.randomUUID(),
              name: pjAccName || 'Conta Empresarial',
              type: 'CHECKING',
              balance: parseFloat(pjAccBalance) || 0,
              color: 'blue',
              isAccounting: true,
              includeInDistribution: true,
              personType: 'PJ',
              isActive: true,
              deleted: false,
              createdAt: new Date().toISOString(),
              userId: uid
          });
      }

      const newCards: CreditCard[] = [];
      if (hasCard) {
          newCards.push({
              id: crypto.randomUUID(),
              name: cardName || 'Cartão Principal',
              limit: parseFloat(cardLimit) || 0,
              currentInvoice: 0,
              closingDay: parseInt(closingDay),
              dueDay: parseInt(dueDay),
              color: cardType === 'PF' ? 'purple' : 'blue',
              personType: cardType,
              isActive: true,
              deleted: false,
              userId: uid
          });
      }

      let defaultCategories: TransactionCategory[] = [];

      // Added missing userId to all TransactionCategory objects below
      const pfCategories: TransactionCategory[] = [
          { id: crypto.randomUUID(), name: 'Alimentação', type: 'EXPENSE', personType: 'PF', subcategories: ['Mercado', 'Restaurante', 'Ifood'], monthlyBudget: 800, isActive: true, deleted: false, userId: uid },
          { id: crypto.randomUUID(), name: 'Moradia', type: 'EXPENSE', personType: 'PF', subcategories: ['Aluguel', 'Condomínio', 'Luz', 'Internet'], monthlyBudget: 1500, isActive: true, deleted: false, userId: uid },
          { id: crypto.randomUUID(), name: 'Transporte', type: 'EXPENSE', personType: 'PF', subcategories: ['Combustível', 'Uber', 'Manutenção'], monthlyBudget: 400, isActive: true, deleted: false, userId: uid },
          { id: crypto.randomUUID(), name: 'Saúde', type: 'EXPENSE', personType: 'PF', subcategories: ['Plano de Saúde', 'Farmácia'], monthlyBudget: 300, isActive: true, deleted: false, userId: uid },
          { id: crypto.randomUUID(), name: 'Lazer', type: 'EXPENSE', personType: 'PF', subcategories: ['Cinema', 'Viagem', 'Assinaturas'], monthlyBudget: 200, isActive: true, deleted: false, userId: uid },
          // Fix: Added missing monthlyBudget to satisfy TransactionCategory interface
          { id: crypto.randomUUID(), name: 'Salário/Renda', type: 'INCOME', personType: 'PF', subcategories: ['Salário Mensal', 'Distribuição de Lucros'], monthlyBudget: 0, isActive: true, deleted: false, userId: uid },
      ];

      const pjCategories: TransactionCategory[] = [
          // Fix: Added missing monthlyBudget to satisfy TransactionCategory interface
          { id: crypto.randomUUID(), name: 'Operacional', type: 'EXPENSE', personType: 'PJ', subcategories: ['Sistemas', 'Material de Escritório', 'Internet'], monthlyBudget: 0, isActive: true, deleted: false, userId: uid },
          // Fix: Added missing monthlyBudget to satisfy TransactionCategory interface
          { id: crypto.randomUUID(), name: 'Impostos', type: 'EXPENSE', personType: 'PJ', subcategories: ['DAS', 'ISS', 'Taxas Bancárias'], monthlyBudget: 0, isActive: true, deleted: false, userId: uid },
          // Fix: Added missing monthlyBudget to satisfy TransactionCategory interface
          { id: crypto.randomUUID(), name: 'Pessoal', type: 'EXPENSE', personType: 'PJ', subcategories: ['Folha de Pagamento', 'Prolabore'], monthlyBudget: 0, isActive: true, deleted: false, userId: uid },
          // Fix: Added missing monthlyBudget to satisfy TransactionCategory interface
          { id: crypto.randomUUID(), name: 'Marketing', type: 'EXPENSE', personType: 'PJ', subcategories: ['Ads', 'Redes Sociais'], monthlyBudget: 0, isActive: true, deleted: false, userId: uid },
          // Fix: Added missing monthlyBudget to satisfy TransactionCategory interface
          { id: crypto.randomUUID(), name: 'Vendas', type: 'INCOME', personType: 'PJ', subcategories: ['Serviços', 'Produtos', 'Contratos Recorrentes'], monthlyBudget: 0, isActive: true, deleted: false, userId: uid },
      ];

      if (profileMode === 'PF') defaultCategories = pfCategories;
      else if (profileMode === 'PJ') defaultCategories = pjCategories;
      else defaultCategories = [...pfCategories, ...pjCategories];

      onComplete(newAccounts, newCards, defaultCategories, selectedTheme);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 text-center border-b border-slate-700 bg-slate-900/50">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-900/50 mb-3">
                    <Flag size={24} className="text-white" />
                </div>
                <h1 className="text-xl font-bold mb-1">Bem-vindo ao Gestor360 v2.5</h1>
                <p className="text-slate-400 text-sm">Infraestrutura Nativa Firebase Ativa</p>
                <div className="flex justify-center gap-2 mt-4">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 w-8 rounded-full ${step >= i ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                    ))}
                </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                {step === 0 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold flex items-center justify-center gap-2">
                                <Palette size={20} className="text-emerald-400"/> Escolha seu Estilo
                            </h3>
                            <p className="text-sm text-slate-400">Como você prefere visualizar o sistema?</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {['glass', 'neutral', 'dark', 'rose', 'cyberpunk'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setSelectedTheme(t as AppTheme)}
                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${selectedTheme === t ? 'border-emerald-500 bg-emerald-500/10 shadow-lg' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}`}
                                >
                                    <span className="font-bold text-sm capitalize">{t}</span>
                                    {selectedTheme === t && <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5"><Check size={12}/></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold">O que há de novo na v2.5?</h3>
                            <p className="text-sm text-slate-400">Arquitetura síncrona de alta performance.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-3 mb-3 text-emerald-400">
                                    <Cloud size={24}/>
                                    <h4 className="font-bold">Cloud Firestore</h4>
                                </div>
                                <p className="text-sm text-slate-400">Seus dados agora são salvos instantaneamente na nuvem do Google.</p>
                            </div>
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-3 mb-3 text-blue-400">
                                    <Lock size={24}/>
                                    <h4 className="font-bold">Segurança Root</h4>
                                </div>
                                <p className="text-sm text-slate-400">Novo controle de permissões e hierarquia de acesso empresarial.</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold">Configuração de Perfil</h3>
                            <p className="text-sm text-slate-400">Finanças pessoais, empresariais ou ambas?</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button onClick={() => setProfileMode('PF')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${profileMode === 'PF' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800'}`}>
                                <User size={24} className="text-purple-400"/>
                                <span className="font-bold">Pessoal</span>
                            </button>
                            <button onClick={() => setProfileMode('PJ')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${profileMode === 'PJ' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800'}`}>
                                <Building2 size={24} className="text-blue-400"/>
                                <span className="font-bold">Empresa</span>
                            </button>
                            <button onClick={() => setProfileMode('BOTH')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${profileMode === 'BOTH' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'}`}>
                                <Layers size={24} className="text-emerald-400"/>
                                <span className="font-bold">Misto</span>
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                        <h3 className="text-lg font-bold text-center">Contas Bancárias</h3>
                        {showPfInput && (
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Conta Pessoal</label>
                                <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg" value={pfAccName} onChange={e => setPfAccName(e.target.value)} />
                            </div>
                        )}
                        {showPjInput && (
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Conta Empresarial</label>
                                <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg" value={pjAccName} onChange={e => setPjAccName(e.target.value)} />
                            </div>
                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                        <h3 className="text-lg font-bold text-center">Cartão de Crédito</h3>
                        <label className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer">
                            <input type="checkbox" checked={hasCard} onChange={e => setHasCard(e.target.checked)} className="w-5 h-5 text-emerald-500"/>
                            <span className="font-bold">Cadastrar um cartão agora</span>
                        </label>
                        {hasCard && (
                            <div className="space-y-3">
                                <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg" placeholder="Nome do Cartão" value={cardName} onChange={e => setCardName(e.target.value)} />
                                <input type="number" className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg" placeholder="Limite Total" value={cardLimit} onChange={e => setCardLimit(e.target.value)} />
                            </div>
                        )}
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-6 text-center animate-in fade-in slide-in-from-right duration-300">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full mx-auto flex items-center justify-center text-emerald-400">
                            <Sparkles size={32} />
                        </div>
                        <h3 className="text-xl font-bold">Tudo Pronto!</h3>
                        <p className="text-slate-400">Suas vendas e finanças estão agora sob o controle da tecnologia v2.5 Firebase Native.</p>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <div className="flex gap-2">
                    {step > 0 && (
                        <button onClick={() => setStep(step - 1)} className="px-6 py-2 text-slate-400 hover:text-white font-bold transition-colors">Voltar</button>
                    )}
                </div>
                
                {step < 5 ? (
                    <button onClick={() => setStep(step + 1)} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all">
                        Próximo <ArrowRight size={18}/>
                    </button>
                ) : (
                    <button onClick={handleFinish} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20">
                        Acessar Sistema <CheckCircle size={18}/>
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default Onboarding;