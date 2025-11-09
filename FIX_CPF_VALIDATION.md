# 🔧 Solução Final: Erro PIX "Collector user without key"

## ❌ Problema

Erro ao gerar QR Code PIX:
```
Collector user without key enabled for QR render
null: Error in Financial Identity Use Case
```

## 🔍 Causa Raiz

O Mercado Pago **valida o dígito verificador do CPF** antes de gerar o QR Code PIX. 

CPFs inválidos que causam erro:
- `00000000000` - Dígitos repetidos
- `12345678900` - Dígito verificador incorreto
- `11111111111` - Sequência inválida

## ✅ Solução Implementada

### 1. Validador de CPF (`lib/mercadopago.js`)

Adicionado funções:
- `isValidCPF(cpf)` - Valida dígito verificador
- `getValidCPF(cpf)` - Retorna CPF válido (usa fornecido ou padrão)

**CPF válido padrão para sandbox**: `11144477735`
- Este é um CPF válido matematicamente
- Comumente usado em ambientes de teste

### 2. Atualizado Rotas

Arquivos corrigidos:
- ✅ `app/api/payments/add-credits/route.js` - Adicionar créditos
- ✅ `app/api/mercadopago/checkout/route.js` - Checkout geral

Agora ambos usam `getValidCPF()` que:
1. Tenta usar CPF do usuário (se válido)
2. Se inválido, usa CPF padrão `11144477735`

### 3. Ordem de Prioridade

```javascript
// Busca CPF nesta ordem:
1. user.user_metadata.document
2. user.user_metadata.cpf
3. buyer.document (se houver)
4. CPF padrão: 11144477735
```

## 🧪 Como Testar Agora

### Passo 1: Reiniciar Servidor

```powershell
# Pare o servidor com Ctrl+C
npm run dev
```

### Passo 2: Testar Adicionar Créditos

1. Faça login
2. Vá para "Adicionar Créditos"
3. Selecione valor (ex: R$ 10,00)
4. Clique em "Gerar PIX"

### Passo 3: Verificar Sucesso

Deve retornar:
```json
{
  "paymentId": "123456789",
  "status": "pending",
  "qrCode": "00020126...",
  "qrCodeBase64": "iVBORw0KGgoAAAANS...",
  "referenceId": "credits_..."
}
```

### Passo 4: Verificar Logs

Terminal deve mostrar:
```
📋 Payment payload: { payer: { identification: { number: "111****735" } } }
📤 Enviando para Mercado Pago...
📥 Resposta Mercado Pago: { "id": 123456789, "status": "pending" }
```

**CPF mascarado nos logs** para segurança.

## 🎯 Próximos Passos (Opcional)

### Adicionar CPF Real do Usuário

Para usar CPF real do usuário (não o genérico):

#### Opção 1: Via Interface (Criar tela de perfil)

Adicionar campo CPF no cadastro/perfil do usuário.

#### Opção 2: Via SQL

```sql
-- Adicionar CPF válido ao usuário
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"cpf": "12345678900"}'::jsonb
WHERE email = 'usuario@exemplo.com';
```

#### Opção 3: Pedir CPF no momento do pagamento

Adicionar campo CPF na tela de "Adicionar Créditos":
```javascript
const [cpf, setCpf] = useState('')

// No body da requisição:
body: JSON.stringify({
  amount: valor,
  buyer: {
    document: cpf // CPF digitado pelo usuário
  }
})
```

## 🔐 Validação de CPF

Se quiser validar CPF no frontend antes de enviar:

```javascript
// components/cpf-input.jsx
function isValidCPF(cpf) {
  const numericCpf = cpf.replace(/\D/g, '')
  if (numericCpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(numericCpf)) return false
  
  let sum = 0
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(numericCpf[i - 1]) * (11 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(numericCpf[9])) return false
  
  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(numericCpf[i - 1]) * (12 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(numericCpf[10])) return false
  
  return true
}
```

## 📊 CPFs Válidos para Testes

CPFs válidos que podem ser usados em sandbox:

| CPF | Nome Comum |
|-----|------------|
| `11144477735` | João da Silva (padrão) |
| `12345678909` | Test User 1 |
| `11111111111` | ❌ INVÁLIDO (sequência) |
| `00000000000` | ❌ INVÁLIDO (zeros) |

## 🐛 Troubleshooting

### Ainda dá erro "Collector user without key"

1. **Reiniciou o servidor?**
   ```powershell
   npm run dev
   ```

2. **Verificar logs do pagamento:**
   ```
   📋 Payment payload: { payer: { identification: { number: "111****735" } } }
   ```
   - Se mostrar `000****000` = ainda usando CPF inválido

3. **Testar validador de CPF:**
   ```javascript
   const { isValidCPF } = require('./lib/mercadopago')
   console.log(isValidCPF('11144477735')) // deve ser true
   console.log(isValidCPF('00000000000')) // deve ser false
   ```

4. **Verificar se helper está sendo importado:**
   ```javascript
   // app/api/payments/add-credits/route.js
   const { getValidCPF } = require('@/lib/mercadopago')
   ```

### Erro persiste após reiniciar

Cache do Next.js pode estar ativo:

```powershell
# Limpar cache e reiniciar
Remove-Item -Recurse -Force .next
npm run dev
```

## ✅ Checklist Final

- [x] Helper `getValidCPF` criado em `lib/mercadopago.js`
- [x] Validador `isValidCPF` implementado
- [x] Rota `/api/payments/add-credits` atualizada
- [x] Rota `/api/mercadopago/checkout` atualizada
- [x] CPF padrão válido: `11144477735`
- [x] Logs mascarados para segurança
- [ ] Servidor reiniciado
- [ ] Teste de geração de PIX executado
- [ ] QR Code apareceu com sucesso

---

**Status**: ✅ Correção implementada - Aguardando teste  
**Última atualização**: 9 de novembro de 2025
