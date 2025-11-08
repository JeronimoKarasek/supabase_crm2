# Webhooks - Configuração do Sistema

Este documento lista todos os webhooks disponíveis no CRM para integração externa.

## 📡 Webhooks Disponíveis

### 1. **Disparo SMS - Kolmeya**

#### Webhook de Status/Callback
```
https://SEU_DOMINIO/api/disparo-sms/webhook
```

**Descrição**: Recebe callbacks da Kolmeya sobre status de entregas de SMS (entregue, falha, etc.)

**Método**: POST

**Configuração**: 
- Acesse `Configuração → Credenciais → Credencial SMS (Kolmeya)`
- Preencha o campo "Webhook URL (opcional)" com a URL acima

**Payload esperado** (da Kolmeya):
```json
{
  "id": "request_id",
  "phone": "5511999999999",
  "status": "delivered|failed|...",
  "error": "mensagem de erro se houver"
}
```

---

### 2. **Créditos - Consulta de Saldo**

#### Webhook para Consulta Externa de Créditos
```
https://SEU_DOMINIO/api/credits
```

**Descrição**: Permite consultar o saldo de créditos de um usuário externamente

**Método**: GET

**Headers obrigatórios**:
```
x-api-key: SEU_INTERNAL_API_KEY (configurar em .env)
```

**Query Parameters**:
- `userId`: UUID do usuário

**Exemplo de request**:
```bash
curl -X GET "https://SEU_DOMINIO/api/credits?userId=USER_UUID_AQUI" \
  -H "x-api-key: SUA_CHAVE_INTERNA"
```

**Response**:
```json
{
  "userId": "uuid-do-usuario",
  "balanceCents": 10000,
  "balanceBRL": "R$ 100,00"
}
```

**Configuração**:
- Em `Configuração → Credenciais → Pagamentos`, preencha:
  - **Webhook Consulta de Créditos**: URL do sistema externo que irá consultar
- Defina `INTERNAL_API_KEY` no arquivo `.env.local`

---

### 3. **Créditos - Adicionar Saldo**

#### Webhook para Adicionar Créditos Externamente
```
https://SEU_DOMINIO/api/credits/add
```

**Descrição**: Permite adicionar créditos a um usuário após confirmação de pagamento externo (ex: PicPay, Mercado Pago)

**Método**: POST

**Headers obrigatórios**:
```
x-api-key: SEU_INTERNAL_API_KEY
Content-Type: application/json
```

**Body**:
```json
{
  "userId": "uuid-do-usuario",
  "amount": "50.00",
  "referenceId": "payment_id_externo"
}
```

**Exemplo de request**:
```bash
curl -X POST "https://SEU_DOMINIO/api/credits/add" \
  -H "x-api-key: SUA_CHAVE_INTERNA" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-do-usuario",
    "amount": "50.00",
    "referenceId": "PIX_123456"
  }'
```

**Response**:
```json
{
  "ok": true,
  "userId": "uuid-do-usuario",
  "balanceCents": 15000,
  "balanceBRL": "R$ 150,00"
}
```

**Configuração**:
- Em `Configuração → Credenciais → Pagamentos`, preencha:
  - **Webhook Adicionar Créditos**: URL que receberá notificações quando créditos forem adicionados

---

### 4. **Créditos - Cobrar/Debitar**

#### Webhook para Debitar Créditos
```
https://SEU_DOMINIO/api/credits/charge
```

**Descrição**: Permite debitar créditos de um usuário (usado internamente pelo SMS, mas pode ser usado por sistemas externos)

**Método**: POST

**Headers obrigatórios**:
```
x-api-key: SEU_INTERNAL_API_KEY
Content-Type: application/json
```

**Body**:
```json
{
  "userId": "uuid-do-usuario",
  "amount": "10.00"
}
```

**Response de sucesso**:
```json
{
  "ok": true,
  "userId": "uuid-do-usuario",
  "balanceCents": 5000,
  "balanceBRL": "R$ 50,00"
}
```

**Response de saldo insuficiente** (HTTP 402):
```json
{
  "error": "Saldo insuficiente",
  "balanceCents": 500,
  "balanceBRL": "R$ 5,00"
}
```

---

### 5. **Bancos - Consulta em Lote**

#### Webhook de Retorno de Lote
```
https://SEU_DOMINIO/api/consulta-lote/webhook
```

**Descrição**: Recebe callbacks dos bancos com resultados de consultas em lote

**Método**: POST

**Configuração**:
- Em `Configuração → Bancos → Configurar Bancos`
- Para cada banco, preencha:
  - **Webhook (consulta em lote)**: URL do banco que enviará os resultados

**Payload esperado** (exemplo):
```json
{
  "batch_id": "uuid-do-lote",
  "results": [
    {
      "cpf": "12345678900",
      "status": "approved|rejected",
      "value": "1000.00",
      "details": {}
    }
  ]
}
```

---

### 6. **Bancos - Simulador**

#### Webhook do Simulador por Produto
```
https://SEU_DOMINIO/api/simular/webhook
```

**Descrição**: Webhook para receber resultados de simulações de produtos bancários

**Método**: POST

**Configuração**:
- Em `Configuração → Bancos → Configurar Bancos`
- Em "Produtos deste banco", preencha:
  - **Webhook simulador (produto)**: URL específica por produto/banco

---

### 7. **Bancos - Digitação**

#### Webhook de Digitação
```
https://SEU_DOMINIO/api/digitar/webhook
```

**Descrição**: Webhook para receber confirmação de digitação de propostas

**Método**: POST

**Configuração**:
- Em `Configuração → Bancos → Configurar Bancos`
- Em "Produtos deste banco", preencha:
  - **Webhook digitar (produto)**: URL específica por produto/banco

---

### 8. **WhatsApp - Disparo API**

#### Webhook de Status de Mensagens
```
https://SEU_DOMINIO/api/disparo-api/webhook
```

**Descrição**: Recebe callbacks do Meta/WhatsApp sobre status de envio de templates

**Método**: POST

**Configuração**:
- Configure no painel do Meta Business (Facebook Developers)
- Seção "Webhooks" do app WhatsApp Business

**Eventos para subscrever**:
- `messages`
- `message_template_status_update`

---

### 9. **Importação de CSV**

#### Webhook de Status de Importação
```
https://SEU_DOMINIO/api/importar/webhook
```

**Descrição**: Recebe notificações sobre progresso/conclusão de importações em background

**Método**: POST

---

### 10. **PicPay - Pagamentos**

#### Webhook de Callback de Pagamento
```
https://SEU_DOMINIO/api/picpay/callback
```

**Descrição**: Recebe notificações do PicPay sobre mudanças de status de pagamentos

**Método**: POST

**Configuração**:
- Configure no painel do PicPay
- Use esta URL como "Callback URL"

**Payload esperado** (do PicPay):
```json
{
  "referenceId": "order_123",
  "status": "paid|refunded|expired|...",
  "authorizationId": "picpay_auth_id"
}
```

---

## 🔐 Segurança

### Variáveis de Ambiente (.env.local)

Para proteger os webhooks que permitem operações sensíveis, configure:

```env
# Chave para autenticar chamadas externas aos webhooks de créditos
INTERNAL_API_KEY=sua_chave_secreta_aqui_gerada_aleatoriamente

# Supabase (já configurado)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# PicPay (se usar)
PICPAY_SELLER_TOKEN=...
PICPAY_CLIENT_ID=...
PICPAY_CLIENT_SECRET=...

# Mercado Pago (se usar)
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_PUBLIC_KEY=...
```

### Gerando INTERNAL_API_KEY

Use um gerador de UUID ou string aleatória:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ou online
https://www.uuidgenerator.net/
```

---

## 📋 Checklist de Configuração

### SMS (Kolmeya)

- [ ] Token da API Kolmeya configurado em `Configuração → Credenciais → SMS`
- [ ] Webhook URL configurado (se usar callbacks de status)
- [ ] Valor por mensagem SMS definido (para cobrança automática)
- [ ] Testar saldo consultando em `Disparo SMS`

### Créditos

- [ ] `INTERNAL_API_KEY` definida no `.env.local`
- [ ] Webhook de consulta configurado (se integrar com sistema externo)
- [ ] Webhook de adição configurado (para notificações de novos créditos)
- [ ] E-mails de administradores cadastrados em `Configuração → Geral → Administradores`

### Pagamentos

- [ ] Provedor escolhido (PicPay ou Mercado Pago)
- [ ] Credenciais do provedor preenchidas em `Configuração → Credenciais → Pagamentos`
- [ ] Webhook callback configurado no painel do provedor
- [ ] Testar fluxo de pagamento em ambiente de sandbox

### Bancos

- [ ] Bancos cadastrados com campos de credenciais
- [ ] Produtos vinculados aos bancos
- [ ] Webhooks de lote/simulador/digitar configurados por banco/produto
- [ ] Testar integração com pelo menos um banco

### WhatsApp

- [ ] App do WhatsApp Business criado no Meta for Developers
- [ ] Token de acesso configurado
- [ ] Webhook configurado no painel Meta
- [ ] Templates aprovados e testados

---

## 🧪 Testando Webhooks Localmente

Para testar webhooks em desenvolvimento local, use ferramentas como:

### ngrok
```bash
ngrok http 3000
```

Copie a URL HTTPS gerada (ex: `https://abc123.ngrok.io`) e use como base para os webhooks:
- `https://abc123.ngrok.io/api/credits`
- `https://abc123.ngrok.io/api/disparo-sms/webhook`
- etc.

### localtunnel
```bash
npx localtunnel --port 3000
```

---

## 📞 Suporte

Em caso de dúvidas sobre webhooks:

1. Verifique os logs do servidor (terminal onde roda `npm run dev`)
2. Teste com ferramentas como Postman ou cURL
3. Valide o formato do payload conforme documentação de cada provedor
4. Confirme que headers obrigatórios estão sendo enviados

---

**Última atualização**: 7 de novembro de 2025
