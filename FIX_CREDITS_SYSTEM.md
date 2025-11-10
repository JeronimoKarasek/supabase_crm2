# Sistema de Créditos - Padronização Completa

## Problema Identificado

O sistema estava usando duas colunas diferentes para créditos:
- `credits_balance_cents` (bigint) - usado pelas stored procedures
- `credits` (float/numeric) - usado pela interface e webhook

Isso causava inconsistências:
- Créditos não apareciam para todos os usuários da empresa
- Botão "+Crédito" adicionava/removia da coluna errada
- Descontos não refletiam corretamente

## Solução Implementada

### 1. SQL - Stored Procedures Atualizadas ✅

**Arquivo**: `scripts/sql/fix_credits_column.sql`

- `empresa_add_credits()`: Agora adiciona na coluna `credits` (float)
- `empresa_charge_credits()`: Agora debita da coluna `credits` (float)
- `vw_user_empresa`: View atualizada para usar `credits`

**Conversão automática**: As funções recebem/retornam valores em cents (bigint) para compatibilidade com o código existente, mas internamente trabalham com a coluna `credits` (float em reais).

### 2. Helper de Créditos Atualizado ✅

**Arquivo**: `lib/credits.js`

- `getBalanceCents()`: Lê da coluna `credits` (float) e converte para cents
- `setBalanceCents()`: Converte cents para reais e salva na coluna `credits`
- `addCents()`: Usa stored procedure atualizada
- `chargeCents()`: Usa stored procedure atualizada

### 3. API de Créditos ✅

**Arquivo**: `app/api/credits/route.js`

Já estava correto! Busca créditos da empresa pela coluna `credits`.

### 4. Webhook Mercado Pago ✅

**Arquivo**: `app/api/mercadopago/webhook/route.js`

Já estava correto! Adiciona créditos diretamente na coluna `credits` quando o PIX é pago.

### 5. Botão "+Crédito" ✅

**Arquivo**: `app/usuarios/page.js`

Já estava correto! Atualiza a coluna `credits` ao adicionar/remover créditos manualmente.

## Como Testar

### 1. Executar o SQL no Supabase

```bash
# Abrir Supabase Dashboard → SQL Editor
# Copiar e executar o conteúdo de: scripts/sql/fix_credits_column.sql
```

### 2. Testar Adição de Créditos via PIX

1. Fazer login com um usuário vinculado a uma empresa
2. Clicar em "Adicionar créditos" no header
3. Inserir valor (ex: R$ 50,00)
4. Gerar PIX e pagar
5. Aguardar webhook processar (alguns segundos)
6. **Verificar**: O crédito deve aparecer no header para TODOS os usuários daquela empresa

### 3. Testar Botão "+Crédito" (Admin)

1. Fazer login como admin
2. Ir em `/usuarios` → Tab "Empresas"
3. Clicar no botão "+Créditos" de uma empresa
4. Adicionar valor (ex: R$ 100,00)
5. **Verificar**: Crédito deve ser adicionado na coluna `credits`
6. Fazer login com usuário daquela empresa
7. **Verificar**: Crédito deve aparecer no header

### 4. Testar Desconto de Créditos

#### Disparo SMS
1. Ir em `/disparo-sms`
2. Enviar SMS para alguns números
3. **Verificar**: Crédito deve ser descontado da coluna `credits` da empresa

#### Higienizar Dados
1. Ir em `/higienizar-dados`
2. Processar arquivo
3. **Verificar**: Crédito deve ser descontado da coluna `credits` da empresa

#### Consulta IN100
1. Fazer consulta IN100
2. **Verificar**: Crédito deve ser descontado da coluna `credits` da empresa

## Arquivos Modificados

### Criados
- `scripts/sql/fix_credits_column.sql` - SQL para atualizar stored procedures

### Atualizados
- `lib/credits.js` - Helper de créditos (2 funções: getBalanceCents e setBalanceCents)

### Verificados (Já Corretos)
- `app/api/credits/route.js` - Endpoint de consulta de créditos
- `app/api/mercadopago/webhook/route.js` - Webhook de pagamento PIX
- `app/usuarios/page.js` - Botão "+Crédito"
- `components/app-chrome.jsx` - Exibição de créditos no header

## Status

✅ **Stored procedures atualizadas**  
✅ **Helper de créditos atualizado**  
✅ **API de créditos verificada**  
✅ **Webhook verificado**  
✅ **Botão +Crédito verificado**  
⏳ **Aguardando execução do SQL no Supabase**  
⏳ **Aguardando testes em produção**

## Próximos Passos

1. **Executar SQL no Supabase**: `scripts/sql/fix_credits_column.sql`
2. **Testar fluxo completo**: PIX → Header → Desconto SMS
3. **Verificar consistência**: Todos os usuários da empresa veem o mesmo saldo

---

**Data**: 10 de novembro de 2025  
**Desenvolvedor**: AI Agent  
**Setor**: Créditos
