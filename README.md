# Finacy API — Backend

> Plataforma de Gestão Financeira e Limpeza de Nome

## Stack Tecnológica

| Tecnologia | Finalidade |
|---|---|
| **NestJS 11** | Framework backend modular |
| **TypeScript 5** | Tipagem estática |
| **TypeORM** | ORM para PostgreSQL |
| **PostgreSQL 15+** | Banco de dados relacional |
| **Stripe** | Pagamentos (PIX e Cartão de Crédito) |
| **JWT + Passport** | Autenticação e autorização |
| **Swagger/OpenAPI** | Documentação interativa da API |
| **Helmet** | Headers de segurança HTTP |
| **Throttler** | Rate limiting por endpoint |
| **Bcrypt** | Hash seguro de senhas |

## Arquitetura de Módulos

```
src/
├── modules/
│   ├── auth/           # Autenticação JWT + refresh token
│   ├── users/          # Gestão de usuários e perfis
│   ├── plans/          # Planos de assinatura
│   ├── subscriptions/  # Assinaturas ativas e histórico
│   ├── payments/       # Stripe (PIX + Cartão) + Webhooks
│   └── clean-name/     # Serviço de Limpeza de Nome
├── common/
│   ├── decorators/     # @Public, @Roles, @Permissions, @CurrentUser
│   ├── guards/         # JwtAuthGuard, RolesGuard
│   ├── filters/        # AllExceptionsFilter
│   ├── interceptors/   # TransformInterceptor
│   └── enums/          # UserRole, Permission, Status enums
└── config/
    └── database.config.ts
```

## Estratégias de Cybersegurança

- **JWT Bearer Token** com refresh token rotation
- **Brute-force protection**: bloqueio automático após 5 tentativas (15 min)
- **Rate limiting**: 100 req/min global, 5 req/min no registro
- **Helmet**: headers de segurança HTTP (CSP, HSTS, etc.)
- **CORS**: origens configuráveis por ambiente
- **Validation Pipe**: whitelist + forbidNonWhitelisted
- **Class Serializer**: exclusão automática de campos sensíveis (senha, tokens)
- **RBAC**: Super Admin > Admin > User com permissões granulares
- **Bcrypt**: hash de senhas com 12 rounds

## Configuração

```bash
# Copiar variáveis de ambiente
cp .env.example .env

# Instalar dependências
pnpm install

# Desenvolvimento
pnpm run start:dev

# Build de produção
pnpm run build && pnpm run start:prod
```

## Documentação da API

Acesse `http://localhost:3001/api/docs` para a documentação Swagger interativa.

## Endpoints Principais

### Autenticação
| Método | Endpoint | Acesso |
|---|---|---|
| POST | `/api/v1/auth/register` | Público |
| POST | `/api/v1/auth/login` | Público |
| POST | `/api/v1/auth/logout` | Autenticado |
| GET | `/api/v1/auth/me` | Autenticado |

### Planos
| Método | Endpoint | Acesso |
|---|---|---|
| GET | `/api/v1/plans` | Público |
| GET | `/api/v1/plans/:id` | Público |
| POST | `/api/v1/plans/seed` | Super Admin |

### Assinaturas
| Método | Endpoint | Acesso |
|---|---|---|
| GET | `/api/v1/subscriptions/current` | Autenticado |
| GET | `/api/v1/subscriptions/history` | Autenticado |
| GET | `/api/v1/subscriptions/stats/dashboard` | Autenticado |

### Pagamentos
| Método | Endpoint | Acesso |
|---|---|---|
| POST | `/api/v1/payments/subscribe/:planId` | Autenticado |
| POST | `/api/v1/payments/pix/:planId` | Autenticado |
| GET | `/api/v1/payments/history` | Autenticado |
| POST | `/api/v1/payments/cancel/:id` | Autenticado |
| POST | `/api/v1/payments/webhook` | Stripe (público) |

### Limpa Nome
| Método | Endpoint | Acesso |
|---|---|---|
| POST | `/api/v1/clean-name/request` | Assinante ativo |
| GET | `/api/v1/clean-name/requests` | Autenticado |
| GET | `/api/v1/clean-name/stats` | Autenticado |

## Planos Padrão

| Plano | Preço | Créditos Limpa Nome |
|---|---|---|
| Starter | R$ 97/mês | 1 |
| Professional | R$ 297/mês | 5 |
| Enterprise | R$ 697/mês | 20 |

## Integração Stripe (Webhook)

```bash
# Desenvolvimento local
stripe listen --forward-to localhost:3001/api/v1/payments/webhook
```

Eventos tratados:
- `invoice.payment_succeeded` → Ativa assinatura
- `invoice.payment_failed` → Marca como inadimplente
- `customer.subscription.updated` → Atualiza status
- `customer.subscription.deleted` → Cancela assinatura
