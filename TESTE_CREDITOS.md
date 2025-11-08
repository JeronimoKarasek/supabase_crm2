# 🧪 Teste do Pop-up de Créditos

## ✅ Implementação Completa

O pop-up de créditos foi implementado usando **shadcn/ui Dialog** com as seguintes funcionalidades:

### 🎨 Características

1. **Design Moderno e Responsivo**
   - Gradiente verde/esmeralda para saldo positivo
   - Ícones visuais (💰, ❌)
   - Dark mode completo
   - Animações suaves

2. **Detecção Inteligente de Dados**
   - Busca automaticamente: `credits`, `saldo`, `balance`, `valor`
   - Exibe moeda se disponível: `currency`, `moeda`
   - Mostra informações adicionais em seção separada

3. **Tratamento de Erros**
   - Exibe mensagens de erro em vermelho
   - Feedback visual claro
   - Botão de fechar sempre disponível

---

## 🧪 Como Testar

### Teste 1: Webhook Retorna Saldo Simples

Configure o webhook para retornar:

```json
{
  "credits": 1500
}
```

**Resultado Esperado**: Pop-up mostra "1500" em destaque verde

---

### Teste 2: Webhook Retorna Saldo com Moeda

```json
{
  "saldo": 2500.50,
  "moeda": "BRL"
}
```

**Resultado Esperado**: Pop-up mostra "2500.5" com "BRL" abaixo

---

### Teste 3: Webhook Retorna Dados Adicionais

```json
{
  "balance": 3000,
  "currency": "USD",
  "empresa": "Empresa XYZ",
  "plano": "Premium",
  "vencimento": "2025-12-31"
}
```

**Resultado Esperado**: 
- Saldo: 3000 USD em destaque
- Seção "Informações Adicionais" mostra:
  - empresa: Empresa XYZ
  - plano: Premium
  - vencimento: 2025-12-31

---

### Teste 4: Webhook Retorna Erro

Simule erro no webhook (retorna 500 ou erro):

**Resultado Esperado**: Pop-up vermelho com mensagem de erro

---

### Teste 5: Webhook Não Configurado

Não configure o webhook em Configurações:

**Resultado Esperado**: Pop-up vermelho com "PicPay seller token not configured" ou similar

---

## 🎯 Casos de Uso do Webhook

### Exemplo 1: Webhook Simples (Retorna JSON Direto)

```javascript
// Seu webhook deve retornar:
{
  "credits": 1500
}
```

### Exemplo 2: Webhook com Dados Complexos

```javascript
// Seu webhook pode retornar:
{
  "status": "success",
  "data": {
    "saldo": 2500.50,
    "moeda": "BRL",
    "ultimaAtualizacao": "2025-11-05T10:30:00Z"
  }
}
```

**Nota**: O sistema busca em `json.data` primeiro, depois no objeto raiz.

---

## 🔧 Configuração do Webhook

1. Acesse **/configuracao**
2. Seção **Pagamentos**
3. Preencha **Webhook para consultar créditos**
   - Exemplo: `https://seu-backend.com/api/credits`
4. Salve

### Payload Enviado ao Webhook

```json
{
  "userId": "uuid-do-usuario",
  "email": "usuario@email.com",
  "timestamp": "2025-11-05T10:30:00.000Z"
}
```

---

## 📱 Screenshots Esperados

### Pop-up de Sucesso
```
┌─────────────────────────────────┐
│ 💰 Consulta de Créditos        │
│ Informações atualizadas...      │
├─────────────────────────────────┤
│                                 │
│  Saldo Disponível               │
│  ╔═══════════════╗              │
│  ║               ║              │
│  ║    1500       ║  (verde)     │
│  ║               ║              │
│  ╚═══════════════╝              │
│  BRL                            │
│                                 │
│  [ Fechar ]                     │
│                                 │
└─────────────────────────────────┘
```

### Pop-up de Erro
```
┌─────────────────────────────────┐
│ 💰 Consulta de Créditos        │
│ Ocorreu um erro...              │
├─────────────────────────────────┤
│                                 │
│  ╔═══════════════╗              │
│  ║ ❌ Erro       ║  (vermelho)  │
│  ║ Falha ao...   ║              │
│  ╚═══════════════╝              │
│                                 │
└─────────────────────────────────┘
```

---

## ✅ Checklist de Validação

- [ ] Pop-up abre ao clicar no botão
- [ ] Botão mostra "Consultando..." durante requisição
- [ ] Pop-up mostra saldo em destaque verde
- [ ] Pop-up exibe moeda se disponível
- [ ] Pop-up lista informações adicionais
- [ ] Pop-up fecha ao clicar em "Fechar"
- [ ] Pop-up fecha ao clicar fora
- [ ] Pop-up fecha ao pressionar ESC
- [ ] Erros são exibidos em vermelho
- [ ] Dark mode funciona corretamente

---

## 🐛 Troubleshooting

### Botão não aparece
✅ **RESOLVIDO**: Botão agora sempre visível no header

### Pop-up não abre
- Verifique console do navegador (F12)
- Confirme que Dialog do shadcn/ui está instalado

### Saldo não aparece
- Verifique resposta do webhook no Network tab
- Confirme que webhook retorna JSON válido
- Verifique se campo é `credits`, `saldo`, `balance` ou `valor`

### Erro "webhook not configured"
- Configure webhook em **/configuracao**
- Ou adicione `PICPAY_SELLER_TOKEN` no `.env.local`
