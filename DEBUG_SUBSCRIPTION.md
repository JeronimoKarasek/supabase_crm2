# Debug: Erro Assinatura Mercado Pago

## Problema
Erro "Falha Mercado Pago" ao tentar criar assinatura mensal.

## Passos para Debug

### 1. Verificar logs do servidor
Com `npm run dev` rodando, verifique o console para ver os logs:
- `[MP Subscription] User authenticated`
- `[MP Subscription] Product found`
- `[MP Subscription] Creating preapproval`
- `[MP Subscription] Response status`

### 2. Testar API do Mercado Pago diretamente
Execute:
```powershell
node scripts/test-mp-preapproval.js
```

Isso vai mostrar se o token está funcionando e qual erro específico o MP está retornando.

### 3. Verificar produto no banco
Certifique-se que o produto tem:
- `billing_mode = 'subscription'`
- `payment_method = 'card'`

Execute no Supabase SQL Editor:
```sql
SELECT key, name, billing_mode, payment_method 
FROM products 
WHERE key = 'SEU_PRODUTO_KEY';
```

### 4. Verificar token do Mercado Pago
```sql
SELECT data->'payments'->>'mercadopagoAccessToken' 
FROM global_settings 
WHERE id = 'global';
```

### 5. Logs do navegador
Abra o Developer Tools (F12) e veja:
- Console logs: `[Purchase]` messages
- Network tab: response da chamada `/api/mercadopago/subscription`

## Possíveis Causas

### 1. Token inválido ou expirado
**Solução**: Regerar token no Mercado Pago e atualizar em global_settings

### 2. Produto não configurado corretamente
**Solução**: 
- Execute `scripts/sql/add_products_billing_mode_and_card.sql`
- Edite o produto e selecione:
  - Método de Pagamento: **Cartão (Mercado Pago)**
  - Modo de Cobrança: **Assinatura Mensal**

### 3. API de Preapproval não disponível na conta
**Nota**: A API de preapproval/subscriptions requer aprovação do Mercado Pago.
Algumas contas não têm acesso automático.

**Alternativa**: Usar API de pagamentos recorrentes com card tokenization.

### 4. Campos obrigatórios faltando
Preapproval requer:
- `reason` (nome da assinatura)
- `payer_email` (email válido)
- `auto_recurring.transaction_amount` (> 0)
- `auto_recurring.frequency` (1)
- `auto_recurring.frequency_type` ('months')

### 5. Endpoint incorreto
Verificar se endpoint está correto:
- Produção: `https://api.mercadopago.com/preapproval`
- Sandbox: `https://api.mercadopago.com/preapproval` (mesmo)

## Exemplo de resposta de erro comum

```json
{
  "message": "invalid parameter",
  "error": "bad_request",
  "status": 400,
  "cause": [
    {
      "code": "invalid_parameter",
      "description": "The parameter 'auto_recurring.transaction_amount' is invalid",
      "data": null
    }
  ]
}
```

## Se o problema persistir

1. Verifique se a conta Mercado Pago tem permissão para subscriptions
2. Considere usar fluxo alternativo:
   - Pagamento único via cartão (sem subscription)
   - Cobrança manual mensal via créditos
   - Usar Stripe ou outra plataforma para subscriptions

## Contato Suporte Mercado Pago
https://www.mercadopago.com.br/developers/pt/support
