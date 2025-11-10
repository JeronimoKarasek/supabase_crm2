# Correções: Setores e Créditos

## Problemas Corrigidos

### 1. ❌ Setores não sendo liberados na compra
**Causa**: Função duplicada e não reutilizada entre webhook e subscription

**Solução**:
- Criado `lib/sectors-grant.js` com função centralizada `grantSectorsToUser()`
- Atualizado webhook (`app/api/mercadopago/webhook/route.js`) para usar nova função
- Atualizado subscription (`app/api/mercadopago/subscription/route.js`) para usar nova função
- Funções agora retornam `{success: boolean, sectors?: string[], error?: string}`

**Resultado**: ✅ Setores agora são liberados corretamente em:
- Compras via PIX (webhook)
- Assinaturas via cartão (subscription endpoint)

### 2. ❌ Créditos da empresa não aparecendo correto
**Causa**: Inconsistência entre campos `credits` (float) vs `credits_balance_cents` (integer)

**Solução**:
- Webhook SEMPRE adiciona em `empresa.credits` (float, em reais)
- API `/api/empresas` agora lê de `empresa.credits` (float)
- Removido conversões de `credits_balance_cents / 100`

**Resultado**: ✅ Créditos agora aparecem corretamente para usuários vinculados à empresa

## Arquivos Modificados

### Criado
- `lib/sectors-grant.js` - Helper centralizado para:
  - `grantSectorsToUser(userId, sectors)` - Grant setores sem duplicatas
  - `increaseUserLimit(empresaId, quantity)` - Aumentar limite de usuários
  - `getUserEmpresa(userId)` - Obter empresa do usuário

### Modificado
1. **app/api/mercadopago/webhook/route.js**
   - Importa `grantSectorsToUser` de `lib/sectors-grant`
   - Remove função duplicada local
   - Usa `grantResult.success` ao invés de boolean direto

2. **app/api/mercadopago/subscription/route.js**
   - Importa helpers de `lib/sectors-grant`
   - Usa `grantSectorsToUser()` ao invés de código inline
   - Usa `increaseUserLimit()` e `getUserEmpresa()` para aumentar limite

3. **app/api/empresas/route.js**
   - GET: Lê `credits` (float) ao invés de `credits_balance_cents / 100`
   - POST: Inicializa `credits = 0` ao invés de `credits_balance_cents = 0`
   - PUT: Atualiza `credits` (float) ao invés de `credits_balance_cents`

## Como Testar

### Teste 1: Setores sendo liberados
1. Crie um produto com setores selecionados (ex: "Dashboard", "Clientes")
2. Faça uma compra via PIX ou assinatura via cartão
3. Após pagamento aprovado, verifique no console do servidor:
   ```
   [grantSectorsToUser] Step 5: SUCCESS!
   ```
4. Faça logout e login novamente
5. Verifique se os setores aparecem no menu lateral

### Teste 2: Créditos da empresa
1. Adicione R$ 10,00 de créditos via PIX
2. Verifique no console do servidor:
   ```
   [MP Webhook] ✅✅✅ CREDITS SUCCESSFULLY ADDED TO EMPRESA!
   ```
3. Acesse `/configuracao` ou qualquer tela que mostre créditos
4. Verifique se o valor está correto (R$ 10,00)

### Teste 3: Assinatura completa
1. Crie produto tipo "Assinatura Mensal" com:
   - Método: Cartão
   - Billing Mode: Subscription
   - Setores: Dashboard, Clientes
   - User Price: 5 (se tipo usuario)
2. Faça assinatura
3. Verifique logs:
   ```
   [MP Subscription] ✅ Sectors granted successfully!
   [MP Subscription] ✅ User limit increased!
   ```

## Logs para Debug

### Setores
```
[grantSectorsToUser] Step 1: Getting user data
[grantSectorsToUser] Step 2: User found
[grantSectorsToUser] Step 3: Merging sectors
[grantSectorsToUser] Step 4: Updating user metadata
[grantSectorsToUser] Step 5: SUCCESS!
```

### Créditos
```
[MP Webhook] 💰 Adding credits to EMPRESA...
[MP Webhook] 💰 Credits calculation
[MP Webhook] ✅✅✅ CREDITS SUCCESSFULLY ADDED TO EMPRESA!
```

## Notas Importantes

1. **Campo de créditos**: Usar sempre `credits` (float em reais), não `credits_balance_cents`
2. **Setores duplicados**: A função automaticamente remove duplicatas com `new Set()`
3. **Webhook sempre 200**: Webhook retorna 200 OK mesmo em caso de erro para evitar reenvios do Mercado Pago
4. **Logs detalhados**: Todos os passos são logados para facilitar debug

## Próximos Passos (Opcional)

- [ ] Migrar todos os dados de `credits_balance_cents` para `credits` se houver dados antigos
- [ ] Adicionar RPC function no Supabase para grant de setores (mais performático)
- [ ] Criar endpoint para usuário ver seus setores atuais
- [ ] Adicionar histórico de quando cada setor foi liberado
