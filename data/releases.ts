
export interface Release {
    version: string;
    date: string;
    title: string;
    type: 'MAJOR' | 'MINOR' | 'PATCH';
    description: string;
    changes: {
        type: 'NEW' | 'FIX' | 'IMPROVE' | 'SECURITY';
        text: string;
    }[];
}

export const RELEASES: Release[] = [
    {
        version: "2.4.0",
        date: "26/02/2025",
        title: "Finance SQL Alignment",
        type: "MINOR",
        description: "Migração completa da estrutura financeira para SQL estrito com suporte a UUIDs e Triggers de negócio.",
        changes: [
            { type: "NEW", text: "Database: Todas as tabelas financeiras (Metas, Cartões, Desafios) agora sincronizam com Supabase." },
            { type: "SECURITY", text: "Integridade: Conversão estrita de chaves estrangeiras para UUID no banco de dados." },
            { type: "IMPROVE", text: "Backend: Trigger automática para cálculo de lucro líquido e bruto nas vendas." },
            { type: "FIX", text: "Sync: Tratamento de dados legados (strings vazias) antes do envio para a nuvem." }
        ]
    },
    {
        version: "2.3.5",
        date: "25/02/2025",
        title: "UX Mobile & Cleanup",
        type: "PATCH",
        description: "Melhorias de usabilidade em dispositivos móveis e limpeza de configurações legadas.",
        changes: [
            { type: "FIX", text: "Mobile: Corrigido problema de 'toque fantasma' e rolagem no final da tela." },
            { type: "IMPROVE", text: "Settings: Removida seção obsoleta de chaves de API do sistema." },
            { type: "IMPROVE", text: "UX: Ajuste de área útil da tela para evitar sobreposição de botões." }
        ]
    },
    {
        version: "2.3.2",
        date: "24/02/2025",
        title: "Otimização de Sync & UX",
        type: "PATCH",
        description: "Melhorias significativas na performance de sincronização e feedback visual para o usuário.",
        changes: [
            { type: "IMPROVE", text: "Sync Engine: Implementado 'Delta Sync' (Sincronização Incremental) para reduzir uso de banda." },
            { type: "NEW", text: "UX: Adicionado modal detalhado de status de sincronização com fila em tempo real." },
            { type: "IMPROVE", text: "UI: Botões de ação (Lápis/Lixeira) agora seguem padrão de semáforo (Amarelo/Vermelho)." },
            { type: "FIX", text: "Mobile: Correção de z-index nos cards financeiros que impedia cliques em telas pequenas." }
        ]
    },
    {
        version: "2.3.0",
        date: "23/02/2025",
        title: "Marketing Edition",
        type: "MAJOR",
        description: "Lançamento do módulo completo de WhatsApp Marketing focado em segurança e conversão.",
        changes: [
            { type: "NEW", text: "WhatsApp: Wizard de Criação de Campanhas passo-a-passo." },
            { type: "NEW", text: "WhatsApp: Suporte a Mídia (Imagens/Vídeos) e Teste A/B nativo." },
            { type: "NEW", text: "CRM: Segmentação de contatos por Tags e Lead Scoring básico." },
            { type: "SECURITY", text: "Player Manual: Mecanismo anti-bloqueio simulando comportamento humano." }
        ]
    },
    {
        version: "2.2.0",
        date: "15/02/2025",
        title: "Cloud SQL Migration",
        type: "MAJOR",
        description: "Migração da arquitetura de arquivos JSON para Banco de Dados Relacional.",
        changes: [
            { type: "NEW", text: "Backend: Integração completa com Supabase (PostgreSQL)." },
            { type: "NEW", text: "Sync: Implementação do padrão 'Outbox Queue' para garantir consistência offline." },
            { type: "SECURITY", text: "Auth: Migração para Supabase Auth com RLS (Row Level Security)." },
            { type: "IMPROVE", text: "Performance: Consultas indexadas substituindo varredura de arrays." }
        ]
    },
    {
        version: "2.1.5",
        date: "05/02/2025",
        title: "Contas a Pagar & DRE",
        type: "MINOR",
        description: "Expansão do módulo financeiro para gestão completa de fluxo de caixa.",
        changes: [
            { type: "NEW", text: "Financeiro: Nova tela de 'Contas a Pagar' (Provisionamento)." },
            { type: "NEW", text: "Relatórios: DRE Gerencial automático com cálculo de margem líquida." },
            { type: "IMPROVE", text: "Conciliação: Baixa de lançamentos com suporte a múltiplos anexos." }
        ]
    },
    {
        version: "2.1.0",
        date: "01/02/2025",
        title: "AI Consultant Integration",
        type: "MINOR",
        description: "Integração com Google Gemini para insights de negócios.",
        changes: [
            { type: "NEW", text: "IA: Consultor financeiro integrado via chat." },
            { type: "NEW", text: "Automação: Criação de transações via comando de voz/texto natural." },
            { type: "SECURITY", text: "Privacidade: Chaves de API criptografadas localmente (BYOK)." }
        ]
    },
    {
        version: "2.0.5",
        date: "25/01/2025",
        title: "Sistema de Backup Seguro",
        type: "PATCH",
        description: "Ferramentas de segurança de dados e exportação.",
        changes: [
            { type: "NEW", text: "Backup: Exportação/Importação completa de banco criptografado (.v360)." },
            { type: "NEW", text: "Dados: Ferramenta de auditoria e remoção de duplicatas." },
            { type: "FIX", text: "Correção no cálculo de recorrência de parcelas." }
        ]
    },
    {
        version: "2.0.0",
        date: "15/01/2025",
        title: "Gestor360 Stable",
        type: "MAJOR",
        description: "Versão estável do núcleo de Vendas e Comissões.",
        changes: [
            { type: "NEW", text: "Core: Motor de cálculo de comissões baseado em margem de lucro." },
            { type: "NEW", text: "UI: Design System 'Dark Neon Glass' implementado." },
            { type: "NEW", text: "Navegação: Command Palette (Ctrl+K) para acesso rápido." }
        ]
    },
    {
        version: "1.9.0",
        date: "10/01/2025",
        title: "Beta Público",
        type: "MINOR",
        description: "Abertura para testes com funcionalidades essenciais.",
        changes: [
            { type: "NEW", text: "Vendas: Cadastro básico de vendas e clientes." },
            { type: "NEW", text: "Tabelas: Configuração de regras de comissão Básica/Natal." },
            { type: "NEW", text: "PWA: Suporte inicial a instalação offline." }
        ]
    },
    {
        version: "1.5.0",
        date: "05/01/2025",
        title: "Alpha Financeiro",
        type: "PATCH",
        description: "Primeira implementação do controle de caixa.",
        changes: [
            { type: "NEW", text: "Cadastro de Contas Bancárias." },
            { type: "NEW", text: "Lançamento simples de Receitas e Despesas." }
        ]
    },
    {
        version: "1.0.0",
        date: "01/01/2025",
        title: "MVP Release",
        type: "MAJOR",
        description: "Versão inicial de prova de conceito.",
        changes: [
            { type: "NEW", text: "Estrutura React + Vite." },
            { type: "NEW", text: "Persistência básica em LocalStorage." }
        ]
    }
];
