# WhatsApp Module - Backend v2.5.0

Módulo de processamento de mensagens e gestão de sessões WhatsApp para o Gestor360.

## 🚀 Arquitetura
- **Engine:** Node.js (ESM) + TypeScript
- **Socket:** Baileys (ou Official WABA via Adapter)
- **Persistência de Sessão:** Firebase Storage (Criptografado)
- **Fila de Jobs:** BullMQ + Redis (Upstash recomendado)
- **Logs & Metas:** Cloud Firestore

## 🛠️ Configuração Upstash Redis
Para utilizar o Redis na nuvem (Serverless):
1. Crie uma conta em [upstash.com](https://upstash.com).
2. Crie uma instância Redis.
3. Copie a **Node.js Connection String** (rediss://...).
4. Cole no seu `.env` na variável `REDIS_URL`.

## 📦 Implantação (Cloud Run)

1. **Build da Imagem:**
   ```bash
   docker build -t gcr.io/[PROJECT_ID]/wa-backend .
   ```

2. **Deploy do Servidor API:**
   ```bash
   gcloud run deploy wa-api --image gcr.io/[PROJECT_ID]/wa-backend --env-vars-file .env.yaml
   ```

3. **Deploy do Worker (Fila):**
   Execute a mesma imagem mas altere o entrypoint para `npm run worker`.

## 🔒 Segurança (BYOK)
As sessões do WhatsApp contêm tokens sensíveis. O backend **nunca** armazena esses dados em texto puro. 
- O estado é serializado.
- Criptografado com **AES-256-GCM** usando `SESSIONS_ENC_KEY`.
- Enviado para o Firebase Storage Bucket privado.

---
**Hypelab Engineering - 2025**