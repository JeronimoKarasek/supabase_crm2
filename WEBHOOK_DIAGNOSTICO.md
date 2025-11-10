# Diagnóstico de Webhook Mercado Pago

## Problema: Webhooks não estão sendo chamados

### Verificações a Fazer

#### 1. Testar se o endpoint está acessível publicamente

**URL de teste criada:**
```
GET https://crm.farolbase.com/api/mercadopago/webhook-test
```

Abra essa URL no navegador. Deve retornar:
```json
{
  "ok": true,
  "message": "Webhook endpoint está acessível!",
  "timestamp": "2025-11-09T..."
}
```

Se retornar erro 404 ou timeout:
- ❌ Servidor não está acessível publicamente
- Verificar deploy no Vercel
- Verificar domínio e DNS

#### 2. Verificar configuração no Painel Mercado Pago

Acesse: https://www.mercadopago.com.br/developers/panel

**Passo a passo:**
1. Entre com `junior.karaseks@gmail.com`
2. Vá em **"Suas integrações"** no menu lateral
3. Clique em **"Notificações"** ou **"Webhooks"**
4. Procure por **"URLs de notificação"** ou **"IPN"**

**O que verificar:**
- ✅ URL configurada: `https://crm.farolbase.com/api/mercadopago/webhook`
- ✅ Eventos habilitados: **Payments** (pagamentos)
- ✅ Status: **Ativo**

**Se não estiver configurado:**
1. Clique em **"Adicionar URL"** ou **"Configurar"**
2. Cole a URL: `https://crm.farolbase.com/api/mercadopago/webhook`
3. Marque: ✅ **payment** (ou "Pagamentos")
4. Salve

#### 3. Testar envio manual do Mercado Pago

No painel do MP, após configurar a URL:
1. Procure por **"Testar webhook"** ou **"Enviar notificação de teste"**
2. Envie uma notificação de teste
3. Verifique se chegou (logs do servidor)

#### 4. Verificar logs do servidor

**No Vercel:**
1. Acesse: https://vercel.com/
2. Entre no projeto `supabase_crm2`
3. Vá em **Deployments** → último deploy → **Functions**
4. Procure por logs de `/api/mercadopago/webhook`

**Localmente (npm run dev):**
```powershell
# Os logs aparecem no terminal onde rodou npm run dev
# Procure por:
[MP Webhook] ========== WEBHOOK RECEIVED ==========
```

#### 5. Verificar se notification_url está correta no pagamento

Execute no terminal:
```powershell
node -e "const token='APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024';fetch('https://api.mercadopago.com/v1/payments/133189349850',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(p=>{console.log('Notification URL:',p.notification_url);console.log('Status:',p.status);console.log('Date approved:',p.date_approved);}).catch(e=>console.error(e.message));"
```

Deve mostrar:
```
Notification URL: https://crm.farolbase.com/api/mercadopago/webhook
Status: approved
Date approved: 2025-11-09T...
```

#### 6. Forçar webhook manualmente (curl)

**Teste local (se servidor rodando em localhost:3000):**
```powershell
curl -X POST http://localhost:3000/api/mercadopago/webhook-test `
  -H "Content-Type: application/json" `
  -d '{\"type\":\"payment\",\"data\":{\"id\":\"133189349850\"}}'
```

**Teste produção:**
```powershell
curl -X POST https://crm.farolbase.com/api/mercadopago/webhook-test `
  -H "Content-Type: application/json" `
  -d '{\"type\":\"payment\",\"data\":{\"id\":\"133189349850\"}}'
```

#### 7. Verificar assinatura secreta (opcional)

Você mencionou ter uma assinatura secreta:
```
299e3b1f412f6c866735724a0eb8d3d724f24942262062c26639f06ee1f8fb64
```

O Mercado Pago envia um header `x-signature` ou `x-signature-header` com cada webhook.

**Para validar (adicionar depois se necessário):**
1. Guardar a secret nas env vars
2. Calcular hash HMAC-SHA256 do body
3. Comparar com header recebido

Por enquanto, **não é crítico** - apenas verifica autenticidade, não afeta recebimento.

---

## Checklist de Diagnóstico

- [ ] URL acessível publicamente (teste via navegador)
- [ ] URL configurada no painel Mercado Pago
- [ ] Eventos "Payments" habilitados no painel
- [ ] Webhook ativo (não pausado)
- [ ] notification_url correta no pagamento
- [ ] Logs do servidor (Vercel ou local)
- [ ] Teste manual com curl funciona

---

## Solução Temporária: Reprocessamento Manual

Enquanto o webhook automático não funciona, use:

**Via script Node.js:**
```powershell
node -e "const paymentId='133189349850';fetch('https://crm.farolbase.com/api/mercadopago/reprocess',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer SEU_TOKEN_AQUI'},body:JSON.stringify({paymentId})}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2))).catch(e=>console.error(e.message));"
```

**Via curl:**
```powershell
curl -X POST https://crm.farolbase.com/api/mercadopago/reprocess `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer SEU_TOKEN_AQUI" `
  -d '{\"paymentId\":\"133189349850\"}'
```

---

## Próximos Passos

1. **AGORA**: Abra `https://crm.farolbase.com/api/mercadopago/webhook-test` no navegador
2. **AGORA**: Acesse painel do MP e configure URL de webhook
3. **DEPOIS**: Faça novo pagamento de teste (R$ 0,01)
4. **DEPOIS**: Verifique logs do Vercel
5. **SE FALHAR**: Use reprocess manual com o paymentId

---

**Criado em:** 09/11/2025  
**Endpoint de teste:** `/api/mercadopago/webhook-test`
