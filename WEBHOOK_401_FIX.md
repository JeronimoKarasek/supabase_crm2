# 🚨 SOLUÇÃO: Webhook Mercado Pago Não Funciona (401 Não Autorizado)

## Problema Identificado

Ao testar `https://crm.farolbase.com/api/mercadopago/webhook-test`, recebemos **401 Não Autorizado**.

Isso significa que:
1. ✅ O endpoint existe e está funcionando
2. ❌ Mas há uma camada de autenticação bloqueando acesso externo
3. ❌ Mercado Pago não consegue chamar o webhook

---

## ⚡ SOLUÇÃO RÁPIDA (Escolha UMA)

### Opção 1: Remover Proteção de Senha no Vercel (Recomendado)

Se você configurou **"Password Protection"** no Vercel:

1. Acesse: https://vercel.com/
2. Entre no projeto `supabase_crm2`
3. Vá em **Settings** → **General**
4. Procure por **"Password Protection"** ou **"Deployment Protection"**
5. Se estiver habilitado: **DESABILITE** ou adicione exceção para `/api/*`

**Importante:** APIs públicas (como webhooks) NÃO devem ter proteção por senha.

---

### Opção 2: Configurar Exceção para Rotas de API

Se você tem Vercel Pro/Team com "Deployment Protection":

1. Acesse: https://vercel.com/
2. Projeto → **Settings** → **Deployment Protection**
3. Adicione bypass rule:
   - **Path Pattern:** `/api/mercadopago/*`
   - **Method:** Allow all

---

### Opção 3: Usar Domínio Alternativo Sem Proteção

Se precisa manter senha no site principal:

1. Configure subdomínio `api.farolbase.com` sem proteção
2. Use URLs:
   - Site: `https://crm.farolbase.com` (com senha)
   - Webhook: `https://api.farolbase.com/api/mercadopago/webhook` (sem senha)

---

## 🔍 Como Verificar se Resolveu

### Teste 1: Acessar no navegador

Abra esta URL no navegador **sem estar logado/sem senha**:
```
https://crm.farolbase.com/api/mercadopago/webhook-test
```

**Resposta esperada:**
```json
{
  "ok": true,
  "message": "Webhook endpoint está acessível!",
  "timestamp": "2025-11-09T..."
}
```

**Se ainda pedir senha:** Proteção não foi removida.

---

### Teste 2: Via PowerShell

```powershell
Invoke-WebRequest -Uri "https://crm.farolbase.com/api/mercadopago/webhook-test" -Method GET
```

**Resposta esperada:** Status 200 com JSON acima.

---

### Teste 3: Simular Webhook do Mercado Pago

```powershell
$body = @{
  type = "payment"
  data = @{
    id = "133189349850"
  }
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://crm.farolbase.com/api/mercadopago/webhook" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

**Resposta esperada:** Status 200 com `{"ok":true}`

---

## 📋 Checklist de Configuração Mercado Pago

Após remover proteção, configure no painel do MP:

### Passo 1: Acessar Painel
- URL: https://www.mercadopago.com.br/developers/panel
- Login: `junior.karaseks@gmail.com`

### Passo 2: Configurar Webhooks
1. Menu lateral → **"Suas integrações"**
2. Clique em **"Notificações"** ou **"Webhooks"**
3. Procure **"URLs de notificação"** ou **"IPN"**

### Passo 3: Adicionar URL
- **URL:** `https://crm.farolbase.com/api/mercadopago/webhook`
- **Eventos:** ✅ **payment** (Pagamentos)
- **Modo:** Produção

### Passo 4: Testar
1. No painel MP, procure **"Testar webhook"**
2. Envie notificação de teste
3. Verifique logs no Vercel

---

## 🔐 Segurança Alternativa (Sem Senha)

Se remover proteção por senha, use a **assinatura secreta** que você gerou:

```
299e3b1f412f6c866735724a0eb8d3d724f24942262062c26639f06ee1f8fb64
```

### Como usar:
1. Adicione no `.env`:
   ```bash
   MERCADOPAGO_WEBHOOK_SECRET=299e3b1f412f6c866735724a0eb8d3d724f24942262062c26639f06ee1f8fb64
   ```

2. Mercado Pago enviará header `x-signature`

3. Webhook valida assinatura antes de processar

**Vantagem:** Apenas MP consegue chamar webhook (mesmo sem senha).

---

## 🛠️ Solução Temporária: Reprocessamento Manual

Enquanto não resolve o 401, use o script de reprocessamento:

### Script completo:

Crie arquivo `reprocess-payment.js`:

```javascript
const fs = require('fs')
const path = require('path')

// Lê .env.local
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    process.env[key] = value
  }
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

async function reprocessPayment(paymentId) {
  console.log(`\n🔄 Reprocessando pagamento ${paymentId}...\n`)
  
  // 1. Busca detalhes do pagamento no MP
  console.log('1️⃣ Consultando Mercado Pago...')
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` }
  })
  
  if (!mpRes.ok) {
    console.error('❌ Pagamento não encontrado no Mercado Pago')
    return
  }
  
  const payment = await mpRes.json()
  console.log('   Status:', payment.status)
  console.log('   Valor: R$', payment.transaction_amount)
  console.log('   Reference:', payment.external_reference)
  
  if (payment.status !== 'approved') {
    console.error('❌ Pagamento não está aprovado')
    return
  }
  
  if (!payment.external_reference?.startsWith('credits_')) {
    console.error('❌ Não é um pagamento de créditos')
    return
  }
  
  // 2. Extrai userId
  const parts = payment.external_reference.split('_')
  const userId = parts.slice(1, -1).join('_')
  console.log('\n2️⃣ User ID:', userId)
  
  // 3. Busca empresa
  const empresaRes = await fetch(`${SUPABASE_URL}/rest/v1/empresa_users?user_id=eq.${userId}&select=empresa_id`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  })
  const empresaData = await empresaRes.json()
  
  if (!empresaData[0]?.empresa_id) {
    console.error('❌ Usuário sem empresa vinculada')
    return
  }
  
  const empresaId = empresaData[0].empresa_id
  console.log('   Empresa ID:', empresaId)
  
  // 4. Adiciona créditos
  const cents = Math.round(payment.transaction_amount * 100)
  console.log('\n3️⃣ Adicionando', cents, 'cents à empresa...')
  
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/empresa_add_credits`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_empresa: empresaId,
      p_cents: cents
    })
  })
  
  if (!rpcRes.ok) {
    console.error('❌ Erro ao adicionar créditos:', await rpcRes.text())
    return
  }
  
  const newBalance = await rpcRes.json()
  console.log('   ✅ Novo saldo:', newBalance, 'cents (R$', (newBalance/100).toFixed(2), ')')
  
  console.log('\n✅ Pagamento reprocessado com sucesso!')
}

const paymentId = process.argv[2] || '133189349850'
reprocessPayment(paymentId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  })
```

### Como usar:

```powershell
# Reprocessar pagamento específico
node reprocess-payment.js 133189349850

# Reprocessar último pagamento (o que você já fez)
node reprocess-payment.js
```

---

## ✅ Resumo Ação Imediata

1. **AGORA:** Remova proteção por senha nas rotas `/api/*` no Vercel
2. **TESTE:** Abra `https://crm.farolbase.com/api/mercadopago/webhook-test` no navegador
3. **CONFIGURE:** Adicione URL no painel do Mercado Pago
4. **TESTE:** Faça novo pagamento de R$ 0,01
5. **VALIDE:** Veja se crédito entra automaticamente

Se ainda tiver problemas, me envie print da tela de erro do navegador ao acessar o webhook-test.

---

**Atualizado:** 09/11/2025  
**Causa raiz:** Proteção por senha no Vercel bloqueando webhooks externos  
**Status:** Aguardando remoção de proteção
