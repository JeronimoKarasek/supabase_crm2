# Guia de Uso da API - Internal API Key

## 🔑 Sua INTERNAL_API_KEY

```
Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=
```

**⚠️ IMPORTANTE:** Esta chave é **secreta** e deve ser tratada como uma senha. Não compartilhe publicamente!

---

## 📍 Endpoints Protegidos com x-api-key

### 1. **Consultar Créditos de um Usuário**

```bash
# Por userId
curl -X GET "https://crm.farolbase.com/api/credits?userId=USER_ID_AQUI" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="

# Por email
curl -X GET "https://crm.farolbase.com/api/credits?email=usuario@example.com" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
```

**Resposta:**
```json
{
  "ok": true,
  "balanceCents": 5000,
  "balanceBRL": "R$ 50,00"
}
```

---

### 2. **Adicionar Créditos**

```bash
curl -X POST "https://crm.farolbase.com/api/credits/add" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_AQUI",
    "amountBRL": 100.50
  }'
```

**Ou por email:**
```bash
curl -X POST "https://crm.farolbase.com/api/credits/add" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "amountBRL": 100.50
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "newBalance": 15050,
  "newBalanceBRL": "R$ 150,50"
}
```

---

### 3. **Cobrar/Descontar Créditos**

```bash
curl -X POST "https://crm.farolbase.com/api/credits/charge" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_AQUI",
    "amountBRL": 25.00
  }'
```

**Resposta (sucesso):**
```json
{
  "ok": true,
  "success": true,
  "newBalance": 5050,
  "newBalanceBRL": "R$ 50,50"
}
```

**Resposta (saldo insuficiente):**
```json
{
  "ok": true,
  "success": false,
  "error": "Saldo insuficiente",
  "required": 2500,
  "available": 1000
}
```
HTTP Status: `402 Payment Required`

---

### 4. **Processar Cobranças Mensais de Assinaturas**

```bash
# GET - Ver assinaturas pendentes (teste)
curl -X GET "https://crm.farolbase.com/api/subscriptions/charge-monthly" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="

# POST - Executar cobranças
curl -X POST "https://crm.farolbase.com/api/subscriptions/charge-monthly" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
```

**Resposta GET (preview):**
```json
{
  "today": "2025-11-06",
  "pending": 3,
  "subscriptions": [
    {
      "id": "uuid-123",
      "user_id": "user-abc",
      "product_id": "prod-xyz",
      "credit_price_cents": 5000,
      "next_charge_date": "2025-11-06",
      "status": "active",
      "products": {
        "name": "Produto Premium"
      }
    }
  ]
}
```

**Resposta POST (execução):**
```json
{
  "ok": true,
  "processed": 3,
  "results": {
    "total": 3,
    "success": 2,
    "insufficient_balance": 1,
    "errors": 0,
    "details": [
      {
        "subscriptionId": "uuid-123",
        "userId": "user-abc",
        "status": "success",
        "charged": "R$ 50,00"
      },
      {
        "subscriptionId": "uuid-456",
        "userId": "user-def",
        "status": "insufficient_balance",
        "failedAttempts": 1,
        "subscriptionStatus": "active"
      }
    ]
  }
}
```

---

## 🧪 Testando com PowerShell

### Windows PowerShell (5.1):

```powershell
# Consultar créditos
$headers = @{
    "x-api-key" = "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
}
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/credits?email=usuario@example.com" -Headers $headers
```

```powershell
# Adicionar créditos
$headers = @{
    "x-api-key" = "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
    "Content-Type" = "application/json"
}
$body = @{
    email = "usuario@example.com"
    amountBRL = 100.50
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://crm.farolbase.com/api/credits/add" -Method POST -Headers $headers -Body $body
```

```powershell
# Cobrar créditos
$body = @{
    email = "usuario@example.com"
    amountBRL = 25.00
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://crm.farolbase.com/api/credits/charge" -Method POST -Headers $headers -Body $body
```

```powershell
# Processar cobranças mensais
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/subscriptions/charge-monthly" -Method POST -Headers $headers
```

---

## 🔐 Segurança

### Onde usar esta chave:

✅ **Server-to-Server (S2S):**
- Scripts de automação
- Cron jobs
- Webhooks internos
- Ferramentas de administração
- APIs externas confiáveis

❌ **Nunca usar em:**
- Frontend (navegador)
- Aplicativos mobile
- Código público no GitHub
- URLs compartilhadas

### Rotação de chave:

Se a chave vazar, gere uma nova:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Atualize em `.env.local` e reinicie o servidor:
```bash
INTERNAL_API_KEY=NOVA_CHAVE_AQUI
```

---

## 📊 Monitoramento

Todos os endpoints protegidos logam no console:
```
[Credits] Consulta S2S via API key - email: usuario@example.com
[Subscriptions] Iniciando processamento de cobranças mensais...
[Subscriptions] ✅ Cobrança bem-sucedida: uuid-123
```

---

## 🚀 Configuração do Cron

### Opção 1: Vercel Cron

Crie `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/subscriptions/charge-monthly",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Opção 2: GitHub Actions

Crie `.github/workflows/monthly-charges.yml`:
```yaml
name: Monthly Subscription Charges
on:
  schedule:
    - cron: '0 6 * * *'  # Diariamente às 6:00 UTC
  workflow_dispatch:

jobs:
  charge:
    runs-on: ubuntu-latest
    steps:
      - name: Process charges
        run: |
          curl -X POST "https://crm.farolbase.com/api/subscriptions/charge-monthly" \
            -H "x-api-key: ${{ secrets.INTERNAL_API_KEY }}"
```

### Opção 3: Webhook Externo (cron-job.org, EasyCron, etc.)

Configure para chamar:
- URL: `https://crm.farolbase.com/api/subscriptions/charge-monthly`
- Método: `POST`
- Header: `x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=`
- Frequência: Diariamente

---

## ❓ Troubleshooting

### Erro 401 Unauthorized
```json
{ "error": "Unauthorized" }
```
**Solução:** Verifique se o header `x-api-key` está correto

### Erro 402 Payment Required
```json
{ "ok": true, "success": false, "error": "Saldo insuficiente" }
```
**Solução:** Usuário não tem créditos suficientes. Use `/api/credits/add` primeiro.

### Erro 500
**Solução:** Verifique os logs do servidor para detalhes

---

## 📞 Suporte

Para dúvidas sobre a API, consulte:
- Logs do servidor: `npm run dev` (modo desenvolvimento)
- Logs do Vercel: Dashboard → Logs
- Redis status: Verifique se está usando memória ou Upstash
