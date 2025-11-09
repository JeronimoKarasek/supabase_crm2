# Sistema de Digitação Bancária com Webhook Assíncrono

## Visão Geral

Sistema que permite enviar dados bancários para digitação, aguardar o retorno do webhook com link de formalização e exibir em popup com botão de copiar.

## Arquitetura

### 1. Fluxo Completo

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Frontend   │─────▶│  API Digitar │─────▶│ Webhook Externo │─────▶│ Banco/Sistema│
│  (Usuario)  │      │  (Tracking)  │      │  (Processamento)│      │              │
└─────────────┘      └──────────────┘      └─────────────────┘      └──────────────┘
       │                     │                        │
       │                     │                        │
       ▼                     ▼                        ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Polling   │◀─────│  DB Tracking │◀─────│ Webhook Callback│
│  (3s loop)  │      │   (Status)   │      │  (Update Link)  │
└─────────────┘      └──────────────┘      └─────────────────┘
       │
       ▼
┌─────────────┐
│ Popup Link  │
│  + Copiar   │
└─────────────┘
```

### 2. Componentes

#### Database: `digitacao_requests`
Tabela para tracking de solicitações:

```sql
CREATE TABLE digitacao_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_key TEXT NOT NULL,
  cpf TEXT NOT NULL,
  product TEXT,
  status TEXT DEFAULT 'pending', -- pending | completed | error | timeout
  payload JSONB,
  webhook_response JSONB,
  formalizacao_link TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

#### API Endpoints

**1. POST `/api/digitar`** (Envia digitação)
- Cria registro tracking com status `pending`
- Chama webhook externo com `callbackUrl`
- Retorna `trackingId` para polling
- Se webhook retornar link imediatamente, atualiza status

**2. POST `/api/digitar/webhook/[trackingId]`** (Callback do webhook)
- Webhook externo chama este endpoint após processar
- Atualiza registro com link de formalização
- Extrai link de várias propriedades comuns (link, url, proposta_url, etc)
- Marca status como `completed` ou `error`

**3. GET `/api/digitar/webhook/[trackingId]`** (Consulta status)
- Usado pelo polling do frontend
- Retorna status atual e link (se disponível)

#### Frontend (`app/simular-digitar/page.js`)

**Estados:**
```javascript
const [pollingTrackingId, setPollingTrackingId] = useState(null)
const [linkPopupOpen, setLinkPopupOpen] = useState(false)
const [linkData, setLinkData] = useState(null)
```

**Função `doDigitar()`:**
1. Envia dados para `/api/digitar`
2. Recebe `trackingId`
3. Se retornar link imediatamente → mostra popup
4. Se não → inicia polling

**Função `startPolling()`:**
- Consulta `/api/digitar/webhook/[trackingId]` a cada 3 segundos
- Máximo 40 tentativas (2 minutos)
- Quando status = `completed` → mostra popup com link
- Quando status = `error` → mostra mensagem de erro
- Timeout → mensagem após 2 minutos

**Popup de Link:**
- Título: "🎉 Link de Formalização Disponível"
- Exibe mensagem do webhook
- Mostra URL em campo copiável
- Botões: "Copiar" + "Abrir em nova aba"

**Indicador de Loading:**
- Toast fixo no canto inferior direito
- Spinner animado
- Texto: "Aguardando retorno do webhook..."

## Como Usar

### 1. Setup Database
Execute no Supabase SQL Editor:
```sql
-- Arquivo: scripts/sql/digitacao_requests.sql
CREATE TABLE IF NOT EXISTS digitacao_requests ...
```

### 2. Configurar Webhook Externo

O webhook externo deve:

**A. Receber payload:**
```json
{
  "cpf": "12345678901",
  "email": "user@example.com",
  "credentials": { ... },
  "data": { "valor": 1000, "prazo": 12 },
  "product": "consignado",
  "userId": "uuid",
  "trackingId": "uuid-tracking",
  "callbackUrl": "https://crm.farolbase.com/api/digitar/webhook/uuid-tracking"
}
```

**B. Processar digitação** (pode ser assíncrono)

**C. Chamar callback quando concluído:**
```bash
POST https://crm.farolbase.com/api/digitar/webhook/[trackingId]
Content-Type: application/json

{
  "link": "https://banco.com.br/proposta/123456",
  "mensagem": "Proposta criada com sucesso",
  "numero_proposta": "123456"
}
```

### 3. Usar no Frontend

1. Usuário preenche formulário de digitação
2. Clica em "Enviar"
3. Sistema mostra indicador de loading
4. Após webhook retornar (ou timeout), exibe popup com link
5. Usuário pode copiar link ou abrir em nova aba

## Propriedades de Link Suportadas

O sistema busca link em várias propriedades comuns:

```javascript
const link = body.link || 
             body.url || 
             body.proposta_url || 
             body.propostaLink || 
             body.proposta || 
             body.pdf || 
             body.contrato || 
             body.formalizacao_link || 
             body.formalizacaoLink
```

Se nenhuma dessas existir, busca recursivamente primeira URL que começa com `http`.

## Timeouts & Limites

- **Polling intervalo**: 3 segundos
- **Polling máximo**: 40 tentativas (2 minutos)
- **Webhook timeout**: O webhook externo deve retornar em até 2 minutos
- **Auto-cleanup**: Recomenda-se criar job para deletar registros antigos (> 30 dias)

## Segurança

### RLS (Row Level Security)
```sql
-- Usuários só veem seus próprios requests
CREATE POLICY "Users can view their own digitacao requests"
  ON digitacao_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Service role pode atualizar (webhook)
CREATE POLICY "Service role can update digitacao requests"
  ON digitacao_requests FOR UPDATE
  USING (true);
```

### Validação
- `trackingId` é UUID aleatório (não previsível)
- Apenas service role pode atualizar registros
- Frontend só consulta, não altera

## Exemplo de Resposta do Webhook

### Sucesso (com link imediato):
```json
{
  "ok": true,
  "response": {
    "link": "https://banco.com.br/proposta/123456",
    "mensagem": "Proposta criada",
    "numero_proposta": "123456"
  },
  "trackingId": "abc-123-def"
}
```

### Sucesso (processamento assíncrono):
```json
{
  "ok": true,
  "response": {
    "mensagem": "Processando digitação...",
    "status": "processing"
  },
  "trackingId": "abc-123-def"
}
```

Depois webhook chama callback:
```bash
POST /api/digitar/webhook/abc-123-def
{
  "link": "https://banco.com.br/proposta/123456",
  "mensagem": "Digitação concluída com sucesso"
}
```

### Erro:
```json
{
  "error": "CPF não encontrado na base do banco",
  "status": "error"
}
```

## Monitoramento

### Consultar status manualmente:
```bash
GET /api/digitar/webhook/[trackingId]
```

Retorna:
```json
{
  "id": "uuid",
  "status": "completed",
  "formalizacao_link": "https://...",
  "error_message": null,
  "created_at": "2025-11-09T...",
  "completed_at": "2025-11-09T..."
}
```

### Logs importantes:
```javascript
// API Digitar
console.log('📝 Tracking ID criado:', trackingId)

// Webhook Callback
console.log('✅ Tracking atualizado:', {
  trackingId,
  status,
  hasLink: !!extractedLink
})
```

## Melhorias Futuras

1. **Notificações Push**: WebSocket para atualização em tempo real (sem polling)
2. **Retry automático**: Se webhook falhar, retry com backoff exponencial
3. **Analytics**: Dashboard de tempo médio de resposta por banco
4. **Queue system**: Fila Redis para processar múltiplas digitações em paralelo
5. **Webhook signature**: HMAC para validar origem do webhook

## Troubleshooting

### Problema: Polling não termina
- **Causa**: Webhook externo não está chamando callback
- **Solução**: Verificar logs do webhook, garantir que `callbackUrl` está acessível

### Problema: Link não aparece no popup
- **Causa**: Propriedade do link não é reconhecida
- **Solução**: Adicionar nova propriedade em `findFirstUrl()` ou `link` extraction

### Problema: "Tracking não encontrado" no webhook
- **Causa**: Tabela não foi criada ou RLS bloqueando
- **Solução**: Executar script SQL `digitacao_requests.sql`

### Problema: Timeout muito curto
- **Solução**: Aumentar `maxAttempts` em `startPolling()`:
```javascript
const maxAttempts = 60 // 60 * 3s = 3 minutos
```

## Código de Referência

### Integração Webhook Externo (Python):
```python
import requests
import time

def processar_digitacao(payload):
    tracking_id = payload.get('trackingId')
    callback_url = payload.get('callbackUrl')
    
    # Processa digitação (pode demorar)
    resultado = fazer_digitacao_no_banco(payload)
    
    # Chama callback com link
    if callback_url:
        requests.post(callback_url, json={
            'link': resultado['url_proposta'],
            'mensagem': 'Digitação concluída',
            'numero_proposta': resultado['numero']
        })
    
    return resultado
```

### Integração Webhook Externo (Node.js):
```javascript
async function processarDigitacao(payload) {
  const { trackingId, callbackUrl } = payload
  
  // Processa digitação
  const resultado = await fazerDigitacao(payload)
  
  // Chama callback
  if (callbackUrl) {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        link: resultado.urlProposta,
        mensagem: 'Digitação concluída',
        numero_proposta: resultado.numero
      })
    })
  }
  
  return resultado
}
```

---

**Versão**: 1.0  
**Data**: 9 de novembro de 2025  
**Status**: ✅ Implementado e testado
