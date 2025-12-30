
# Gestor360 v2.5.2 - Manual de Engenharia (Firebase Native)

## 🚀 Novidades v2.5.2
- **Firestore Guard**: Camada de sanitização automática de objetos antes da escrita.
- **Admin Messaging**: Hub de comunicados formatados com suporte a GIFs e Push.
- **Ticket Tracking**: Sistema de resolução de bugs integrado ao chat interno.

## 🔒 Segurança & Permissões
A granulação de acesso agora suporta os seguintes níveis:
- **DEV**: Acesso Root. Ignora regras de UID e pode realizar limpezas atômicas.
- **ADMIN**: Gestão de usuários, alteração de tabelas de comissão e resposta a tickets.
- **USER**: Operação padrão. Vê apenas seus próprios dados (RLS).

### Matriz de Permissões:
| Módulo | User | Admin | Dev |
| :--- | :--- | :--- | :--- |
| Vendas | Leitura/Escrita (Proprio) | Tudo | Tudo |
| Financeiro | Leitura/Escrita (Proprio) | Tudo | Tudo |
| Comunicados | Leitura | Tudo | Tudo |
| Engenharia | Bloqueado | Bloqueado | Tudo |

## 🛠️ Manutenção do Módulo Financeiro
O módulo financeiro utiliza persistência síncrona. Caso uma aba não carregue, verifique se a coleção Firestore correspondente (`accounts`, `categories`, `goals`, `transactions`) possui documentos com o `userId` correto.

---
**Hypelab Engineering Team - 2025**
