import { 
    ShoppingCart, 
    PieChart, 
    MessageCircle, 
    Calculator, 
    BarChart2, 
    Sparkles, 
    Users, 
    Newspaper, 
    Shield, 
    Terminal,
    LayoutDashboard
} from 'lucide-react';
import { AppMode, UserPermissions } from '../types';

export interface ModuleInfo {
    key: keyof UserPermissions;
    label: string;
    description: string;
    icon: any;
    route: string;
    appMode: AppMode;
    color: string;
    isBeta?: boolean;
}

export const SYSTEM_MODULES: ModuleInfo[] = [
    {
        key: 'sales',
        label: 'Vendas 360',
        description: 'Gestão de pedidos, comissões e faturamento comercial.',
        icon: ShoppingCart,
        route: 'sales',
        appMode: 'SALES',
        color: 'bg-emerald-500'
    },
    {
        key: 'finance',
        label: 'Finanças 360',
        description: 'Controle de caixa, contas, cartões e fluxo de caixa.',
        icon: PieChart,
        route: 'fin_dashboard',
        appMode: 'FINANCE',
        color: 'bg-blue-500'
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp Marketing',
        description: 'Disparos estratégicos, campanhas e CRM de mensagens.',
        icon: MessageCircle,
        route: 'whatsapp_main',
        appMode: 'WHATSAPP',
        color: 'bg-green-500'
    },
    {
        key: 'fiscal',
        label: 'Fiscal 360',
        description: 'Estimativa de impostos e obrigações para Simples e Presumido.',
        icon: Calculator,
        route: 'fiscal_main',
        appMode: 'FISCAL',
        color: 'bg-indigo-500',
        isBeta: true
    },
    {
        key: 'reports',
        label: 'Inteligência (BI)',
        description: 'Gráficos avançados, curva ABC e análise de LTV.',
        icon: BarChart2,
        route: 'reports',
        appMode: 'SALES',
        color: 'bg-purple-500'
    },
    {
        key: 'ai',
        label: 'Consultor IA',
        description: 'Análise estratégica de dados com Gemini Pro.',
        icon: Sparkles,
        route: 'dashboard', // Abre no dashboard
        appMode: 'SALES',
        color: 'bg-amber-500'
    },
    {
        key: 'crm',
        label: 'Hub de Clientes',
        description: 'Gestão de carteira, transferências e higienização.',
        icon: Users,
        route: 'settings',
        appMode: 'SALES',
        color: 'bg-rose-500'
    },
    {
        key: 'news',
        label: 'Release Notes',
        description: 'Novidades, atualizações e histórico do sistema.',
        icon: Newspaper,
        route: 'dev_roadmap',
        appMode: 'SALES',
        color: 'bg-slate-500'
    },
    {
        key: 'dev',
        label: 'Engenharia (Root)',
        description: 'Acesso total a banco de dados e logs de auditoria.',
        icon: Shield,
        route: 'dev_roadmap',
        appMode: 'SALES',
        color: 'bg-purple-700'
    }
];