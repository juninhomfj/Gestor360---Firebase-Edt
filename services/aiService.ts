
import { GoogleGenAI, Modality } from "@google/genai";
import { Transaction, Sale } from '../types';

// Use process.env.API_KEY directly as required
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const sendMessageToAi = async (message: string, history: any[], userKeys: any, sales: Sale[] = []) => {
    const ai = getAIClient();
    
    // Enrich context for the model
    const dataContext = `
        Dados do Usuário:
        - Total de Vendas: ${sales.length}
        - Vendas Faturadas: ${sales.filter(s => s.date).length}
        - Comissões a Receber (Brutas): R$ ${sales.filter(s => !s.date).reduce((acc, s) => acc + s.commissionValueTotal, 0).toFixed(2)}
    `;

    const contents = history.map(h => ({
        role: h.role,
        parts: h.parts || [{ text: h.text }]
    })).concat([{ role: 'user', parts: [{ text: dataContext + "\n\nPergunta: " + message }] }]);

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: "Você é o Consultor Gestor360. Analise dados de vendas e finanças. Se o usuário perguntar sobre notícias ou mercado, use a busca. Responda de forma executiva e estratégica."
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
