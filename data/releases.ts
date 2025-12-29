
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
        version: "2.5.1",
        date: "27/02/2025",
        title: "Robustez de Infraestrutura",
        type: "PATCH",
        description: "Correção crítica no motor de persistência em lote e implementação de camada de segurança de dados.",
        changes: [
            { type: "FIX", text: "Firestore: Resolvido erro 'Unsupported field value: undefined' que travava importações em massa." },
            { type: "NEW", text: "Segurança: Implementado 'Firestore Guard' (Sanitização) que limpa objetos antes da escrita na nuvem." },
            { type: "IMPROVE", text: "Core: Otimização do Motor de Chunking para processar lotes de 450 registros com retry automático." },
            { type: "FIX", text: "Vendas: Correção de tipagem no campo completionDate durante a conversão de planilhas." }
        ]
    },
    {
        version: "2.5.0",
        date: "26/02/2025",
        title: "Firebase Native Evolution",
        type: "MAJOR",
        description: "Migração completa da arquitetura Supabase para Firebase Native com persistência síncrona.",
        changes: [
            { type: "NEW", text: "Database: Migração total para Cloud Firestore com escrita direta (Await Sync)." },
            { type: "NEW", text: "Auth: Implementação de Firebase Authentication com suporte a múltiplos perfis." },
            { type: "NEW", text: "Backup: Sistema de restauração via arquivos .v360 integrado ao novo core." }
        ]
    },
    {
        version: "2.4.0",
        date: "26/02/2025",
        title: "Finance SQL Alignment",
        type: "MINOR",
        description: "Migração da estrutura financeira para SQL estrito com suporte a UUIDs (Legado).",
        changes: [
            { type: "NEW", text: "Database: Todas as tabelas financeiras sincronizadas com Supabase (Migrado p/ Firebase na v2.5)." },
            { type: "IMPROVE", text: "Backend: Trigger automática para cálculo de lucro líquido e bruto." }
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
            { type: "SECURITY", text: "Player Manual: Mecanismo anti-bloqueio simulando comportamento humano." }
        ]
    }
];
