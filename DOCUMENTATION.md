
# Documentação Técnica - Gestor360 v3.1.5

## 🎯 Visão Geral
Sistema ENTERPRISE de gestão comercial integrando Firestore Cloud Native, IA Gemini e BI de Curva ABC.

## 🏗️ Hierarquia de Autoridade (Roles)
- **DEV (Engenharia Root)**: Acesso absoluto. Ignora todas as travas de permissão. Destinado a suporte técnico e auditoria.
- **ADMIN (Gerência)**: Gestão de usuários, faturamento global, tabelas de comissão e **Toggles Globais de Módulos**.
- **USER (Representante)**: Operação diária de vendas e finanças.

## 🔒 Dicionário de Permissões (Granulares)
| Chave | Função |
| :--- | :--- |
| `abc_analysis` | Habilita gráficos de Pareto e classificação de clientes (A, B, C). |
| `ltv_details` | Permite abrir o Dossiê do Cliente e ver histórico de LTV. |
| `ai_retention` | Libera o uso de sugestões IA para recuperação de leads inativos. |
| `manual_billing` | Habilita faturamento manual em massa no módulo de Vendas. |
| `audit_logs` | Acesso aos logs de diagnóstico da plataforma (IndexedDB). |

## 🛠️ Governança Global (System Toggles)
Administradores podem desativar módulos inteiros para o sistema.
- Se `systemConfig.modules.ai` estiver `false`, o botão de Consultor IA desaparecerá para todos os usuários (exceto DEV).
- Útil para janelas de manutenção em APIs externas ou mudanças de plano.

## 📊 Business Intelligence (BI)
O motor de BI agora utiliza a **Regra de Pareto (80/20)** para classificar a carteira:
1. **Classe A**: 70% do faturamento acumulado.
2. **Classe B**: 20% do faturamento seguinte.
3. **Classe C**: 10% finais.

## 🛡️ Segurança Root Override
O motor `canAccess` em `services/logic.ts` implementa a regra:
`if (user.role === 'DEV') return true;`
Isso garante que desenvolvedores sempre tenham acesso às ferramentas de recuperação e auditoria, mesmo que suas permissões booleanas individuais estejam desativadas.

---
**Status: Enterprise Stable V3.1.5**
