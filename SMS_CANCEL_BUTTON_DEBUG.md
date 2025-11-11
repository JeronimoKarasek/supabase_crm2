# SMS - Botão Cancelar e Debug de Créditos

**Data**: 2025-01-XX  
**Status**: ✅ Implementado | 🔍 Debug em andamento

---

## 1. Botão Cancelar Implementado

### Mudanças no `app/disparo-sms/page.js`

**Estado de envio adicionado:**
```javascript
const [sendingBatch, setSendingBatch] = useState(null)
```

**Exposição da função de limpeza:**
```javascript
useEffect(() => {
  window.clearSendingBatch = () => setSendingBatch(null)
  return () => { window.clearSendingBatch = null }
}, [])
```

**UI do botão dinâmica:**
- **Antes de enviar**: Mostra botão "Enviar" ou "Reenviar falhas"
- **Durante envio**: Mostra botão "Enviando..." (desabilitado) + botão "Cancelar"
- **Após enviar**: Botões somem e voltam ao estado original

**Limpeza automática:**
- Função `confirmarEnvio()` chama `window.clearSendingBatch()` ao finalizar
- Estado é limpo automaticamente após sucesso/erro

---

## 2. Debug de Créditos - Logs Adicionados

### 2.1 API de Envio (`app/api/disparo-sms/send/route.js`)

**Log após cobrança:**
```javascript
console.log('💰 [SMS Send] Débito de créditos:', {
  charged,          // true/false
  chargeError,      // mensagem de erro se houver
  pricePerMsg,      // preço unitário
  totalUnits,       // quantidade de SMS válidos
  totalCost,        // custo total
  empresaId,        // ID da empresa
  userId            // ID do usuário
})
```

### 2.2 Biblioteca de Créditos (`lib/credits.js`)

**Logs no `chargeCents()`:**
```javascript
console.log('💰 [Credits] chargeCents chamado:', { 
  userId, cents, finalCents, empresaId, useDbFallback 
})

console.log('💰 [Credits] Usando RPC empresa_charge_credits:', { 
  empresaId, finalCents 
})

console.log('💰 [Credits] RPC resultado:', { data, error })
```

---

## 3. Script de Teste Criado

### `test-charge-credits.js`

**Funcionalidade:**
- Lista primeiras 5 empresas
- Seleciona primeira empresa
- Cobra 100 centavos (R$ 1,00)
- Compara saldo antes/depois

**Como executar:**
```powershell
node test-charge-credits.js
```

**O que verificar:**
- ✅ Empresa encontrada
- ✅ RPC executado sem erro
- ✅ Saldo diminui em R$ 1,00
- ❌ Se falhar: RPC não existe ou tem erro de permissão

---

## 4. Verificação da Stored Procedure

### RPC `empresa_charge_credits`

**Definida em:**
- `scripts/sql/fix_credits_column.sql` (versão atualizada)
- `scripts/sql/empresa.sql` (versão original)

**Assinatura:**
```sql
empresa_charge_credits(p_empresa uuid, p_cents bigint)
returns table(success boolean, new_balance bigint, error text)
```

**Comportamento:**
1. Busca saldo atual em `empresa.credits` (float)
2. Converte `p_cents` para reais (divide por 100)
3. Verifica se saldo suficiente
4. Debita `credits - amount_reais`
5. Retorna `{ success, new_balance, error }`

---

## 5. Diagnóstico do Problema

### Possíveis Causas

**1. RPC não executada no Supabase:**
- Execute `scripts/sql/fix_credits_column.sql` no SQL Editor
- Confirme que função foi criada: 
  ```sql
  SELECT * FROM pg_proc WHERE proname = 'empresa_charge_credits';
  ```

**2. Permissões RLS:**
- RPC usa `security definer` (executa como owner)
- Não deveria ser bloqueada por RLS

**3. EmpresaId null:**
- Verificar se `lib/empresa.js` retorna ID correto
- Checar logs: `console.log('💰 [Credits] chargeCents chamado:' ...)`

**4. UseDbFallback false:**
- Se Redis configurado, sistema usa Redis ao invés de Supabase
- Verificar `lib/redis.js` → modo ativo (upstash | ioredis | memory)

---

## 6. Próximos Passos

### Para o Usuário:

1. **Executar SQL no Supabase:**
   ```sql
   -- Cole todo conteúdo de scripts/sql/fix_credits_column.sql
   -- no SQL Editor do Supabase e execute
   ```

2. **Testar cobrança:**
   ```powershell
   node test-charge-credits.js
   ```

3. **Enviar SMS e verificar logs:**
   - Abra DevTools (F12) → Console
   - Envie 1-2 SMS de teste
   - Procure logs: `💰 [SMS Send] Débito de créditos:`
   - Copie e envie os logs

4. **Verificar saldo no banco:**
   ```sql
   SELECT id, nome, credits FROM empresa LIMIT 5;
   ```

---

## 7. Exemplo de Log Esperado

### ✅ Funcionando corretamente:

```
💰 [Credits] chargeCents chamado: {
  userId: 'abc123...',
  cents: 100,
  finalCents: 100,
  empresaId: 'def456...',
  useDbFallback: true
}

💰 [Credits] Usando RPC empresa_charge_credits: {
  empresaId: 'def456...',
  finalCents: 100
}

💰 [Credits] RPC resultado: {
  data: [{ success: true, new_balance: 49900, error: null }],
  error: null
}

💰 [SMS Send] Débito de créditos: {
  charged: true,
  chargeError: null,
  pricePerMsg: 1,
  totalUnits: 1,
  totalCost: 1,
  empresaId: 'def456...',
  userId: 'abc123...'
}
```

### ❌ Problema - RPC não existe:

```
💰 [Credits] RPC resultado: {
  data: null,
  error: {
    message: 'function empresa_charge_credits(uuid, bigint) does not exist',
    code: '42883'
  }
}
```

### ❌ Problema - Saldo insuficiente:

```
💰 [Credits] RPC resultado: {
  data: [{ success: false, new_balance: 0, error: 'Saldo insuficiente' }],
  error: null
}

💰 [SMS Send] Débito de créditos: {
  charged: false,
  chargeError: 'Saldo insuficiente',
  ...
}
```

---

## 8. Arquivos Modificados

1. ✅ `app/disparo-sms/page.js` - Botão cancelar + estado de envio
2. ✅ `app/api/disparo-sms/send/route.js` - Logs de crédito
3. ✅ `lib/credits.js` - Logs detalhados do RPC
4. ✅ `test-charge-credits.js` - Script de teste (novo)
5. ✅ `SMS_CANCEL_BUTTON_DEBUG.md` - Esta documentação (novo)

---

**Última atualização**: 2025-01-XX
