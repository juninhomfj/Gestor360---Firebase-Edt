# Documentação Técnica - Gestor360 v1.0.0

## 🎯 Visão Geral
Sistema estável de gestão de comissionamento e finanças integrando Firebase Cloud Native e IA Gemini.

## 🏗️ Estratégia de Parsing (Zero Migration)
O sistema implementa uma camada de isolamento para tipos numéricos:
1. **Camada de Leitura**: Utiliza `ensureNumber` para tratar strings ("1.234,56") e formatá-las como float.
2. **Camada de Escrita**: Mantém os dados originais sem transformações forçadas, evitando corrupção de dados legados e garantindo compatibilidade com versões anteriores.

## 🔒 Segurança e Gestão de Dados
- **RLS (Row Level Security)**: Aplicado no Firestore para garantir que usuários só acessem dados onde `userId == auth.uid`.
- **Hard Reset**: Operação administrativa realizada via **Cloud Function (Node.js/Admin SDK)**. O frontend solicita a operação que é validada e executada no servidor para bypassar restrições de permissão local.

## 📊 Módulos Principais
- **Vendas**: Listagem com paginação client-side para alta performance, seleção global em dados filtrados e faturamento em massa.
- **Finanças**: Extrato consolidado, gestão de contas PF/PJ e cartões com cálculo de fechamento de fatura.
- **IA**: Consultor Gemini integrado via API SDK nativo para análise estratégica de ROI e métricas de produtividade.

---
**Status: Baseline Stable V1.0.0**