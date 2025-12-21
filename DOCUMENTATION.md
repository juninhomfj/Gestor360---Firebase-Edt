
# Gestor360 v2.4.2 - Manual de Engenharia

Este documento contém os guias necessários para configuração do ambiente e banco de dados.

## 1. Configuração do Supabase (SQL Editor)

Execute os comandos abaixo no SQL Editor do seu projeto Supabase para preparar o backend:

```sql
-- 1. TABELA DE PERFIS
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text,
  name text,
  email text,
  role text default 'USER' check (role in ('ADMIN', 'USER')),
  modules_config jsonb default '{"sales": true, "finance": true, "ai": true}'::jsonb,
  avatar_url text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;
create policy "Individual access" on public.profiles for all using (auth.uid() = id);

-- 2. TABELA DE VENDAS
create table public.sales (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  client_name text not null,
  quantity numeric default 1,
  product_type text,
  value_sold numeric,
  date_sale date,
  created_at timestamp with time zone default now()
);

alter table public.sales enable row level security;
create policy "User manages own sales" on public.sales for all using (auth.uid() = user_id);

-- 3. TRIGGER PARA NOVOS USUÁRIOS
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 2. Configuração de Autenticação

Para que o Magic Link e o Reset de senha funcionem, configure o Supabase Dashboard:

1.  **Authentication > URL Configuration**:
    *   **Site URL**: `https://seu-dominio.app` (ou `http://localhost:3000` em dev).
    *   **Redirect URLs**: Adicione `https://seu-dominio.app/auth/callback`.
2.  **Authentication > Email Templates**:
    *   Garanta que o link de redirecionamento aponte para `{{ .SiteURL }}/auth/callback`.

## 3. Segurança (BYOK)

As chaves de IA (Gemini) nunca são armazenadas em texto puro no banco de dados. O sistema utiliza criptografia AES-256 no lado do cliente (`utils/encryption.ts`) antes da sincronização.

---
**Hypelab Engineering Team**
