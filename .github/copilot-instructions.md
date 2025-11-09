# FarolTech CRM - AI Agent Instructions

## Project Overview

**FarolTech CRM** é um CRM SaaS multi-tenant com integração bancária, sistema de créditos prepago, marketplace de produtos digitais e automação de comunicação (WhatsApp API, SMS).

**Stack**: Next.js 14 (App Router), Supabase (Auth + PostgreSQL), Redis (Upstash), Tailwind CSS, shadcn/ui

## Architecture Essentials

### 1. Authentication Pattern
- **Client**: `supabase` (lib/supabase.js) - persistSession: true
- **Server**: `supabaseAdmin` (lib/supabase-admin.js) - service role key
- **API Routes**: Extract user via `Authorization: Bearer <token>` header

```javascript
async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const { data } = await supabaseAdmin.auth.getUser(auth.split(' ')[1])
  return data?.user || null
}
```

### 2. Credits System (Hybrid Persistence)
- **Primary**: Redis (`lib/redis.js` - Upstash ou in-memory fallback)
- **Fallback**: Supabase `user_credits` table quando Redis não configurado
- **Always in cents**: Evita problemas de float (R$ 10,00 = 1000 cents)
- **Keys**: `cr:bal:u:{userId}` ou `cr:bal:e:{empresaId}`

```javascript
// lib/credits.js
const cents = toCents(10.50) // 1050
await addCents(userId, cents, empresaId)
const balance = await getBalanceCents(userId, empresaId)
```

### 3. Multi-Tenant (Empresas)
- Tabela `empresa` (id, name, credits)
- Tabela `empresa_users` (empresa_id, user_id, role)
- Créditos podem ser por usuário OU por empresa
- Helper: `lib/empresa.js` → `getEmpresaForUser(userId)`

### 4. Payment Integration
- **Mercado Pago**: PIX (lib/mercadopago.js helper)
  - Auto-retry em 401 invalid token
  - Refresh via OAuth (client_credentials)
  - Prefixo `credits_` para créditos, `product_` para produtos
- **PicPay**: Alternativa (API similar)
- **Webhook**: `/api/mercadopago/webhook` processa status → adiciona créditos/libera produto

### 5. String Normalization (Critical Pattern)
```javascript
// Usado em TODO código para comparar setores/labels
const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

// Uso:
const can = (sector) => userSectors.some(s => norm(s) === norm(sector))
```

### 6. Permissions System
- **Roles**: `admin` | `viewer` (user_metadata.role)
- **Sectors**: Array de 12 setores (lib/sectors.js)
  - Dashboard, Clientes, Usuários, SMS, etc.
  - Controlam visibilidade de rotas e menus
- **Per-table permissions**: `user_metadata.permissions.allowedTables`
- **AuthGuard**: `components/auth-guard.jsx` - redireciona baseado em setores

## Critical Files & Patterns

### API Route Pattern
```javascript
// All routes must use this structure
export const dynamic = 'force-dynamic'

export async function GET/POST/PUT/DELETE(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ... lógica
}
```

### Webhook Pattern
```javascript
// Todos webhooks seguem estrutura:
{
  event: 'subscription_renewed' | 'credits_added' | 'purchase_paid',
  userId: 'uuid',
  email: 'user@example.com',
  userMetadata: {...},
  timestamp: new Date().toISOString(),
  // ... dados específicos
}
```

### Catch-all API Route
- `/api/[[...path]]/route.js` - Proxy genérico para Supabase tables
- Suporta GET (list/read), POST (create), PUT (update), DELETE
- Aplica filtros por setor e permissões
- Usado por tela de Clientes (`/clientes`)

## Developer Workflows

### Development
```powershell
npm run dev                    # Start dev server (port 3000)
npm run dev:3001              # Alternative port
npm run build                 # Production build
```

### Database Migrations
Scripts SQL em `scripts/sql/`:
- `empresa.sql` - Multi-tenant setup
- `products.sql` - Marketplace
- `disparo_sms.sql` - SMS campaigns
- Execute no **Supabase Dashboard → SQL Editor**

### Set User Permissions
```powershell
node scripts/set_user_sectors.js usuario@exemplo.com "Dashboard,SMS,Clientes"
node scripts/set_user_admin.js usuario@exemplo.com
```

### Save Mercado Pago Credentials
```sql
-- Execute no SQL Editor do Supabase
UPDATE global_settings
SET data = jsonb_set(data, '{payments,mercadopagoAccessToken}', '"APP_USR-..."'::jsonb)
WHERE id = 'global';
```

## Configuration Deep Dive

### Environment Variables (Required)
```bash
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Redis (recomendado - fallback: memory)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX...

# Mercado Pago (pagamentos)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...
MERCADOPAGO_CLIENT_ID=6832397982878428
MERCADOPAGO_CLIENT_SECRET=CVT5FOvFzJViDyzFic5whjgus9Thlkw7

# API Interna (S2S)
INTERNAL_API_KEY=<random_32_bytes>
```

### Global Settings (Supabase Table)
Tabela `global_settings` (id = 'global') armazena:
- `payments`: Credenciais Mercado Pago/PicPay
- `banks`: Configuração de bancos + webhooks
- `products`: Lista de produtos bancários
- `smsApiToken`: Kolmeya SMS API token
- `shiftDataWebhookToken`: Webhook para obter token Shift Data

Acesso: `/configuracao` (UI) ou `/api/global-settings` (API)

## Common Tasks

### Add New Sector
1. Adicionar em `lib/sectors.js`
2. Atualizar `components/app-nav.jsx` (menu item)
3. Adicionar rota em `app/<sector>/page.js`
4. Atualizar `components/auth-guard.jsx` (proteção de rota)

### Add Payment Provider
1. Criar helper em `lib/<provider>.js` (exemplo: `lib/mercadopago.js`)
2. Adicionar rota `/api/<provider>/checkout/route.js`
3. Adicionar webhook `/api/<provider>/webhook/route.js`
4. Atualizar `app/configuracao/page.js` (UI de credenciais)

### Add SMS Provider
1. Adicionar credenciais em `global_settings.smsApiToken`
2. Criar rotas em `app/api/disparo-sms/`
3. Atualizar `app/disparo-sms/page.js` (UI)

### Debug Credits Issue
```javascript
// lib/redis.js - verifica modo
console.log(`[Redis] Modo ativo: ${mode}`) // upstash | ioredis | memory

// Se memory, créditos são perdidos ao reiniciar
// Solução: configurar UPSTASH_REDIS_REST_URL
```

## Troubleshooting

### "invalid access token" (Mercado Pago)
1. Verificar token em `global_settings`: `SELECT data->'payments'->>'mercadopagoAccessToken' FROM global_settings WHERE id='global'`
2. Remover espaços: token sempre `.trim()`
3. Helper `lib/mercadopago.js` faz retry automático se tiver CLIENT_ID/SECRET

### "Collector user without key" (PIX QR Code)
- Mercado Pago exige CPF válido
- Corrigido em `app/api/payments/add-credits/route.js`
- Usa `user.user_metadata.cpf` ou fallback `00000000000`

### Créditos não persistem
- Redis em modo `memory` (fallback)
- Configurar `UPSTASH_REDIS_REST_URL` + token
- Ou usar Supabase: lib/credits.js detecta automaticamente

### Webhook não chama
- Verificar `notification_url` no pagamento
- Mercado Pago envia GET para validar URL (retornar 200)
- Deduplicação: usa Redis `setNX` para evitar processar 2x

## Code Style & Conventions

- **API Routes**: Always `export const dynamic = 'force-dynamic'`
- **Error Handling**: Return JSON com `{ error: string, details?: any }`
- **Logging**: Use `console.info`, `console.error` com prefixos `[Module]`
- **Token Masking**: Sempre mascarar em logs (lib/mercadopago.js exemplo)
- **Trim Strings**: Credenciais sempre `.trim()` antes de usar
- **Cents not BRL**: Créditos sempre em centavos (inteiros)

## Integration Points

### External APIs
- **Mercado Pago**: `https://api.mercadopago.com/v1/payments`
- **Kolmeya SMS**: `https://api.kolmeya.com.br/api/v1/sms/store`
- **Shift Data**: `https://api.shiftdata.com.br/api/` (CPF/CNPJ/Placa/Telefone)

### Webhooks (Incoming)
- `/api/mercadopago/webhook` - Payment status updates
- `/api/disparo-sms/webhook` - SMS delivery status (Kolmeya)
- `/api/importar/webhook` - Batch import results (banks)

### Internal APIs (Outgoing)
- Banks: Configurável em `global_settings.banks[].webhookUrl`
- Add Credits: `global_settings.payments.addCreditsWebhook`
- Products: `products.webhook_url` (quando comprado)

## Known Issues & Workarounds

### TypeScript Ignored
```javascript
// next.config.js
typescript: { ignoreBuildErrors: true }
```
**Workaround**: Enable gradualmente, um arquivo por vez

### ESLint Ignored
```javascript
eslint: { ignoreDuringBuilds: true }
```
**Workaround**: Fix warnings em batch, priorizar errors

### Redis Memory Mode
- Default: in-memory fallback
- **Impact**: Créditos perdidos ao reiniciar
- **Fix**: Configure Upstash ou ioredis

### Multiple .md Documentation Files
- `RESUMO_FINAL.md`, `API_USAGE_GUIDE.md`, `WEBHOOKS_DOCUMENTATION.md`, etc.
- **Workaround**: Consolidar em wiki/docs/ futuramente

## Quick Reference

### File Structure
```
app/
  api/                  # API routes (Next.js 14 App Router)
    [[...path]]/        # Catch-all proxy to Supabase
    mercadopago/        # Payment integration
    disparo-sms/        # SMS campaigns
    credits/            # Credits management
  clientes/             # Customers view (generic table UI)
  configuracao/         # Settings UI
  produtos/             # Marketplace
lib/
  supabase.js           # Client-side Supabase
  supabase-admin.js     # Server-side Supabase (service role)
  credits.js            # Credits system (hybrid Redis+Supabase)
  mercadopago.js        # Mercado Pago helper (retry, refresh, mask)
  redis.js              # Redis client (Upstash or in-memory)
  empresa.js            # Multi-tenant helpers
components/
  auth-guard.jsx        # Route protection by sectors
  app-nav.jsx           # Sidebar navigation
  app-chrome.jsx        # Layout + header
scripts/sql/            # Database migrations
```

### Key npm Scripts
```json
"dev": "cross-env NODE_OPTIONS=--max-old-space-size=512 next dev",
"build": "next build",
"start": "next start"
```

### Testing Checklist
- [ ] Login funciona (Supabase Auth)
- [ ] Créditos persistem (verificar Redis mode)
- [ ] PIX QR Code gera (Mercado Pago)
- [ ] Webhook processa pagamento
- [ ] Setores limitam acesso corretamente
- [ ] SMS envia (Kolmeya)
- [ ] Produtos liberam setores após compra

---

**Last Updated**: November 9, 2025  
**Version**: 1.0  
**Maintainer**: @JeronimoKarasek
