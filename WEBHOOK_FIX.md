# Solução: Créditos não Adicionados Após Pagamento PIX

## Problema Identificado

O pagamento PIX foi aprovado com sucesso (ID: 133189349850, R$ 0,50), mas os créditos **NÃO** foram adicionados automaticamente à conta.

### Diagnóstico

✅ **Funcionando:**
- Geração de pagamento PIX
- Aprovação do pagamento no Mercado Pago
- External reference correto: `credits_{userId}_{timestamp}`
- Sistema de créditos funcionando (testado manualmente)

❌ **Não Funcionando:**
- Webhook não está sendo chamado pelo Mercado Pago **OU**
- Webhook está falhando silenciosamente

## Solução Aplicada

### 1. Correção Imediata (Manual)

✅ **Créditos adicionados manualmente** via script:
- Valor: R$ 0,50 (50 cents)
- Novo saldo: R$ 54,04
- Script: `add-credits-direct.js`

### 2. Melhorias no Webhook

✅ **Logs aprimorados:**
- Log detalhado em cada etapa do processamento
- Identificação clara de créditos vs produtos
- Confirmação visual quando créditos são adicionados
- Erros logados com stack trace

✅ **Deduplicação melhorada:**
- Agora loga warning mas continua processando
- Permite reprocessamento para debug

✅ **Extração correta de userId:**
- Suporta UUIDs com hífens
- `userId = parts.slice(1, -1).join('_')`

## Como Funciona o Fluxo Completo

### Fluxo Normal (Automático)

```
1. Usuário clica "Adicionar Créditos"
   └─> Abre dialog, digita valor (ex: R$ 10,00)

2. Frontend chama POST /api/payments/add-credits
   └─> Gera pagamento no Mercado Pago
   └─> Retorna QR Code PIX
   └─> External reference: "credits_{userId}_{timestamp}"
   └─> Notification URL: https://crm.farolbase.com/api/mercadopago/webhook

3. Usuário paga o PIX
   └─> Mercado Pago aprova pagamento

4. Mercado Pago chama webhook ⚠️ AQUI ESTÁ O PROBLEMA
   └─> POST https://crm.farolbase.com/api/mercadopago/webhook
   └─> Body: { type: 'payment', data: { id: '133189349850' } }

5. Webhook processa
   └─> Busca detalhes do pagamento no MP
   └─> Identifica como créditos (external_reference starts with "credits_")
   └─> Extrai userId
   └─> Adiciona créditos via credits.addCents()
   └─> ✅ Usuário vê saldo atualizado
```

### Por Que Não Funcionou?

**Hipótese 1: Webhook não configurado no Mercado Pago**
- Notification URL pode não estar configurada no painel
- MP pode não estar enviando notificações

**Hipótese 2: URL não acessível**
- `https://crm.farolbase.com/api/mercadopago/webhook` pode estar bloqueada
- Firewall/CORS impedindo acesso
- Certificado SSL inválido

**Hipótese 3: Deduplicação bloqueou**
- Redis em modo memory perdeu estado
- `setNX` retornou false incorretamente
- **RESOLVIDO**: Agora loga mas continua

## Configuração do Webhook no Mercado Pago

### Passo 1: Acessar Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers
2. Entre com a conta: junior.karaseks@gmail.com
3. Vá em **Suas integrações** > **Notificações IPN**

### Passo 2: Configurar Notification URL

**URL do Webhook:**
```
https://crm.farolbase.com/api/mercadopago/webhook
```

**Eventos para notificar:**
- ✅ Payments (Pagamentos)
- ✅ Merchant Orders (Pedidos)

**Testar Webhook:**
```bash
# O Mercado Pago deve fazer isso automaticamente, mas você pode testar:
curl -X POST https://crm.farolbase.com/api/mercadopago/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"133189349850"}}'
```

### Passo 3: Verificar Logs

Após configurar, faça um novo pagamento de teste e verifique os logs:

**Logs esperados quando FUNCIONA:**
```
[MP Webhook] ========== WEBHOOK RECEIVED ==========
[MP Webhook] Received { type: 'payment', id: '133189349850' }
[MP Webhook] ✅ First time processing this payment
[MP Webhook] Payment detail { externalReference: 'credits_...', status: 'approved' }
[MP Webhook] 🎯 Detected CREDITS payment
[MP Webhook] ✅ Payment APPROVED - processing credits...
[MP Webhook] Extracted userId { userId: '63e09cd6-5870-...' }
[MP Webhook] Fetching user data...
[MP Webhook] ✅ User found { userId: '...', email: 'junior.karaseks@gmail.com' }
[MP Webhook] Payment amount { amount: 0.5, amountCents: 50 }
[MP Webhook] 💰 Adding credits... { userId: '...', cents: 50 }
[MP Webhook] ✅✅✅ CREDITS SUCCESSFULLY ADDED! { addedBRL: 'R$ 0.50', newBalanceBRL: 'R$ 54.54' }
```

## Testes

### Teste 1: Webhook Local (Servidor Dev Rodando)

```bash
# Terminal 1: Rodar servidor
npm run dev

# Terminal 2: Testar webhook
node test-webhook.js
```

### Teste 2: Adicionar Créditos Manualmente

```bash
# Para emergências, você pode adicionar créditos manualmente:
node add-credits-direct.js
```

### Teste 3: Novo Pagamento PIX

1. Faça login no sistema
2. Clique em "Adicionar Créditos"
3. Digite R$ 0,01 (valor mínimo)
4. Gere QR Code
5. Pague o PIX
6. **Aguarde até 30 segundos**
7. Verifique se saldo foi atualizado automaticamente
8. Se não atualizar, verifique logs do webhook

## Arquivos Modificados

### `app/api/mercadopago/webhook/route.js`
- ✅ Logs aprimorados em cada etapa
- ✅ Deduplicação não bloqueia mais (apenas warning)
- ✅ Extração correta de userId com UUIDs
- ✅ Logs de sucesso/erro mais claros

### Scripts Criados

- ✅ `add-credits-direct.js` - Adiciona créditos manualmente
- ✅ `test-webhook.js` - Testa webhook localmente
- ✅ `process-payment-manually.js` - Processa pagamento específico

## Próximos Passos

1. **[URGENTE]** Configurar Notification URL no painel do Mercado Pago
2. **[URGENTE]** Verificar se URL `https://crm.farolbase.com/api/mercadopago/webhook` está acessível
3. Fazer novo pagamento de teste (R$ 0,01)
4. Verificar logs do webhook
5. Se funcionar, documentar processo
6. Se não funcionar, compartilhar logs para análise

## Suporte

Em caso de problemas, compartilhe:
- Logs do servidor (console do npm run dev)
- Screenshot do painel do MP (seção de notificações)
- ID do pagamento que não funcionou
- Horário aproximado da tentativa

---

**Atualizado em:** 09/11/2025  
**Status:** ⚠️ Aguardando configuração no Mercado Pago
