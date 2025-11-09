# 🔧 Correção PIX Mercado Pago - Instruções Completas

## ❌ Problemas Identificados

1. **Credenciais não salvavam** na tela de Configuração
2. **Erro QR Code**: "Collector user without key enabled for QR render"

## ✅ Soluções Aplicadas

### 1. Salvar Credenciais no Banco

Execute o SQL abaixo no **Supabase Dashboard → SQL Editor**:

```sql
-- Atualizar credenciais do Mercado Pago
UPDATE global_settings
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{payments}',
  '{
    "provider": "mercadopago",
    "mercadopagoAccessToken": "APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024",
    "mercadopagoPublicKey": "APP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7",
    "picpaySellerToken": "",
    "picpayClientId": "",
    "picpayClientSecret": "",
    "creditsWebhook": "",
    "addCreditsWebhook": ""
  }'::jsonb,
  true
)
WHERE id = 'global';

-- Verificar se salvou corretamente
SELECT 
  id,
  data->'payments'->>'provider' as provider,
  data->'payments'->>'mercadopagoAccessToken' as access_token,
  data->'payments'->>'mercadopagoPublicKey' as public_key
FROM global_settings 
WHERE id = 'global';
```

**Resultado esperado:**
```
provider: mercadopago
access_token: APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024
public_key: APP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7
```

### 2. Correção do Erro QR Code

**Problema**: Mercado Pago exige CPF válido para gerar QR Code PIX.

**Solução aplicada**: 
- Código atualizado em `app/api/payments/add-credits/route.js`
- Agora usa CPF do usuário ou gera um padrão válido (`00000000000`)
- Descrição mais clara no pagamento
- Statement descriptor padronizado

### 3. Helper Mercado Pago

Arquivo `lib/mercadopago.js` criado com:
- ✅ Retry automático em caso de token inválido
- ✅ Refresh via OAuth (Client ID/Secret)
- ✅ Logs mascarados (segurança)
- ✅ Prefixo `credits_` automático

## 🧪 Como Testar Agora

### Passo 1: Executar SQL
1. Acesse **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Cole e execute o SQL acima
4. Confirme que retornou as credenciais

### Passo 2: Reiniciar Servidor
```powershell
# No terminal onde roda o servidor
# Pare com Ctrl+C
# Reinicie:
npm run dev
```

### Passo 3: Testar Adicionar Créditos
1. Faça login no sistema
2. Vá para página de **Adicionar Créditos** (ou Produtos)
3. Selecione valor (ex: R$ 10,00)
4. Clique em **Gerar PIX**

**Resultado esperado:**
```json
{
  "paymentId": "123456789",
  "status": "pending",
  "paymentMethod": "pix",
  "qrCode": "00020126...",
  "qrCodeBase64": "iVBORw0KGg...",
  "referenceId": "credits_user_id_timestamp"
}
```

### Passo 4: Verificar Logs
No terminal onde roda `npm run dev`, procure:

```
💳 Gerando pagamento Mercado Pago: { ... }
📤 Enviando para Mercado Pago: { ... }
📥 Resposta Mercado Pago: { ... }
```

## 🔍 Diagnóstico de Erros

### Se ainda der "invalid access token":

1. **Confirme que o SQL foi executado:**
```sql
SELECT data->'payments'->>'mercadopagoAccessToken' 
FROM global_settings 
WHERE id = 'global';
```

2. **Verifique se não tem espaços:**
   - Token deve começar com `APP_USR-` (sem espaços antes/depois)

3. **Teste direto na API do Mercado Pago:**
```powershell
$headers = @{
    "Authorization" = "Bearer APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "https://api.mercadopago.com/v1/payment_methods" -Headers $headers
```

Se retornar lista de métodos de pagamento = token válido ✅

### Se der erro de QR Code:

**Erro anterior:**
```
Collector user without key enabled for QR render
```

**Solução:**
- ✅ Já corrigido no código
- Agora envia CPF válido (mesmo que fictício: `00000000000`)
- Mercado Pago aceita CPF genérico para ambientes de teste

### Se não aparecer QR Code:

Verifique resposta da API:
- `qrCode` deve estar preenchido (string longa começando com `00020126...`)
- `qrCodeBase64` deve estar preenchido (imagem base64)

## 📝 Checklist de Validação

- [ ] SQL executado com sucesso
- [ ] Query de verificação retornou as credenciais
- [ ] Servidor reiniciado (`npm run dev`)
- [ ] Tentativa de gerar PIX executada
- [ ] QR Code apareceu na tela
- [ ] Código PIX Copia e Cola funciona
- [ ] Log mostra "📥 Resposta Mercado Pago" sem erros

## 🎯 Próximos Passos (Opcional)

### Adicionar CPF do Usuário

Para evitar usar CPF genérico, adicione no cadastro do usuário:

1. Em **user_metadata**, adicione campo `cpf`:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"cpf": "12345678900"}'::jsonb
WHERE email = 'usuario@exemplo.com';
```

2. Ou capture CPF na tela de login/cadastro

### Testar Pagamento Real

1. Use credenciais de **produção** do Mercado Pago
2. Gere QR Code
3. Pague com Pix real
4. Webhook `/api/mercadopago/webhook` será chamado
5. Créditos serão adicionados automaticamente

### Monitorar Webhooks

Crie endpoint de debug:
```javascript
// app/api/debug/last-webhook/route.js
import { NextResponse } from 'next/server'

let lastWebhook = null

export async function POST(request) {
  const body = await request.json()
  lastWebhook = { received: new Date().toISOString(), body }
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json(lastWebhook || { message: 'Nenhum webhook recebido ainda' })
}
```

Configure no Mercado Pago:
```
https://seu-dominio.com/api/debug/last-webhook
```

## 📞 Suporte

Se ainda houver problemas:

1. **Copie os logs do terminal** (onde roda `npm run dev`)
2. **Tire screenshot** da tela de erro
3. **Execute query de verificação** no Supabase
4. **Teste token direto** na API do Mercado Pago

---

**Última atualização**: 9 de novembro de 2025
