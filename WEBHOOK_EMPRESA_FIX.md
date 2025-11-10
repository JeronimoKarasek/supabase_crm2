# Correção: Sistema de Créditos Migrado para Empresa

## Problema Identificado

O webhook estava adicionando créditos ao **usuário individual** (`user_credits` table), mas o sistema foi migrado para trabalhar com **créditos por empresa** (`empresa.credits_balance_cents`).

## Mudanças Aplicadas

### 1. Webhook do Mercado Pago

**Arquivo:** `app/api/mercadopago/webhook/route.js`

✅ **Antes:**
```javascript
await credits.addCents(user.id, cents)  // ❌ Adicionava ao usuário
```

✅ **Depois:**
```javascript
// 1. Busca empresa do usuário
const { data: empresaLink } = await supabaseAdmin
  .from('empresa_users')
  .select('empresa_id')
  .eq('user_id', userId)
  .single()

const empresaId = empresaLink.empresa_id

// 2. Adiciona créditos à empresa usando RPC
const { data: newBalance } = await supabaseAdmin.rpc('empresa_add_credits', {
  p_empresa: empresaId,
  p_cents: cents
})
```

**Fluxo Atualizado:**
1. Webhook recebe notificação de pagamento aprovado
2. Extrai `userId` do `external_reference`
3. **NOVO:** Busca empresa do usuário via `empresa_users`
4. **NOVO:** Adiciona créditos à empresa usando `empresa_add_credits()`
5. Todos os usuários da mesma empresa compartilham o saldo

### 2. Script Manual de Créditos

**Arquivo:** `add-credits-direct.js`

✅ **Melhorias:**
- Busca empresa do usuário antes de adicionar créditos
- Usa RPC `empresa_add_credits` para adicionar
- Mostra saldo atual e novo da empresa
- Validação se usuário está vinculado a empresa

**Exemplo de uso:**
```powershell
node add-credits-direct.js
```

**Saída:**
```
🔄 Adicionando créditos À EMPRESA...

1️⃣ Buscando empresa do usuário...
   ✅ Empresa encontrada: 55fcda3b-9fea-4f51-8a64-b1086fb0f595

2️⃣ Verificando saldo atual da empresa...
   Empresa: Farol
   Saldo atual: 0 cents (R$ 0.00)

3️⃣ Adicionando 50 cents via empresa_add_credits...
   ✅ Novo saldo: 50 cents (R$ 0.50)

4️⃣ Dados do usuário:
   Email: junior.karaseks@gmail.com
   
✅ Créditos adicionados à EMPRESA com sucesso!
   Todos os usuários da empresa Farol agora têm acesso a estes créditos.
```

## Estrutura do Sistema Multi-Tenant

### Tabelas

**`empresa`** - Dados da empresa
```sql
id uuid PRIMARY KEY
nome text
credits_balance_cents bigint  -- Saldo compartilhado
user_limit integer            -- Limite de usuários
```

**`empresa_users`** - Vincula usuários a empresas
```sql
user_id uuid PRIMARY KEY (FK auth.users)
empresa_id uuid (FK empresa)
role text  -- 'user' | 'gestor' | 'admin'
```

### Funções RPC

**`empresa_add_credits(p_empresa uuid, p_cents bigint)`**
- Adiciona créditos ao saldo da empresa
- Retorna novo saldo em centavos
- Exemplo: `empresa_add_credits('55fcda3b-...', 1000)` → adiciona R$ 10,00

**`empresa_charge_credits(p_empresa uuid, p_cents bigint)`**
- Debita créditos da empresa
- Falha se saldo insuficiente
- Retorna `{success, new_balance, error}`

## Como Funciona

### Cenário 1: Pagamento PIX Aprovado

```
1. Usuário "junior.karaseks@gmail.com" (ID: 63e09cd6-...)
2. Vinculado à Empresa "Farol" (ID: 55fcda3b-...)
3. Paga PIX de R$ 0,50
4. Mercado Pago aprova pagamento
5. Webhook recebe notificação
6. Busca empresa do usuário: 55fcda3b-...
7. Adiciona 50 cents à empresa "Farol"
8. TODOS os usuários da empresa "Farol" compartilham este saldo
```

### Cenário 2: Múltiplos Usuários

```
Empresa "Farol" tem saldo de R$ 100,00

Usuário A (gestor):
  - Faz consulta CPF → debita R$ 2,00
  - Saldo da empresa: R$ 98,00

Usuário B (user):
  - Faz consulta CNPJ → debita R$ 5,00
  - Saldo da empresa: R$ 93,00

Ambos compartilham o mesmo saldo!
```

## Testes Realizados

✅ **Script Manual:** Adicionados R$ 0,50 à empresa "Farol"
- Empresa ID: `55fcda3b-9fea-4f51-8a64-b1086fb0f595`
- Saldo antes: R$ 0,00
- Saldo depois: R$ 0,50
- Função RPC funcionando corretamente

⏳ **Webhook Automático:** Pendente de teste
- Precisa configurar notification URL no Mercado Pago
- URL: `https://crm.farolbase.com/api/mercadopago/webhook`

## Próximos Passos

### 1. Configurar Webhook no Mercado Pago

Acesse: https://www.mercadopago.com.br/developers
- Suas integrações → Notificações IPN
- URL: `https://crm.farolbase.com/api/mercadopago/webhook`
- Eventos: ✅ Payments

### 2. Fazer Pagamento de Teste

```
1. Login no sistema
2. Adicionar Créditos → R$ 0,01
3. Gerar QR Code PIX
4. Pagar PIX
5. Aguardar até 30s
6. Verificar saldo da empresa
```

### 3. Verificar Logs Esperados

```
[MP Webhook] ========== WEBHOOK RECEIVED ==========
[MP Webhook] 🎯 Detected CREDITS payment
[MP Webhook] ✅ Payment APPROVED - processing credits...
[MP Webhook] Extracted userId { userId: '63e09cd6-...' }
[MP Webhook] ✅ User found { email: 'junior.karaseks@gmail.com' }
[MP Webhook] Fetching user empresa...
[MP Webhook] ✅ Empresa found { empresaId: '55fcda3b-...' }
[MP Webhook] 💰 Adding credits to EMPRESA...
[MP Webhook] ✅✅✅ CREDITS SUCCESSFULLY ADDED TO EMPRESA!
```

## Troubleshooting

### Erro: "Usuário não vinculado a empresa"

**Causa:** Usuário não tem registro em `empresa_users`

**Solução:**
```sql
-- Verificar vínculo
SELECT * FROM empresa_users WHERE user_id = '63e09cd6-5870-42c5-90ad-5130be525c33';

-- Criar empresa se não existe
INSERT INTO empresa (nome) VALUES ('Minha Empresa') RETURNING id;

-- Vincular usuário
INSERT INTO empresa_users (user_id, empresa_id, role)
VALUES ('63e09cd6-5870-42c5-90ad-5130be525c33', '<empresa_id>', 'admin');
```

### Erro: "empresa_add_credits function not found"

**Causa:** SQL de empresa não foi executado

**Solução:**
```bash
# Execute no Supabase SQL Editor:
# scripts/sql/empresa.sql
```

### Saldo não aparece no sistema

**Causa:** Frontend pode estar lendo do lugar errado

**Verificação:**
```sql
-- Verificar saldo da empresa
SELECT id, nome, credits_balance_cents 
FROM empresa 
WHERE id = '55fcda3b-9fea-4f51-8a64-b1086fb0f595';
```

## Arquivos Modificados

- ✅ `app/api/mercadopago/webhook/route.js` - Webhook corrigido para empresa
- ✅ `add-credits-direct.js` - Script manual para empresa
- 📄 `WEBHOOK_EMPRESA_FIX.md` - Esta documentação

## Migração de Dados (Se Necessário)

Se você tinha créditos antigos na tabela `user_credits`:

```sql
-- Migrar créditos de usuário para empresa
UPDATE empresa e
SET credits_balance_cents = credits_balance_cents + uc.balance_cents
FROM user_credits uc
JOIN empresa_users eu ON eu.user_id = uc.user_id
WHERE e.id = eu.empresa_id;

-- Limpar tabela antiga (opcional)
-- TRUNCATE user_credits;
```

---

**Atualizado em:** 09/11/2025  
**Status:** ✅ Correções aplicadas - Aguardando teste com pagamento real
