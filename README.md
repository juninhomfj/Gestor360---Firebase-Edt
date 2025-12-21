
# Gestor360 v2.4.2 (Full Auth Edition)

Sistema profissional de gestão empresarial **Local-First (PWA)** com autenticação avançada Supabase.

## 🔑 Configuração de Autenticação (Dashboard Supabase)

Para que os fluxos de e-mail funcionem, siga estes passos no painel do Supabase:

1.  **Authentication > URL Configuration**:
    *   **Site URL**: Coloque o link onde o app está hospedado.
    *   **Redirect URLs**: Adicione o mesmo link.
2.  **Authentication > Email Templates**:
    *   Ative o template de **Magic Link** e **Reset Password**.
    *   Certifique-se que o link contém os parâmetros de token.
3.  **Authentication > Providers**:
    *   Verifique se o provider "Email" está habilitado.
    *   "Confirm Email" pode ser desabilitado para testes rápidos, mas é recomendado em produção.

## 🤖 Novidades v2.4.2
*   **Magic Link Login:** Acesso rápido por e-mail sem precisar lembrar senhas.
*   **Self-Service Password Reset:** Recuperação de conta autônoma e segura.
*   **Auth State Observer:** Detecção inteligente de tokens de recuperação na URL para troca imediata de tela.

---
**Desenvolvido para alta performance e segurança total.**
