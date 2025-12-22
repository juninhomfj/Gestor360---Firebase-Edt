
import { GoogleGenAI } from "@google/genai";
import { Transaction } from '../types';

/**
 * Envia uma mensagem para o Gemini AI e retorna texto, histórico atualizado e grounding.
 * Segue estritamente as diretrizes da SDK do Gemini 3.
 */
export const sendMessageToAi = async (message: string, history: any[], userKeys: any, sales: any[] = []) => {
    // Fixed: Initialize GoogleGenAI with API Key obtained exclusively from process.env.API_KEY.
    // GUIDELINE: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Converte histórico para o formato esperado pela API
    const contents = history.map(h => ({
        role: h.role,
        parts: h.parts || [{ text: h.text }]
    })).concat([{ role: 'user', parts: [{ text: message }] }]);

    // Executa geração com grounding de busca (disponível no Gemini 3 Flash)
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: "Você é um consultor financeiro especialista integrado ao sistema Gestor360. Analise dados de vendas e transações com precisão cirúrgica."
        },
    });

    // Fix: Access .text property directly from GenerateContentResponse as per guidelines.
    const text = response.text || "Desculpe, não consegui processar sua resposta no momento.";
    
    // Grounding Metadata conforme diretrizes
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

/**
 * Optimizes a message for WhatsApp using AI.
 * Fixed: Obtain API key exclusively from process.env.API_KEY.
 */
export const optimizeMessage = async (text: string, tone: string, userKeys?: any) => {
    // Fixed: Initialize client with process.env.API_KEY directly.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Refine o texto abaixo para WhatsApp com tom ${tone}: "${text}"`
    });
    // Fix: Access .text property instead of text() method.
    return response.text || text;
};

export const getDailyUsage = () => ({ date: '', requestsCount: 0, inputTokensApprox: 0, outputTokensApprox: 0, lastRequestTime: 0 });
export const generateFinancialInsight = async (a: any, b: any, c: any) => "";
