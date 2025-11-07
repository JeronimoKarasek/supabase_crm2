# Credenciais Mercado Pago

## 🔐 Dados de Acesso

### Credenciais da Aplicação
- **Public Key**: `PP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7`
- **Access Token**: `APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024`
- **Client ID**: `6832397982878428`
- **Client Secret**: `CVT5FOvFzJViDyzFic5whjgus9Thlkw7`

## 📋 Como Configurar no Sistema

### 1. Via Interface Web (Recomendado)
1. Acesse: `http://localhost:3000/configuracao`
2. Role até a seção **"Pagamentos"**
3. No dropdown **"Provedor de Pagamento"**, selecione: **Mercado Pago**
4. Preencha os campos:
   - **Access Token**: `APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024`
   - **Public Key**: `PP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7`
5. Clique em **"Salvar pagamentos"**

### 2. Via Variáveis de Ambiente (Opcional)
Adicione ao arquivo `.env.local`:

```bash
# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024
MERCADOPAGO_PUBLIC_KEY=PP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7
```

## 🔔 Webhook Configurado

O webhook do Mercado Pago já foi configurado para:
- **URL**: `https://seu-dominio.com/api/mercadopago/webhook`
- **Eventos**: Pagamentos
- **Status**: ✅ Ativo

## 💳 Método de Pagamento

**PIX À VISTA** (sem crédito)
- ✅ Pagamento via QR Code Pix
- ✅ Aprovação instantânea
- ❌ NÃO aceita cartão de crédito
- ✅ Aceita débito (se configurado)

## 🧪 Testando a Integração

### Teste de Adição de Créditos
1. Faça login no sistema
2. Clique no botão **"Add créditos"** (azul) no topo da página
3. Digite um valor (ex: 10.00)
4. Clique em **"Concluir"**
5. Um **QR Code Pix** será exibido na tela
6. Escaneie o QR Code ou copie o código Pix
7. Faça o pagamento no seu app bancário
8. Aguarde alguns segundos - o webhook receberá a confirmação automaticamente
9. Os créditos serão adicionados via webhook configurado

### Verificar Logs
- Backend: Console do terminal onde `npm run dev` está rodando
- Webhook: Painel do Mercado Pago > Desenvolvedores > Webhooks

## 📊 Fluxo Completo

```
1. Usuário solicita créditos
   ↓
2. Sistema cria pagamento Pix via API do Mercado Pago
   ↓
3. QR Code Pix é exibido na tela
   ↓
4. Usuário paga via app bancário
   ↓
5. Mercado Pago envia webhook
   ↓
6. Sistema consulta API do MP para confirmar status
   ↓
7. Webhook do cliente é acionado com dados do usuário
   ↓
8. Créditos são adicionados automaticamente
```

## ⚠️ Importante

- **Não compartilhe essas credenciais publicamente**
- As credenciais acima são de **produção** (APP_USR)
- Para testes, use credenciais de sandbox
- O webhook deve ser acessível publicamente (use ngrok localmente)

## 🔗 Links Úteis

- **Painel de Desenvolvedores**: https://www.mercadopago.com.br/developers/panel/app
- **Documentação Checkout API**: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
- **Testar Webhooks**: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/webhooks

## 🛠️ Endpoints do Sistema

- **Criar Pagamento**: `POST /api/mercadopago/checkout`
- **Receber Webhook**: `POST /api/mercadopago/webhook`
- **Adicionar Créditos**: `POST /api/payments/add-credits`

---

**Data de Configuração**: 6 de novembro de 2025
**Status**: ✅ Webhook configurado e pronto para uso
