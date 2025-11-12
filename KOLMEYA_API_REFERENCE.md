# Kolmeya API - Chamadas do CRM

**API Base**: `https://weebserver6.farolchat.com/webhook`  
**Autenticação**: Bearer Token (fornecido pelo Kolmeya)

---

## 🔐 Autenticação

O token deve ser configurado em **Configurações → SMS** no CRM, ou via API:

```bash
# Salvar token no CRM
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/credentials' \
  -H 'Authorization: Bearer SEU_TOKEN_CRM' \
  -H 'Content-Type: application/json' \
  -d '{
    "smsApiToken": "seu_token_kolmeya_aqui",
    "smsMessageValue": "0.07"
  }'
```

---

## 📤 Enviar SMS (Endpoint usado pelo CRM)

### Request do CRM para Kolmeya:

```bash
curl -X POST 'https://weebserver6.farolchat.com/webhook/v1/sms/store' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer SEU_TOKEN_KOLMEYA' \
  -H 'Content-Type: application/json' \
  -d '{
    "sms_api_id": 0,
    "webhook_url": "https://crm.farolbase.com/api/disparo-sms/webhook",
    "tenant_segment_id": 1,
    "reference": "550e8400-e29b-41d4-a716-446655440000",
    "messages": [
      {
        "phone": 5511999887766,
        "message": "Olá João Silva, sua consulta é dia 15/11/2025!",
        "reference": "550e8400-e29b-41d4-a716-446655440000:123"
      },
      {
        "phone": 5511988776655,
        "message": "Olá Maria Santos, sua consulta é dia 16/11/2025!",
        "reference": "550e8400-e29b-41d4-a716-446655440000:124"
      }
    ]
  }'
```

---

## 📋 Estrutura do Payload

### Campos obrigatórios:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `messages` | Array | Lista de mensagens a enviar |
| `messages[].phone` | Integer | Telefone (somente números, com DDI) |
| `messages[].message` | String | Texto da mensagem (máx 160 chars) |
| `messages[].reference` | String | Identificador único (batch_id:row_id) |

### Campos opcionais:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sms_api_id` | Integer | ID da API configurada no Kolmeya (padrão: 0) |
| `webhook_url` | String | URL para callback de status |
| `tenant_segment_id` | Integer | Centro de custo / Segmento |
| `reference` | String | Identificador geral do lote (batch_id) |

---

## ✅ Resposta de Sucesso

```json
{
  "id": "request_id_kolmeya_123456",
  "status": "processing",
  "valids": [
    {
      "phone": 5511999887766,
      "message": "Olá João Silva...",
      "reference": "550e8400-e29b-41d4-a716-446655440000:123"
    }
  ],
  "invalids": [
    {
      "phone": 5511988776655,
      "message": "Olá Maria Santos...",
      "reference": "550e8400-e29b-41d4-a716-446655440000:124",
      "error": "Número inválido"
    }
  ],
  "blacklist": [
    {
      "phone": 5511977665544,
      "reference": "550e8400-e29b-41d4-a716-446655440000:125"
    }
  ],
  "not_disturb": [
    {
      "phone": 5511966554433,
      "reference": "550e8400-e29b-41d4-a716-446655440000:126"
    }
  ]
}
```

### Classificação das respostas:

- **valids**: SMS aceitos e enviados com sucesso
- **invalids**: Números inválidos ou formato incorreto
- **blacklist**: Números bloqueados (spam/abuse)
- **not_disturb**: Números que solicitaram não receber SMS

---

## 🔔 Webhook (Callback do Kolmeya)

O Kolmeya envia atualizações de status para o webhook configurado:

### Request do Kolmeya para o CRM:

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "request_id_kolmeya_123456",
    "status": "delivered",
    "phone": "5511999887766",
    "reference": "550e8400-e29b-41d4-a716-446655440000:123",
    "delivered_at": "2025-11-10T10:05:30Z"
  }'
```

### Status possíveis no webhook:

| Status | Descrição |
|--------|-----------|
| `delivered` | SMS entregue com sucesso |
| `failed` | Falha na entrega |
| `expired` | SMS expirado (não entregue em 48h) |
| `rejected` | Rejeitado pela operadora |

---

## 🔍 Como o CRM processa

### 1. Recebe requisição do usuário
```javascript
POST /api/disparo-sms/send
{ batch_id: "550e8400..." }
```

### 2. Busca mensagens na fila
```sql
SELECT * FROM sms_disparo 
WHERE batch_id = '550e8400...' 
AND status = 'queued'
LIMIT 1000;
```

### 3. Prepara payload para Kolmeya
```javascript
const payload = {
  messages: rows.map(r => ({
    phone: parseInt(r.phone, 10),
    message: r.message,
    reference: r.id
  }))
}
```

### 4. Envia para Kolmeya
```javascript
const res = await fetch('https://weebserver6.farolchat.com/webhook/v1/sms/store', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
```

### 5. Processa resposta
```javascript
// Valids → status: 'sent'
// Invalids → status: 'failed'
// Blacklist → status: 'blacklist'
// Not Disturb → status: 'not_disturb'
```

### 6. Desconta créditos
```javascript
// Cobra apenas pelos SMS válidos enviados
const totalBRL = (valids.length * pricePerMsg)
UPDATE empresa SET credits = credits - totalBRL
```

---

## ⚠️ Erros Comuns

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Token inválido ou expirado"
}
```
**Solução**: Verifique o token em Configurações → SMS

### 422 Validation Error
```json
{
  "error": "Validation failed",
  "details": {
    "messages.0.phone": "O campo phone deve ser numérico"
  }
}
```
**Solução**: Remova caracteres especiais do telefone

### 429 Rate Limit
```json
{
  "error": "Too many requests",
  "retry_after": 60
}
```
**Solução**: Aguarde 60 segundos antes de enviar novamente

---

## 📊 Exemplo Completo: Envio Manual

```bash
#!/bin/bash

# Configurações
KOLMEYA_TOKEN="seu_token_kolmeya"
BATCH_ID="550e8400-e29b-41d4-a716-446655440000"

# Enviar SMS
curl -X POST 'https://weebserver6.farolchat.com/webhook/v1/sms/store' \
  -H 'Accept: application/json'
  -H "Authorization: Bearer $KOLMEYA_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"webhook_url\": \"https://crm.farolbase.com/api/disparo-sms/webhook\",
    \"reference\": \"$BATCH_ID\",
    \"messages\": [
      {
        \"phone\": 5511999887766,
        \"message\": \"Teste de SMS via API\",
        \"reference\": \"${BATCH_ID}:manual_001\"
      }
    ]
  }"
```

---

## 🔧 Testando o Webhook

Simular callback do Kolmeya:

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "test_request_123",
    "status": "delivered",
    "phone": "5511999887766",
    "reference": "550e8400-e29b-41d4-a716-446655440000:123",
    "delivered_at": "2025-11-10T10:05:30Z"
  }'
```

---

## 📝 Limites e Restrições

| Limite | Valor |
|--------|-------|
| Mensagens por request | 1000 |
| Tamanho da mensagem | 160 caracteres (1 SMS) |
| Mensagens concatenadas | 153 chars/SMS (até 4 SMS) |
| Rate limit | Varia por conta |
| Webhook timeout | 30 segundos |

---

## 🎯 Boas Práticas

1. **Sempre use webhook_url** para receber atualizações de entrega
2. **Valide telefones** antes de enviar (DDI + DDD + número)
3. **Use reference único** para rastrear cada mensagem
4. **Monitore blacklist** e remova números bloqueados
5. **Respeite "não perturbe"** conforme legislação
6. **Limite caracteres** para evitar cobranças extras (1 SMS = 160 chars)
7. **Use batch_id** para agrupar campanhas relacionadas

---

**Última atualização**: 11 de novembro de 2025
