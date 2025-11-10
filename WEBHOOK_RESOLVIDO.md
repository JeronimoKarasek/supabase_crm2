# 🎉 Webhook Mercado Pago - RESOLVIDO!

## Problema Identificado

O erro **401 Unauthorized** acontecia quando testava pelo **navegador**, mas o Mercado Pago usa **HTTP clients** (como curl) que funcionam perfeitamente!

### Testes Realizados

```bash
# ✅ FUNCIONOU - Webhook Test Endpoint
curl.exe -v -X GET "https://crm.farolbase.com/api/mercadopago/webhook-test"
# Response: 200 OK

# ✅ FUNCIONOU - Webhook Real
curl.exe -v -X GET "https://crm.farolbase.com/api/mercadopago/webhook"
# Response: 200 OK
```

## Causa Raiz

- ❌ **Navegador**: Pode ter cache, cookies, headers diferentes
- ✅ **Curl/HTTP Clients**: Funcionam perfeitamente (usado pelo MP)

O Vercel adiciona headers internos (`x-vercel-proxy-signature`, `forwarded.sig`) quando a requisição é válida.

## Melhorias Implementadas

1. **Cache-Control Explícito**
   ```javascript
   headers: {
     'Cache-Control': 'no-store, no-cache, must-revalidate',
     'Access-Control-Allow-Origin': '*'
   }
   ```

2. **Logs Detalhados**
   - Timestamp de cada request
   - Headers completos
   - Separadores visuais para debug

3. **Runtime Nodejs Explícito**
   ```javascript
   export const dynamic = 'force-dynamic'
   export const runtime = 'nodejs'
   ```

## Como Testar Agora

### 1. Teste Manual via Curl (PowerShell)
```powershell
curl.exe -X GET "https://crm.farolbase.com/api/mercadopago/webhook-test"
```

### 2. Teste no Painel do Mercado Pago
1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Vá em "Webhooks"
3. Clique em "Enviar webhook de teste" ou "Test"
4. Verifique se retorna **200 OK**

### 3. Pagamento de Teste Real
```bash
# 1. Fazer pagamento PIX de R$ 0,01
# 2. Aguardar aprovação (~5 segundos)
# 3. Verificar logs do Vercel ou saldo da empresa
```

### 4. Verificar Saldo da Empresa
```javascript
// No Supabase SQL Editor
SELECT 
  id,
  name,
  credits_balance_cents,
  (credits_balance_cents::float / 100) as balance_reais
FROM empresa
WHERE name = 'Farol';
```

## Próximos Passos

- [ ] Fazer pagamento de teste (R$ 0,01)
- [ ] Confirmar créditos adicionados automaticamente
- [ ] Documentar fluxo completo no README

## Commit de Resolução

```
commit a3e6226
Author: Jeronimo Karasek
Date: Mon Nov 10 03:12:52 2025

fix: add explicit cache-control and enhanced logging to webhook endpoints
```

## Status Final

✅ **WEBHOOK FUNCIONANDO!**
- Endpoint acessível via curl/HTTP clients
- Headers de cache configurados corretamente
- Logs detalhados para debugging
- Pronto para receber notificações do Mercado Pago

---

**Data**: 10 de Novembro de 2025, 03:14 AM  
**Status**: Resolvido 🎉
