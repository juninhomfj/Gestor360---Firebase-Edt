
import React, { useEffect, useState, useRef } from 'react';
import { ProductType, Sale, SaleFormData, CommissionRule, WACampaign, Client } from '../types';
import { getStoredSales, getSystemConfig, DEFAULT_PRODUCT_LABELS, calculateMargin, computeCommissionValues, searchClients, ensureClient } from '../services/logic';
import { getWACampaigns } from '../services/whatsappService';
import { Save, X, Calculator, CalendarCheck, Calendar, Clock, AlertTriangle, HelpCircle, MessageCircle, RefreshCw, User, CheckCircle2, FileText, Truck } from 'lucide-react';
import confetti from 'canvas-confetti'; 

interface SalesFormProps {
  initialData?: Sale;
  onSubmit: (data: SaleFormData) => void;
  onCancel: () => void;
  rulesBasic: CommissionRule[];
  rulesNatal: CommissionRule[];
  rulesCustom: CommissionRule[]; 
}

const SalesForm: React.FC<SalesFormProps> = ({ initialData, onSubmit, onCancel, rulesBasic, rulesNatal, rulesCustom }) => {
  const [client, setClient] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined); 
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<ProductType>(ProductType.BASICA);
  const [valueProposed, setValueProposed] = useState('0');
  const [valueSold, setValueSold] = useState('0');
  
  // New/Restored Fields
  const [quoteNumber, setQuoteNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  // Datas
  const [date, setDate] = useState(''); 
  const [isPendingDate, setIsPendingDate] = useState(false); 
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]); 

  const [observations, setObservations] = useState('');
  const [marginPercent, setMarginPercent] = useState('0');
  const [isMarginManual, setIsMarginManual] = useState(false); 
  
  // New ROI
  const [campaignId, setCampaignId] = useState('');
  const [availableCampaigns, setAvailableCampaigns] = useState<WACampaign[]>([]);

  // Preview State
  const [preview, setPreview] = useState({ commission: 0, commissionRate: 0, base: 0 });
  
  // Client Autocomplete State
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Custom Labels
  const [labels, setLabels] = useState(DEFAULT_PRODUCT_LABELS);
  
  // Draft restore flag
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  useEffect(() => {
      getSystemConfig().then(cfg => {
          if (cfg.productLabels) setLabels(cfg.productLabels);
      });
      
      getWACampaigns().then(camps => {
          const recent = camps.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
          setAvailableCampaigns(recent);
      });

    if (initialData) {
      setClient(initialData.client);
      setClientId(initialData.clientId); 
      setQuantity(initialData.quantity.toString());
      setType(initialData.type);
      setValueProposed(initialData.valueProposed.toString());
      setValueSold(initialData.valueSold.toString());
      setQuoteNumber(initialData.quoteNumber || '');
      setTrackingCode(initialData.trackingCode || '');
      setCampaignId(initialData.marketingCampaignId || '');
      
      let dateStr = '';
      try {
          if (initialData.date) {
            const d = new Date(initialData.date);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
          }
      } catch (e) {}
      
      setDate(dateStr);
      setIsPendingDate(!dateStr);

      let compDateStr = new Date().toISOString().split('T')[0];
      try {
          if (initialData.completionDate) {
            const d = new Date(initialData.completionDate);
            if (!isNaN(d.getTime())) compDateStr = d.toISOString().split('T')[0];
          }
      } catch (e) {}
      setCompletionDate(compDateStr);
      
      setObservations(initialData.observations || '');
      
      const sold = initialData.valueSold || 0;
      const proposed = initialData.valueProposed || 0;
      const storedMargin = initialData.marginPercent || 0;
      
      if (storedMargin === 0 && proposed > 0 && sold > 0) {
          const calculatedMargin = calculateMargin(sold, proposed);
          setMarginPercent(calculatedMargin.toFixed(2));
      } else {
          setMarginPercent(storedMargin.toString());
      }
      
      setIsMarginManual(true);

    } else {
        // DRAFT RESTORE LOGIC
        const draft = localStorage.getItem('sys_sales_draft');
        if (draft) {
            try {
                const d = JSON.parse(draft);
                setClient(d.client || '');
                setClientId(d.clientId); 
                setQuantity(d.quantity || '1');
                setType(d.type || ProductType.BASICA);
                setValueProposed(d.valueProposed || '0');
                setValueSold(d.valueSold || '0');
                setMarginPercent(d.marginPercent || '0');
                setQuoteNumber(d.quoteNumber || '');
                setTrackingCode(d.trackingCode || '');
                setObservations(d.observations || '');
                setCampaignId(d.campaignId || '');
                
                if (d.date) setDate(d.date);
                if (d.completionDate) setCompletionDate(d.completionDate);
                setIsPendingDate(d.isPendingDate || false);
                setRestoredFromDraft(true);
                
                if (d.marginPercent && d.marginPercent !== '0') {
                    setIsMarginManual(true);
                }
            } catch (e) {
                console.error("Erro ao restaurar rascunho de venda", e);
            }
        } else {
            setIsPendingDate(true);
            setDate('');
        }
    }
    
    // Outside click handler for suggestions
    const handleClickOutside = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);

  }, [initialData]);

  // AUTO-SAVE DRAFT
  useEffect(() => {
      if (!initialData) {
          const draftData = {
              client, clientId, quantity, type, valueProposed, valueSold, marginPercent, 
              observations, campaignId, date, completionDate, isPendingDate, quoteNumber, trackingCode
          };
          localStorage.setItem('sys_sales_draft', JSON.stringify(draftData));
      }
  }, [client, clientId, quantity, type, valueProposed, valueSold, marginPercent, observations, campaignId, date, completionDate, isPendingDate, quoteNumber, trackingCode, initialData]);

  // AUTOCOMPLETE LOGIC
  useEffect(() => {
      const loadSuggestions = async () => {
          if (client.length > 1) {
              const matches = await searchClients(client);
              setSuggestions(matches);
              if (!clientId) setShowSuggestions(matches.length > 0);
          } else {
              setSuggestions([]);
              setShowSuggestions(false);
          }
      };
      const timeoutId = setTimeout(loadSuggestions, 300);
      return () => clearTimeout(timeoutId);
  }, [client, clientId]);

  const handleClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setClient(e.target.value);
      setClientId(undefined); 
      if (e.target.value.length > 1) setShowSuggestions(true);
  };

  const selectSuggestion = (selectedClient: Client) => {
      setClient(selectedClient.name);
      setClientId(selectedClient.id);
      setShowSuggestions(false);
  };

  // Recalcular preview sempre que qualquer valor mudar
  useEffect(() => {
    let activeRules = rulesBasic;
    if (type === ProductType.NATAL) activeRules = rulesNatal;
    if (type === ProductType.CUSTOM) activeRules = rulesCustom;

    const margin = parseFloat(marginPercent) || 0;
    const qty = parseFloat(quantity) || 0;
    const vlrProp = parseFloat(valueProposed) || 0;

    const { commissionValue, rateUsed, commissionBase } = computeCommissionValues(qty, vlrProp, margin, activeRules);

    setPreview({
      commissionRate: rateUsed,
      commission: commissionValue,
      base: commissionBase
    });
  }, [type, marginPercent, quantity, valueProposed, rulesBasic, rulesNatal, rulesCustom]);

  const handlePendingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setIsPendingDate(checked);
      if (checked) {
          setDate(''); 
      } else {
          setDate(new Date().toISOString().split('T')[0]); 
      }
  };

  const fireConfetti = () => {
      confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 9999
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const margin = parseFloat(marginPercent) || 0;
    
    if (!clientId) {
        await ensureClient(client);
    }

    const formData: SaleFormData = {
        client,
        clientId, 
        quantity: parseFloat(quantity) || 0,
        type,
        valueProposed: parseFloat(valueProposed) || 0,
        valueSold: parseFloat(valueSold) || 0,
        date: isPendingDate ? '' : date,
        completionDate, 
        observations,
        marginPercent: margin,
        marketingCampaignId: campaignId || undefined,
        quoteNumber,
        trackingCode
    };
    
    if (margin >= 40) {
        fireConfetti();
    }

    localStorage.removeItem('sys_sales_draft'); // Clear draft on success
    onSubmit(formData);
  };

  const handleProposedChange = (val: string) => {
      const cleanVal = val.replace(',', '.');
      setValueProposed(cleanVal);
  };

  const handleSoldChange = (val: string) => {
      const cleanVal = val.replace(',', '.');
      setValueSold(cleanVal);
  };

  const handleMarginChange = (val: string) => {
      const cleanVal = val.replace(',', '.');
      setMarginPercent(cleanVal);
      setIsMarginManual(true);
  };

  const handleQuantityChange = (val: string) => {
      setQuantity(val.replace(',', '.'));
  };

  const hasCustomRules = rulesCustom && rulesCustom.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <Calculator className="mr-2 text-emerald-600" size={20}/>
                {initialData ? 'Editar Venda' : 'Nova Venda'}
              </h2>
              {restoredFromDraft && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded flex items-center gap-1 font-bold">
                      <RefreshCw size={10} className="animate-spin-slow"/> Rascunho Restaurado
                  </span>
              )}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Produto</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as ProductType)}
                className="w-full bg-white text-gray-900 border-gray-300 rounded-lg shadow-sm p-2 border"
              >
                <option value={ProductType.BASICA}>{labels.basica || 'Cesta Básica'}</option>
                <option value={ProductType.NATAL}>{labels.natal || 'Cesta de Natal'}</option>
                {hasCustomRules && (
                    <option value={ProductType.CUSTOM}>{labels.custom || 'Personalizado'}</option>
                )}
              </select>
            </div>
            
            {/* NOVO CAMPO DE ORÇAMENTO AO LADO DO TIPO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <FileText size={16} className="text-gray-400"/> Nº Orçamento
              </label>
              <input 
                type="text" 
                value={quoteNumber} 
                onChange={e => setQuoteNumber(e.target.value)}
                className="w-full bg-white text-gray-900 border-gray-300 rounded-lg shadow-sm p-2 border"
                placeholder="Ex: 12345"
              />
            </div>
          </div>

          <div className="relative" ref={wrapperRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                  <span>Cliente</span>
                  {clientId && <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Vinculado</span>}
              </label>
              <input 
                type="text" 
                required
                value={client} 
                onChange={handleClientChange}
                onFocus={() => client.length > 1 && !clientId && setShowSuggestions(true)}
                className={`w-full bg-white text-gray-900 border-gray-300 rounded-lg shadow-sm p-2 border ${clientId ? 'border-emerald-500 ring-1 ring-emerald-500' : ''}`}
                placeholder="Nome do Cliente/Empresa"
                autoComplete="off"
              />
              {/* Autocomplete Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                      {suggestions.map((s) => (
                          <li 
                            key={s.id} 
                            onClick={() => selectSuggestion(s)}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center gap-2"
                          >
                              <User size={14} className="text-gray-400"/>
                              {s.name}
                          </li>
                      ))}
                  </ul>
              )}
          </div>

          <div className={`p-4 rounded-lg border ${type === ProductType.BASICA ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-gray-600">Dados Financeiros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantidade</label>
                <input 
                  type="number" 
                  min="1"
                  value={quantity} 
                  onChange={e => handleQuantityChange(e.target.value)}
                  className="w-full bg-white text-gray-900 border-gray-300 rounded-md p-2 border text-right"
                />
              </div>
               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1 group cursor-help">
                  Vlr. Proposto
                  <HelpCircle size={12} className="text-gray-400 group-hover:text-blue-500" />
                  <div className="absolute hidden group-hover:block bg-black text-white text-[10px] p-2 rounded -mt-12 shadow-lg z-10 w-40">
                      Base para cálculo da comissão.
                  </div>
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  value={valueProposed} 
                  onChange={e => handleProposedChange(e.target.value)}
                  className="w-full bg-white text-gray-900 border-emerald-300 ring-2 ring-emerald-100 rounded-md p-2 border text-right font-semibold"
                />
              </div>
               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1 group cursor-help">
                  Vlr. Venda (NF)
                  <HelpCircle size={12} className="text-gray-400 group-hover:text-blue-500" />
                  <div className="absolute hidden group-hover:block bg-black text-white text-[10px] p-2 rounded -mt-12 shadow-lg z-10 w-40">
                      Apenas informativo. Não afeta a comissão.
                  </div>
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  value={valueSold} 
                  onChange={e => handleSoldChange(e.target.value)}
                  className="w-full bg-white text-gray-900 border-gray-300 rounded-md p-2 border text-right"
                />
              </div>
               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Margem (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={marginPercent} 
                  onChange={e => handleMarginChange(e.target.value)}
                  className="w-full bg-white text-gray-900 border-blue-300 ring-2 ring-blue-100 rounded-md p-2 border text-right font-bold"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 text-white rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
             <div>
              <span className="block text-xs text-slate-400 uppercase">Base de Cálculo</span>
              <span className="text-lg font-bold text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.base)}
              </span>
              <span className="block text-[9px] text-slate-500">(Qtd x Proposto)</span>
            </div>
             <div>
              <span className="block text-xs text-slate-400 uppercase">Faixa Tabela</span>
              <span className="text-xl font-bold text-yellow-400">
                {(preview.commissionRate * 100).toFixed(2)}%
              </span>
            </div>
             <div>
              <span className="block text-xs text-slate-400 uppercase">Comissão Final</span>
              <span className="text-xl font-bold text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.commission)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
            {/* DATA FINALIZAÇÃO (PEDIDO) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <CalendarCheck size={16} className="text-blue-500" />
                Data Finalização (Pedido)
              </label>
              <input 
                type="date" 
                value={completionDate} 
                onChange={e => setCompletionDate(e.target.value)}
                className="w-full bg-white text-gray-900 border-gray-300 rounded-lg p-2 border"
                required
              />
            </div>
            
            {/* DATA FATURAMENTO (NF) + CHECKBOX */}
            <div className="relative flex flex-col">
              <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-500" />
                    Data Faturamento
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded border border-orange-200 hover:bg-orange-50 transition-colors select-none shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={isPendingDate} 
                        onChange={handlePendingChange}
                        className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-500"
                      />
                      <span className="text-xs font-bold text-orange-600">Pendente</span>
                  </label>
              </div>

              <div className="relative flex-1">
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    disabled={isPendingDate}
                    className={`w-full h-10 bg-white text-gray-900 border-gray-300 rounded-lg p-2 border transition-all ${isPendingDate ? 'opacity-40 cursor-not-allowed bg-gray-100' : ''}`}
                  />
                  {isPendingDate && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-xs font-bold text-orange-600 bg-orange-100/90 px-3 py-1 rounded-full border border-orange-200 flex items-center gap-1 shadow-sm backdrop-blur-sm">
                              <Clock size={12}/> Aguardando NF
                          </span>
                      </div>
                  )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <input 
                    type="text" 
                    value={observations} 
                    onChange={e => setObservations(e.target.value)}
                    className="w-full bg-white text-gray-900 border-gray-300 rounded-lg p-2 border"
                    placeholder="Detalhes adicionais..."
                  />
              </div>
              
              {/* NOVO CAMPO DE RASTREIO */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <Truck size={16} className="text-blue-500"/> Cód. Rastreio
                  </label>
                  <input 
                    type="text" 
                    value={trackingCode} 
                    onChange={e => setTrackingCode(e.target.value)}
                    className="w-full bg-white text-gray-900 border-gray-300 rounded-lg p-2 border"
                    placeholder="Ex: BR12345678"
                  />
              </div>
              
              {/* CAMPAIGN ATTRIBUTION */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <MessageCircle size={16} className="text-green-500" /> Origem (WhatsApp)
                  </label>
                  <select 
                    value={campaignId}
                    onChange={e => setCampaignId(e.target.value)}
                    className="w-full bg-white text-gray-900 border-gray-300 rounded-lg p-2 border"
                  >
                      <option value="">-- Nenhuma / Orgânico --</option>
                      {availableCampaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
              </div>
          </div>

        </form>

        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center shadow-md"
          >
            <Save size={18} className="mr-2" />
            Salvar Venda
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
