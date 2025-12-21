import React, { useState } from 'react';
import { FinanceAccount, CreditCard, TransactionCategory, PersonType, AppTheme } from '../types';
import { Wallet, CreditCard as CardIcon, CheckCircle, ArrowRight, Flag, User, Building2, Layers, Sparkles, AlertTriangle, Clock, Mic, ShoppingBag, PieChart, Info, BookOpen, Palette, Check, SkipForward } from 'lucide-react';

interface OnboardingProps {
  onComplete: (accounts: FinanceAccount[], cards: CreditCard[], categories: TransactionCategory[], theme: AppTheme) => void;
  onSkip?: () => void;
}

type ProfileMode = 'PF' | 'PJ' | 'BOTH';

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0); // Começa no 0 para o tema
  const [profileMode, setProfileMode] = useState<ProfileMode>('PF');
  
  // Step 0: Theme
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('glass');

  // Step 3: Accounts
  const [pfAccName, setPfAccName] = useState('Conta Pessoal Principal');
  const [pfAccBalance, setPfAccBalance] = useState('');
  
  const [pjAccName, setPjAccName] = useState('Conta Jurídica Principal');
  const [pjAccBalance, setPjAccBalance] = useState('');

  // Step 4: Card
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

      // Create PF Account
      if (showPfInput) {
          newAccounts.push({
              id: crypto.randomUUID(),
              name: pfAccName || 'Conta Pessoal',
              type: 'CHECKING',
              balance: parseFloat(pfAccBalance) || 0,
              color: 'purple',
              isAccounting: true,
              includeInDistribution: true,
              personType: 'PF'
          });
      }

      // Create PJ Account
      if (showPjInput) {
          newAccounts.push({
              id: crypto.randomUUID(),
              name: pjAccName || 'Conta Empresarial',
              type: 'CHECKING',
              balance: parseFloat(pjAccBalance) || 0,
              color: 'blue',
              isAccounting: true,
              includeInDistribution: true,
              personType: 'PJ'
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
              personType: cardType
          });
      }

      // Generate Categories based on Profile Mode
      let defaultCategories: TransactionCategory[] = [];

      const pfCategories: TransactionCategory[] = [
          { id: crypto.randomUUID(), name: 'Alimentação', type: 'EXPENSE', personType: 'PF', subcategories: ['Mercado', 'Restaurante', 'Ifood'], monthlyBudget: 800 },
          { id: crypto.randomUUID(), name: 'Moradia', type: 'EXPENSE', personType: 'PF', subcategories: ['Aluguel', 'Condomínio', 'Luz', 'Internet'], monthlyBudget: 1500 },
          { id: crypto.randomUUID(), name: 'Transporte', type: 'EXPENSE', personType: 'PF', subcategories: ['Combustível', 'Uber', 'Manutenção'], monthlyBudget: 400 },
          { id: crypto.randomUUID(), name: 'Saúde', type: 'EXPENSE', personType: 'PF', subcategories: ['Plano de Saúde', 'Farmácia'], monthlyBudget: 300 },
          { id: crypto.randomUUID(), name: 'Lazer', type: 'EXPENSE', personType: 'PF', subcategories: ['Cinema', 'Viagem', 'Assinaturas'], monthlyBudget: 200 },
          { id: crypto.randomUUID(), name: 'Salário/Renda', type: 'INCOME', personType: 'PF', subcategories: ['Salário Mensal', 'Distribuição de Lucros'] },
      ];

      const pjCategories: TransactionCategory[] = [
          { id: crypto.randomUUID(), name: 'Operacional', type: 'EXPENSE', personType: 'PJ', subcategories: ['Sistemas', 'Material de Escritório', 'Internet'] },
          { id: crypto.randomUUID(), name: 'Impostos', type: 'EXPENSE', personType: 'PJ', subcategories: ['DAS', 'ISS', 'Taxas Bancárias'] },
          { id: crypto.randomUUID(), name: 'Pessoal', type: 'EXPENSE', personType: 'PJ', subcategories: ['Folha de Pagamento', 'Prolabore'] },
          { id: crypto.randomUUID(), name: 'Marketing', type: 'EXPENSE', personType: 'PJ', subcategories: ['Ads', 'Redes Sociais'] },
          { id: crypto.randomUUID(), name: 'Vendas', type: 'INCOME', personType: 'PJ', subcategories: ['Serviços', 'Produtos', 'Contratos Recorrentes'] },
      ];

      if (profileMode === 'PF') {
          defaultCategories = pfCategories;
      } else if (profileMode === 'PJ') {
          defaultCategories = pjCategories;
      } else {
          // BOTH
          defaultCategories = [...pfCategories, ...pjCategories];
      }

      onComplete(newAccounts, newCards, defaultCategories, selectedTheme);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 text-center border-b border-slate-700 bg-slate-900/50">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-900/50 mb-3">
                    <Flag size={24} className="text-white" />
                </div>
                <h1 className="text-xl font-bold mb-1">Bem-vindo ao Gestor360</h1>
                <p className="text-slate-400 text-sm">Configuração guiada para seu sucesso</p>
                <div className="flex justify-center gap-2 mt-4">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 w-8 rounded-full ${step >= i ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
                
                {/* STEP 0: THEME SELECTION */}
                {step === 0 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold flex items-center justify-center gap-2">
                                <Palette size={20} className="text-emerald-400"/> Escolha seu Estilo
                            </h3>
                            <p className="text-sm text-slate-400">Como você prefere visualizar o sistema? (Você pode mudar depois)</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { id: 'glass', label: 'Glass (Padrão)', colors: ['#0f172a', '#1e293b'] },
                                { id: 'neutral', label: 'Clean / Claro', colors: ['#f8fafc', '#e2e8f0'] },
                                { id: 'dark', label: 'Modo Escuro', colors: ['#020617', '#1e293b'] },
                                { id: 'rose', label: 'Rose Gold', colors: ['#fff1f2', '#fda4af'] },
                                { id: 'cyberpunk', label: 'Cyberpunk', colors: ['#050505', '#06b6d4'] }
                            ].map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => setSelectedTheme(theme.id as AppTheme)}
                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                                        selectedTheme === theme.id 
                                        ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-900/20' 
                                        : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                                    }`}
                                >
                                    <div className="flex gap-1 w-full h-8 rounded-md overflow-hidden">
                                        {theme.colors.map(c => <div key={c} className="flex-1 h-full" style={{background: c}}></div>)}
                                    </div>
                                    <span className="font-bold text-sm">{theme.label}</span>
                                    {selectedTheme === theme.id && <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5"><Check size={12}/></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 1: INTRODUÇÃO */}
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold">O que você pode fazer aqui?</h3>
                            <p className="text-sm text-slate-400">O sistema é dividido em dois grandes módulos.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
                                <div className="flex items-center gap-3 mb-3 text-emerald-400">
                                    <ShoppingBag size={24}/>
                                    <h4 className="font-bold">Módulo de Vendas</h4>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Controle suas vendas, clientes e comissões. 
                                    Defina regras complexas de comissionamento e gere relatórios de performance.
                                </p>
                            </div>

                            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                                <div className="flex items-center gap-3 mb-3 text-blue-400">
                                    <PieChart size={24}/>
                                    <h4 className="font-bold">Módulo Financeiro</h4>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Gerencie contas PF e PJ, cartões de crédito, metas e fluxo de caixa.
                                    Tenha um DRE gerencial completo na palma da mão.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: PROFILE TYPE */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold">Como você gerencia suas finanças?</h3>
                            <p className="text-sm text-slate-400">Isso ajustará as categorias e contas para sua realidade.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button 
                                onClick={() => setProfileMode('PF')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${profileMode === 'PF' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`}
                            >
                                <div className="bg-purple-500/20 p-3 rounded-full text-purple-400"><User size={24}/></div>
                                <div className="text-center">
                                    <span className="block font-bold">Apenas Pessoal</span>
                                    <span className="text-xs text-slate-400">Contas PF, gastos de casa e pessoais.</span>
                                </div>
                            </button>

                            <button 
                                onClick={() => setProfileMode('PJ')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${profileMode === 'PJ' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`}
                            >
                                <div className="bg-blue-500/20 p-3 rounded-full text-blue-400"><Building2 size={24}/></div>
                                <div className="text-center">
                                    <span className="block font-bold">Apenas Empresa</span>
                                    <span className="text-xs text-slate-400">Contas PJ, operacional e impostos.</span>
                                </div>
                            </button>

                            <button 
                                onClick={() => setProfileMode('BOTH')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${profileMode === 'BOTH' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`}
                            >
                                <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400"><Layers size={24}/></div>
                                <div className="text-center">
                                    <span className="block font-bold">Misto (PF + PJ)</span>
                                    <span className="text-xs text-slate-400">Gerencio ambas e faço distribuição de lucros.</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: ACCOUNTS SETUP */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-4">
                            <h3 className="text-lg font-bold">Cadastre suas Contas Principais</h3>
                            <p className="text-sm text-slate-400">Onde o dinheiro entra e sai?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* PF Form */}
                            {showPfInput && (
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-2 mb-4 text-purple-400 font-bold border-b border-slate-700 pb-2">
                                        <User size={18} /> Pessoa Física
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Nome da Conta (Ex: Nubank PF)</label>
                                            <input 
                                                className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:border-purple-500 outline-none"
                                                value={pfAccName} onChange={e => setPfAccName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Saldo Atual (R$)</label>
                                            <input 
                                                type="number"
                                                className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:border-purple-500 outline-none"
                                                value={pfAccBalance} onChange={e => setPfAccBalance(e.target.value)}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PJ Form */}
                            {showPjInput && (
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold border-b border-slate-700 pb-2">
                                        <Building2 size={18} /> Pessoa Jurídica
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Nome da Conta (Ex: Inter PJ)</label>
                                            <input 
                                                className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:border-blue-500 outline-none"
                                                value={pjAccName} onChange={e => setPjAccName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Saldo Atual (R$)</label>
                                            <input 
                                                type="number"
                                                className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:border-blue-500 outline-none"
                                                value={pjAccBalance} onChange={e => setPjAccBalance(e.target.value)}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 4: CARDS */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400"><CardIcon size={24}/></div>
                            <div>
                                <h3 className="text-lg font-bold">Cartão de Crédito</h3>
                                <p className="text-xs text-slate-400">Você utiliza cartão para despesas recorrentes?</p>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 p-4 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800">
                            <input 
                                type="checkbox" 
                                checked={hasCard} 
                                onChange={e => setHasCard(e.target.checked)}
                                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-medium">Sim, quero cadastrar um cartão principal</span>
                        </label>

                        {hasCard && (
                            <div className="space-y-4 pl-4 border-l-2 border-slate-700 ml-2">
                                {profileMode === 'BOTH' && (
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">Este cartão é:</label>
                                        <div className="flex bg-slate-900 rounded-lg p-1">
                                            <button 
                                                onClick={() => setCardType('PF')}
                                                className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors ${cardType === 'PF' ? 'bg-slate-700 text-purple-400 shadow' : 'text-slate-500'}`}
                                            >
                                                <User size={16}/> Pessoal
                                            </button>
                                            <button 
                                                onClick={() => setCardType('PJ')}
                                                className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors ${cardType === 'PJ' ? 'bg-slate-700 text-blue-400 shadow' : 'text-slate-500'}`}
                                            >
                                                <Building2 size={16}/> Empresarial
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Apelido do Cartão</label>
                                    <input 
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:border-emerald-500 outline-none"
                                        placeholder="Ex: Visa Infinite Black"
                                        value={cardName} onChange={e => setCardName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Limite Total (R$)</label>
                                    <input 
                                        type="number"
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:border-emerald-500 outline-none"
                                        placeholder="Ex: 5000,00"
                                        value={cardLimit} onChange={e => setCardLimit(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">Dia Fechamento</label>
                                        <input type="number" max="31" className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-center" value={closingDay} onChange={e => setClosingDay(e.target.value)}/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">Dia Vencimento</label>
                                        <input type="number" max="31" className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-center" value={dueDay} onChange={e => setDueDay(e.target.value)}/>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 5: TUTORIAL / FEATURES */}
                {step === 5 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-purple-900/50 mb-4 animate-pulse-slow">
                                <Sparkles size={32} className="text-white" />
                            </div>
                            <h3 className="text-xl font-bold">Dicas Rápidas</h3>
                            <p className="text-sm text-slate-400 mt-2">
                                Recursos para aumentar sua produtividade.
                            </p>
                        </div>

                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 space-y-6">
                            <div className="flex items-start gap-3">
                                <div className="bg-slate-800 p-2 rounded text-indigo-400"><Clock size={18}/></div>
                                <div>
                                    <h4 className="font-bold text-sm text-indigo-300">Automação de Parcelas</h4>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Ao lançar uma despesa ou venda, use a opção "Repetir" para criar parcelas ou recorrências mensais automaticamente.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="bg-slate-800 p-2 rounded text-emerald-400"><Mic size={18}/></div>
                                <div>
                                    <h4 className="font-bold text-sm text-emerald-300">Consultor IA</h4>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Ative nas configurações para lançar despesas falando: <i>"Gastei 50 reais no Uber"</i> (Requer chave Gemini).
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="bg-slate-800 p-2 rounded text-blue-400"><BookOpen size={18}/></div>
                                <div>
                                    <h4 className="font-bold text-sm text-blue-300">Backup & Segurança</h4>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Seus dados são salvos localmente. Use o ícone de Nuvem no menu lateral para sincronizar com seu Google Drive.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Navigation */}
            <div className="p-6 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <div className="flex gap-2">
                    {onSkip && (
                        <button onClick={onSkip} className="px-4 py-2 text-slate-500 hover:text-white font-medium text-xs flex items-center gap-1 transition-colors">
                            <SkipForward size={14}/> Pular Configuração
                        </button>
                    )}
                    {step > 0 && (
                        <button onClick={() => setStep(step - 1)} className="px-6 py-2 text-slate-400 hover:text-white font-medium transition-colors">Voltar</button>
                    )}
                </div>
                
                {step < 5 ? (
                    <button 
                        onClick={() => setStep(step + 1)}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                    >
                        Próximo <ArrowRight size={18}/>
                    </button>
                ) : (
                    <button 
                        onClick={handleFinish}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all animate-pulse"
                    >
                        Acessar Sistema <CheckCircle size={18}/>
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default Onboarding;