
import { Release } from '../types';

export const RELEASES: Release[] = [
    {
        version: "3.0.0",
        date: "27/02/2025",
        title: "Enterprise Analytics Update",
        type: "MAJOR",
        description: "Transformação do Gestor360 em uma plataforma de BI de alto nível para representantes comerciais.",
        changes: [
            { type: "NEW", text: "Curva ABC: Classificação automática de clientes baseada no princípio de Pareto (80/20)." },
            { type: "NEW", text: "Mobile UX: Nova barra de navegação inferior para experiência 100% nativa em smartphones." },
            { type: "NEW", text: "Ticket Médio & Frequência: Novas métricas de performance individual no módulo CRM." },
            { type: "IMPROVE", text: "Safe Areas: Ajuste de layout para compatibilidade total com iPhone Dynamic Island e Home Bar." }
        ]
    },
    {
        version: "2.9.5",
        date: "27/02/2025",
        title: "Intelligence & Retention Update",
        type: "PATCH",
        description: "Nova camada de inteligência focada em redução de churn e automação de cobrança.",
        changes: [
            { type: "NEW", text: "Alertas de Cobrança: Identificação visual de recebíveis vencidos e vincendos." },
            { type: "NEW", text: "Ação Reativa IA: Botão de reativação para clientes inativos com mensagens otimizadas pelo Gemini." },
            { type: "NEW", text: "Breakeven Line: Gráfico de projeção financeira agora mostra o ponto de equilíbrio baseado na média de despesas." },
            { type: "IMPROVE", text: "Audio Feedback: Sons de sucesso integrados ao fluxo de controle operacional de boletos." }
        ]
    }
];
