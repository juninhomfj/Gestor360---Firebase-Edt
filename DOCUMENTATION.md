# Gestor360 v2.5.0 - Manual de Engenharia (Firebase Native)

Este documento contém os guias necessários para configuração do ambiente e governança de dados.

## 1. Arquitetura v2.5.0
O sistema utiliza **Cloud Firestore** com escrita direta (AWAIT) para garantir consistência em tempo real. A Sync Queue legada foi removida em favor de persistência síncrona.

## 2. Governança de Cálculos (VENDAS)
**IMPORTANTE**: As regras de cálculo de comissão e margem de lucro localizadas em `services/logic.ts` (`computeCommissionValues`) são consideradas o "Core de Negócio" e **não devem ser alteradas** em atualizações de interface.

## 3. Segurança & Índices
Para manter a performance sem depender de índices compostos manuais (que geram custos e complexidade de deploy), a ordenação de grandes listas (Vendas/Transações) é realizada via **JavaScript no lado do cliente** após o fetch inicial filtrado por UID.

## 4. Estrutura do Firestore
As coleções principais seguem o esquema:
- `profiles`: Metadados do usuário e permissões (RLS baseada em auth.uid).
- `sales`: Registro de faturamentos e orçamentos.
- `transactions`: Fluxo de caixa detalhado.
- `clients`: Base CRM compartilhada/privada.

---
**Hypelab Engineering Team - 2025**