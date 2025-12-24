# WhatsApp Module Backend - Gestor360

Este é o serviço de backend autônomo para o módulo WhatsApp do Gestor360.

## 🚀 Deployment

1. **Firebase Setup**:
   - Crie um projeto Firebase.
   - Ative o Cloud Firestore e Firebase Storage.
   - Crie uma Service Account e salve o JSON (Base64).

2. **Environment Variables**:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço em Base64.
   - `SESSIONS_BUCKET`: Nome do bucket do Firebase Storage.
   - `SESSIONS_ENC_KEY`: Chave AES-256 (32 bytes em Base64).
   - `WA_MODULE_KEY`: Segredo compartilhado com o frontend.
   - `USE_OFFICIAL_WABA`: "true" ou "false".
   - `DATABASE_URL`: URL do Supabase Postgres (se aplicável).
   - `PORT`: Porta do servidor (padrão 3001).

3. **Cloud Run**:
   - Deploy da imagem Docker ou via source code para o Google Cloud Run.
   - Configure as variáveis de ambiente acima.

## ⚠️ Aviso Legal
O uso da biblioteca Baileys (não oficial) pode levar ao banimento da conta do WhatsApp. Prefira sempre o modo Oficial WABA para produção.

## 🐘 Migrations
Execute `./run_migrations.sh` para configurar os índices necessários no Firestore.
