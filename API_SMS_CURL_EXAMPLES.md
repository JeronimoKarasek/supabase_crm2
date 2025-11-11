# Documentação de api - Exemplos de CURL

**Base URL**: `https://crm.farolbase.com`  
**Autenticação**: Bearer Token (JWT do Supabase)

---

## 🔐 Como obter o token

```bash
# Login (obter access_token)
curl -X POST 'https://your-supabase-url.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "seu@email.com",
    "password": "sua_senha"
  }'

# Resposta contém: { "access_token": "eyJhbGc..." }
```

---

## 📋 1. Listar Segmentos (Centros de Custo)

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/segments' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json'
```

**Resposta:**
```json
{
  "ok": true,
  "segments": [
    { "id": 1, "nome": "Marketing" },
    { "id": 2, "nome": "Vendas" }
  ]
}
```

---

## 💰 2. Consultar Saldo de Créditos

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/balance' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json'
```

**Resposta:**
```json
{
  "ok": true,
  "balance": "150.50",
  "balanceBRL": "R$ 150,50"
}
```

---

## 📤 3. Importar Campanha (CSV)

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/import' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "message_template": "Olá {{nome}}, sua consulta é dia {{data}}!",
    "tenant_segment_id": 1,
    "reference_prefix": "campanha_nov",
    "rows": [
      {
        "phone": "11999887766",
        "nome": "João Silva",
        "data": "15/11/2025"
      },
      {
        "phone": "11988776655",
        "nome": "Maria Santos",
        "data": "16/11/2025"
      }
    ]
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "inserted": 2,
  "invalid": 0
}
```

---

## 📊 4. Listar Campanhas (Batches)

```bash
curl -X GET 'https://crm.farolbase.com/api/disparo-sms/batches' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI'
```

**Resposta:**
```json
{
  "ok": true,
  "batches": [
    {
      "batch_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2025-11-10T10:00:00Z",
      "counts": {
        "total": 100,
        "queued": 50,
        "sent": 40,
        "failed": 10,
        "blacklist": 0,
        "not_disturb": 0
      }
    }
  ]
}
```

---

## 🚀 5. Enviar SMS (Disparar Campanha)

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/send' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "batch_id": "550e8400-e29b-41d4-a716-446655440000",
    "include_failed": false
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "sent": 45,
  "failed": 5,
  "blacklist": 0,
  "not_disturb": 0,
  "valid": 45,
  "invalid": 5,
  "credits": {
    "charged": true,
    "unitBRL": 0.07,
    "totalUnits": 45,
    "error": null
  }
}
```

---

## 📈 6. Relatório Detalhado

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/reports/detailed' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "batch_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "items": [
    {
      "phone": "11999887766",
      "message": "Olá João Silva, sua consulta é dia 15/11/2025!",
      "status": "sent",
      "sent_at": "2025-11-10T10:05:00Z",
      "error_message": null
    },
    {
      "phone": "11988776655",
      "message": "Olá Maria Santos...",
      "status": "failed",
      "error_message": "Número inválido"
    }
  ]
}
```

---

## 🔧 7. Salvar Credenciais SMS

```bash
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/credentials' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "smsApiToken": "seu_token_kolmeya_aqui",
    "smsMessageValue": "0.07"
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "message": "Configurações salvas com sucesso"
}
```

---

## 🔔 8. Webhook (Callback do Kolmeya)

```bash
# Este endpoint é chamado automaticamente pelo Kolmeya
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "request_id_kolmeya",
    "status": "delivered",
    "phone": "11999887766",
    "reference": "batch_id:row_id"
  }'
```

---

## 🔗 9. Criar Link Curto para WhatsApp

```bash
curl -X POST 'https://crm.farolbase.com/api/short-link' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "realUrl": "https://wa.me/5511999887766?text=Olá%2C%20tudo%20bem%3F",
    "phone": "5511999887766",
    "message": "Olá, tudo bem?"
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "shortUrl": "crm.farolbase.com/l/aBc12",
  "slug": "aBc12",
  "realUrl": "https://wa.me/5511999887766?text=Olá%2C%20tudo%20bem%3F"
}
```

---

## 🔍 10. Listar Links Curtos do Usuário

```bash
curl -X GET 'https://crm.farolbase.com/api/short-link' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI'
```

**Resposta:**
```json
{
  "ok": true,
  "links": [
    {
      "id": "uuid",
      "slug": "aBc12",
      "real_url": "https://wa.me/5511999887766?text=...",
      "phone": "5511999887766",
      "message": "Olá, tudo bem?",
      "clicks": 15,
      "created_at": "2025-11-10T10:00:00Z",
      "shortUrl": "crm.farolbase.com/l/aBc12"
    }
  ]
}
```

---

## 📝 Exemplo Completo: Fluxo de Envio

```bash
# 1. Login e obter token
TOKEN=$(curl -s -X POST 'https://your-supabase-url.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"senha"}' \
  | jq -r '.access_token')

# 2. Consultar saldo
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/balance' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json'

# 3. Importar campanha
BATCH_ID=$(curl -s -X POST 'https://crm.farolbase.com/api/disparo-sms/import' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "message_template": "Olá {{nome}}!",
    "rows": [
      {"phone": "11999887766", "nome": "João"}
    ]
  }' | jq -r '.batch_id')

# 4. Enviar SMS
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/send' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"batch_id\": \"$BATCH_ID\"}"

# 5. Consultar relatório
curl -X POST 'https://crm.farolbase.com/api/disparo-sms/reports/detailed' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"batch_id\": \"$BATCH_ID\"}"
```

---

## ⚠️ Códigos de Erro

| Código | Significado |
|--------|-------------|
| 401 | Token inválido ou ausente |
| 402 | Saldo insuficiente |
| 400 | Payload inválido |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

**Última atualização**: 11 de novembro de 2025
