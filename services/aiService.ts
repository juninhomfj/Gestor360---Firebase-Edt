
import { GoogleGenAI } from "@google/genai";
import { Transaction } from '../types';

export const sendMessageToAi = async (message: string, history: any[], userKeys: any, sales: any[] = []) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const contents = history.map(h => ({
        role: h.role,
        parts: h.parts || [{ text: h.text }]
    })).concat([{ role: 'user', parts: [{ text: message }] }]);

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: "Você é um consultor financeiro especialista integrado ao sistema Gestor360. Analise dados de vendas e transações com precisão cirúrgica."
        },
    });

    const text = response.text || "Desculpe, não consegui processar sua resposta no momento.";
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

export const isAiAvailable = () => !!process.env.API_KEY;

export const optimizeMessage = async (text: string, tone: string, userKeys?: any) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Refine o texto abaixo para WhatsApp com tom ${tone}: "${text}"`
    });
    return response.text || text;
};

export const getDailyUsage = () => ({ date: '', requestsCount: 0, inputTokensApprox: 0, outputTokensApprox: 0, lastRequestTime: 0 });
export const generateFinancialInsight = async (a: any, b: any, c: any) => "";
