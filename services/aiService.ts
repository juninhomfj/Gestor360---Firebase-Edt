import { GoogleGenAI, Modality } from "@google/genai";
import { Transaction, Sale, Company, Client } from '../types';
import { getCompany } from './fiscalService';

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const sendMessageToAi = async (message: string, history: any[], userKeys: any, sales: Sale[] = []) => {
    const ai = getAIClient();
    const uid = history[0]?.userId || ""; 
    
    let fiscalContext = "Empresa não cadastrada.";
    if (uid) {
        const company = await getCompany(uid);
        if (company) {
            fiscalContext = `Empresa: ${company.nomeFantasia} (${company.regimeTributario}). Persona Fiscal: ${company.regimeTributario === 'SIMPLES_NACIONAL' ? 'Contador Simples 360' : 'Contador Presumido 360'}.`;
        }
    }

    const activeSales = sales.filter(s => !s.deleted);

    const dataContext = `
        Dados Reais (Filtro Active-Only):
        - Total de Vendas Ativas: ${activeSales.length}
        - Vendas Faturadas: ${activeSales.filter(s => s.date).length}
        - Comissões a Receber (Brutas): R$ ${activeSales.filter(s => !s.date).reduce((acc, s) => acc + s.commissionValueTotal, 0).toFixed(2)}
        
        Contexto Fiscal:
        ${fiscalContext}
    `;

    // Process history into correct Content format for @google/genai
    const contents = history.map(h => ({
        role: h.role as any,
        parts: h.parts || [{ text: h.text }]
    })).concat([{ role: 'user', parts: [{ text: dataContext + "\n\nPergunta: " + message }] }]);

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: `Você é o Consultor Gestor360. ${fiscalContext} Analise dados de vendas e finanças. Se o usuário perguntar sobre notícias ou mercado, use a busca. Responda de forma executiva e estratégica.`
        },
    });

    const text = response.text || "Não foi possível processar a resposta.";
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const newHistory = history.concat([
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text }] }
    ]);

    return { 
        text, 
        newHistory,
        grounding 
    };
};

/**
 * 🎯 ESTRATÉGIA PREDITIVA DE CLIENTE
 * Analisa o histórico de um cliente específico e gera uma proposta comercial otimizada.
 */
export const generateClientStrategy = async (client: Client, sales: Sale[]) => {
    const ai = getAIClient();
    const historySummary = sales.map(s => `- Data: ${s.date || s.completionDate}, Qtd: ${s.quantity}, Margem: ${s.marginPercent}%, Valor: R$${s.valueSold}`).join('\n');
    
    const prompt = `
        Analise o histórico do cliente "${client.name}" para gerar uma estratégia de reativação ou upgrade:
        
        Histórico:
        ${historySummary}

        Ações solicitadas:
        1. Classifique a fidelidade (Alta, Média, Risco).
        2. Identifique o produto de maior interesse (Básica vs Natal).
        3. Sugira um pitch de venda para WhatsApp que foque em resolver uma dor baseada na sazonalidade ou no volume de compras dele.
        4. Se as margens estiverem caindo, sugira como renegociar.

        Responda em formato de Dossiê Executivo Curto.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: "Você é um Analista de BI Especialista em Retenção de Clientes (Churn Mitigation)."
        }
    });

    return response.text || "Erro ao processar estratégia IA.";
};

export const generateAudioMessage = async (text: string, voice: string = 'Kore'): Promise<string | null> => {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Leia esta mensagem de marketing de forma natural e profissional: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio ? `data:audio/pcm;base64,${base64Audio}` : null;
    } catch (e) {
        console.error("Erro no TTS Gemini:", e);
        return null;
    }
};

export const isAiAvailable = () => !!process.env.API_KEY;

export const optimizeMessage = async (text: string, tone: string) => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Refine este texto para WhatsApp com tom ${tone}, usando emojis e quebras de linha:\n\n"${text}"`
    });
    return response.text || text;
};