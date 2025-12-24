# WhatsApp Module - Backend (Firebase variant)

Backend do módulo WhatsApp projetado para integrar com Firestore & Firebase Storage e enfileirar jobs via Cloud Tasks ou Redis/BullMQ.

## Pré-requisitos
- Node 18+
- Conta Firebase com service account
- Firebase Storage bucket
- Cloud Tasks queue ou Redis

## Variáveis de ambiente
- FIREBASE_SERVICE_ACCOUNT_JSON (base64)
- SESSIONS_BUCKET
- SESSIONS_ENC_KEY (base64 32 bytes)
- WA_MODULE_KEY
- USE_OFFICIAL_WABA ("true"|"false")
- USE_CLOUD_TASKS ("true"|"false")

## Instalação local
1. Copie .env.example.txt -> .env
2. npm ci
3. npm run dev

## Deploy
- Recomendado: Google Cloud Run + Google Cloud Tasks.
- Alternativo: VPS com Docker e Redis.