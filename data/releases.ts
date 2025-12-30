
import { Release } from '../types';

export const RELEASES: Release[] = [
    {
        version: "2.5.2",
        date: "27/02/2025",
        title: "Communication & Ticket Evolution",
        type: "PATCH",
        description: "Foco total em governança de atendimento e comunicados aos usuários.",
        changes: [
            { type: "NEW", text: "Messaging Hub: Envio de GIFs e mensagens formatadas para toda a base." },
            { type: "NEW", text: "Ticket Status: Administradores agora podem concluir tickets e notificar usuários." },
            { type: "FIX", text: "Finance Sync: Sincronização definitiva de categorias e orçamentos via Firestore." },
            { type: "FIX", text: "UI: Correção de abas brancas que não carregavam dados em cache frio." }
        ]
    },
    // ... releases anteriores mantidas
];
