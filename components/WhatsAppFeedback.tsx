
import React, { useState } from 'react';
import { Star, AlertCircle, X } from 'lucide-react';
import { WhatsAppErrorCode } from '../types';

interface WhatsAppFeedbackProps {
  logId: string;
  contactName: string;
  phone: string;
  onComplete: (notes?: string, rating?: number, error?: {
    type: WhatsAppErrorCode;
    description: string;
  }) => void;
  onSkip: () => void;
}

const WhatsAppFeedback: React.FC<WhatsAppFeedbackProps> = ({
  logId,
  contactName,
  phone,
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState<'rating' | 'notes' | 'error'>('rating');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [errorType, setErrorType] = useState<WhatsAppErrorCode>('UNKNOWN_ERROR');
  const [errorDescription, setErrorDescription] = useState('');
  
  const handleRatingSubmit = () => {
    if (rating !== null) {
      if (rating <= 2) {
        // Avaliação baixa, perguntar se houve erro
        setStep('error');
      } else {
        setStep('notes');
      }
    }
  };
  
  const handleComplete = () => {
    if (errorType !== 'UNKNOWN_ERROR' && errorDescription.trim()) {
      onComplete(notes.trim() || undefined, rating || undefined, {
        type: errorType,
        description: errorDescription
      });
    } else {
      onComplete(notes.trim() || undefined, rating || undefined);
    }
  };
  
  const errorOptions: Array<{value: WhatsAppErrorCode; label: string; description: string}> = [
    { value: 'BLOCKED_BY_USER', label: 'Bloqueado pelo usuário', description: 'O número te bloqueou' },
    { value: 'PHONE_NOT_REGISTERED', label: 'Número não tem WhatsApp', description: 'O número não está registrado no WhatsApp' },
    { value: 'INVALID_PHONE', label: 'Número inválido', description: 'O formato do número está incorreto' },
    { value: 'NETWORK_ERROR', label: 'Problema de rede', description: 'Falha na conexão com a internet' },
    { value: 'RATE_LIMITED', label: 'Limite de envios', description: 'Muitas mensagens em pouco tempo' },
    { value: 'UNKNOWN_ERROR', label: 'Outro problema', description: 'Descreva abaixo o que aconteceu' }
  ];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-slate-700 animate-in zoom-in-95">
        {/* Cabeçalho */}
        <div className="p-6 border-b dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold dark:text-white">
              {step === 'rating' && 'Como foi o envio?'}
              {step === 'notes' && 'Alguma observação?'}
              {step === 'error' && 'O que aconteceu?'}
            </h3>
            <button
              onClick={onSkip}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {contactName} • <span className="font-mono">{phone}</span>
          </p>
        </div>
        
        {/* Conteúdo */}
        <div className="p-6">
          
          {/* Passo 1: Avaliação */}
          {step === 'rating' && (
            <div className="text-center">
              <p className="mb-6 text-gray-700 dark:text-gray-300">
                Avalie a dificuldade deste envio
              </p>
              
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-2 rounded-full transition-all ${
                      rating === star
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 transform scale-110'
                        : 'text-gray-300 dark:text-slate-600 hover:text-yellow-400'
                    }`}
                  >
                    <Star 
                      size={36} 
                      fill={rating && rating >= star ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              
              <div className="text-xs text-gray-400 mb-8 px-4">
                <div className="flex justify-between">
                  <span>Muito difícil</span>
                  <span>Muito fácil</span>
                </div>
              </div>
              
              <button
                onClick={handleRatingSubmit}
                disabled={rating === null}
                className={`w-full py-3 rounded-lg font-bold transition-all shadow-md ${
                  rating === null
                    ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                Continuar
              </button>
            </div>
          )}
          
          {/* Passo 2: Notas */}
          {step === 'notes' && (
            <div>
              <p className="mb-4 text-gray-700 dark:text-gray-300 text-sm">
                Quer adicionar alguma observação sobre este contato?
              </p>
              
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Cliente muito receptivo, pediu mais informações sobre..."
                className="w-full h-32 p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('rating')}
                  className="flex-1 py-3 border border-gray-300 dark:border-slate-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md transition-all"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
          
          {/* Passo 3: Reportar erro */}
          {step === 'error' && (
            <div>
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-bold text-red-800 dark:text-red-300 text-sm">
                      Nos ajude a melhorar!
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      Reporte o problema para otimizarmos o processo.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
                {errorOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                      errorType === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <input
                      type="radio"
                      name="errorType"
                      value={option.value}
                      checked={errorType === option.value}
                      onChange={(e) => setErrorType(e.target.value as WhatsAppErrorCode)}
                      className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-bold text-sm dark:text-white">{option.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              {errorType === 'UNKNOWN_ERROR' && (
                <div className="mb-6">
                  <label className="block text-xs font-bold mb-2 dark:text-gray-300 uppercase">
                    Descreva o problema:
                  </label>
                  <textarea
                    value={errorDescription}
                    onChange={(e) => setErrorDescription(e.target.value)}
                    placeholder="O que aconteceu? O que viu na tela?"
                    className="w-full h-24 p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('rating')}
                  className="flex-1 py-3 border border-gray-300 dark:border-slate-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    if (errorType === 'UNKNOWN_ERROR' && !errorDescription.trim()) {
                      alert('Por favor, descreva o problema.');
                      return;
                    }
                    setStep('notes');
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-all"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}
          
        </div>
        
        {/* Rodapé */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-center rounded-b-xl">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Estes dados nos ajudam a melhorar o processo para todos
          </p>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppFeedback;
