# Deploy na Vercel

## Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Repositório Git conectado

## Passos para deploy

### 1. Conectar o projeto

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório do projeto
3. **Root Directory:** selecione `finacy-back` (se o backend estiver em um monorepo)
4. O framework NestJS será detectado automaticamente

### 2. Variáveis de ambiente

Em **Settings > Environment Variables**, adicione todas as variáveis listadas em `.env.example`:

- `NODE_ENV`, `PORT`, `APP_URL`, `FRONTEND_URL`
- `DATABASE_URL` ou variáveis individuais do banco (DB_HOST, DB_PORT, etc.)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- `AUTENTIQUE_API_KEY`
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `CORS_ORIGINS` (URL do frontend em produção)
- `ENCRYPTION_KEY`, `BCRYPT_ROUNDS`

### 3. Stripe Webhook

Após o deploy, configure o webhook no [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

- **URL:** `https://seu-projeto.vercel.app/api/v1/payments/webhook`
- **Eventos:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, etc.

### 4. CORS

Garanta que `CORS_ORIGINS` inclua a URL do frontend em produção, por exemplo:
```
https://seu-frontend.vercel.app
```

### 5. Deploy

```bash
vercel
```

Ou faça push para a branch conectada — o deploy será automático.

## URLs da API

- Base: `https://seu-projeto.vercel.app/api/v1`
- Exemplo: `https://seu-projeto.vercel.app/api/v1/auth/login`
- Swagger (apenas em desenvolvimento): desabilitado em produção
