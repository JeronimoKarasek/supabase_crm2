# Documentação de Webhooks - Payloads com userId

## 📋 Resumo

**Todos os webhooks do sistema já incluem o `userId` junto com o `email`!**

---

## 🔔 Webhooks Disponíveis

### 1. **Simulador de Produtos** (`/api/simular`)

**Quando é chamado:** Usuário simula um produto/banco

**Payload enviado:**
```json
{
  "cpf": "12345678900",
  "email": "usuario@exemplo.com",
  "userId": "uuid-do-usuario",
  "credentials": {
    "username": "...",
    "password": "..."
  },
  "product": "nome-do-produto",
  "userMetadata": {
    "nome": "João Silva"
  },
  "timestamp": "2025-11-06T14:30:00.000Z"
}
```

**Configuração:** `global_settings.banks[].productConfigs[].webhookSimulador`

---

### 2. **Importação/Consulta em Lote** (`/api/importar`)

**Quando é chamado:** Usuário inicia uma importação em lote

**Payload enviado:**
```json
{
  "credentials": {
    "username": "...",
    "password": "..."
  },
  "itemId": "lote-123",
  "returnWebhook": "https://crm.farolbase.com/api/importar/status",
  "userId": "uuid-do-usuario",
  "email": "usuario@exemplo.com",
  "userMetadata": {
    "nome": "João Silva"
  },
  "timestamp": "2025-11-06T14:30:00.000Z"
}
```

**Configuração:** `global_settings.banks[].webhookUrl`

**Nota:** O webhook externo deve chamar o `returnWebhook` quando terminar o processamento.

---

### 3. **Créditos Adicionados via PIX** (`/api/mercadopago/webhook`)

**Quando é chamado:** Pagamento PIX é aprovado (via Mercado Pago)

**Payload enviado:**
```json
{
  "event": "credits_added",
  "referenceId": "credits_1730912345678",
  "status": "approved",
  "amount": 100.50,
  "userId": "uuid-do-usuario",
  "email": "usuario@exemplo.com",
  "userMetadata": {
    "nome": "João Silva"
  },
  "timestamp": "2025-11-06T14:30:00.000Z",
  "paymentId": "123456789",
  "provider": "mercadopago"
}
```

**Configuração:** `global_settings.addCreditsWebhook`

**Nota:** O sistema TAMBÉM adiciona os créditos automaticamente no Redis/Supabase, este webhook é OPCIONAL para notificações externas.

---

### 4. **Produto Comprado** (`/api/mercadopago/webhook`)

**Quando é chamado:** Pagamento de produto é aprovado

**Payload enviado:**
```json
{
  "event": "purchase_paid",
  "referenceId": "farol_1730912345678",
  "product": {
    "id": "uuid-produto",
    "name": "FarolChat Premium",
    "key": "farolchat",
    "sectors": ["Clientes", "Dashboard"]
  },
  "purchaseId": "uuid-compra",
  "userId": "uuid-do-usuario",
  "email": "usuario@exemplo.com",
  "userMetadata": {
    "nome": "João Silva"
  },
  "timestamp": "2025-11-06T14:30:00.000Z",
  "paymentId": "123456789",
  "provider": "mercadopago"
}
```

**Configuração:** `products.webhook_url` (campo do produto)

**Nota:** O sistema já libera os setores automaticamente, este webhook é para processamento adicional (ex: criar conta, enviar email, etc).

---

### 5. **Assinatura Renovada** (`/api/subscriptions/charge-monthly`)

**Quando é chamado:** Cobrança mensal de assinatura é processada com sucesso

**Payload enviado:**
```json
{
  "event": "subscription_renewed",
  "subscriptionId": "uuid-assinatura",
  "productId": "uuid-produto",
  "productName": "Premium Mensal",
  "userId": "uuid-do-usuario",
  "email": "usuario@exemplo.com",
  "chargedCents": 5000,
  "chargedBRL": "R$ 50,00",
  "newBalance": 15000,
  "nextChargeDate": "2025-12-06",
  "timestamp": "2025-11-06T06:00:00.000Z"
}
```

**Configuração:** `products.webhook_url` (campo do produto com assinatura)

**Nota:** Este webhook é chamado automaticamente pelo cron job mensal.

---

## 🔍 Informações Comuns em Todos os Webhooks

### Campos sempre presentes:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userId` | string (UUID) | ID único do usuário no Supabase Auth |
| `email` | string | Email do usuário |
| `timestamp` | string (ISO 8601) | Data/hora do evento |

### Campos opcionais comuns:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userMetadata` | object | Metadados do usuário (nome, telefone, etc) |

---

## 🔐 Validação de Webhooks

### Como validar que o webhook veio do seu sistema:

1. **IP Whitelist:** Configure seu servidor externo para aceitar apenas do IP do CRM

2. **Token secreto:** Adicione um campo `webhookSecret` na configuração e valide:

```javascript
// No seu servidor externo
app.post('/webhook', (req, res) => {
  const secret = req.headers['x-webhook-secret']
  if (secret !== process.env.EXPECTED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const { userId, email, event } = req.body
  console.log(`Webhook recebido: ${event} para userId ${userId}`)
  
  // Processar webhook...
  res.json({ ok: true })
})
```

3. **Assinatura HMAC:** (Mais seguro) - pode ser implementado se necessário

---

## 📊 Exemplos de Uso

### Exemplo 1: Registrar em sistema externo quando créditos são adicionados

```javascript
// Webhook externo recebe:
{
  "event": "credits_added",
  "userId": "abc-123",
  "email": "joao@empresa.com",
  "amount": 100.50
}

// Seu sistema pode:
// 1. Registrar em banco de dados de faturamento
// 2. Enviar email de confirmação personalizado
// 3. Atualizar sistema ERP
// 4. Enviar notificação para Slack/Discord
```

### Exemplo 2: Criar conta em serviço externo quando produto é comprado

```javascript
// Webhook externo recebe:
{
  "event": "purchase_paid",
  "userId": "abc-123",
  "email": "joao@empresa.com",
  "product": {
    "key": "farolchat",
    "name": "FarolChat Premium"
  }
}

// Seu sistema pode:
// 1. Criar conta no FarolChat para o usuário
// 2. Enviar credenciais por email
// 3. Ativar funcionalidades específicas
// 4. Registrar venda no CRM externo
```

### Exemplo 3: Sincronizar dados quando lote é importado

```javascript
// Webhook externo recebe:
{
  "userId": "abc-123",
  "email": "joao@empresa.com",
  "itemId": "lote-456",
  "returnWebhook": "https://crm.farolbase.com/api/importar/status"
}

// Seu sistema deve:
// 1. Processar o lote
// 2. Buscar dados do banco
// 3. Ao terminar, chamar o returnWebhook:

await fetch(returnWebhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemId: 'lote-456',
    status: 'completed', // ou 'failed'
    data: [
      { cpf: '12345678900', valor: 5000, status: 'aprovado' }
    ]
  })
})
```

---

## 🧪 Testando Webhooks Localmente

### Opção 1: ngrok (recomendado)

```bash
# Instalar ngrok
npm install -g ngrok

# Expor seu servidor local
ngrok http 3000

# Usar URL gerada (ex: https://abc123.ngrok.io) como webhook
```

### Opção 2: webhook.site (para debug)

1. Acesse https://webhook.site
2. Copie a URL única gerada
3. Configure como webhook
4. Veja os payloads recebidos em tempo real

---

## 📞 Suporte

Para dúvidas sobre webhooks:
- Verifique os logs do servidor: `npm run dev`
- Teste manualmente: `.\test-api.ps1`
- Documentação da API: `API_USAGE_GUIDE.md`

---

## ✅ Checklist de Configuração de Webhook

- [ ] Webhook URL configurada (https obrigatório em produção)
- [ ] Servidor externo aceitando POST com JSON
- [ ] Validação de origem implementada
- [ ] Campos `userId` e `email` sendo processados
- [ ] Logs implementados para debug
- [ ] Timeout configurado (recomendado: 30 segundos)
- [ ] Retry logic implementada (opcional)
- [ ] Notificações de erro configuradas

---

**Última atualização:** 06/11/2025
