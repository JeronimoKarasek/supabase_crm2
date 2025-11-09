# 🚀 Instruções para Corrigir Estrutura da Tabela Empresa

## ❗ Problema Identificado

Os erros que você está vendo:
```
PGRST204: Could not find the 'user_limit' column of 'empresa' in the schema cache
PGRST204: Could not find the 'credits' column of 'empresa' in the schema cache
```

Indicam que as colunas `user_limit` e `credits` **NÃO EXISTEM** na tabela `empresa` do seu banco de dados Supabase.

---

## ✅ Solução: Executar Script SQL

### Passo 1: Acessar o Supabase SQL Editor

1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
2. No menu lateral esquerdo, clique em **"SQL Editor"**
3. Clique em **"New Query"** para criar uma nova consulta

### Passo 2: Copiar e Executar o Script

Copie **TODO** o conteúdo do arquivo:
```
scripts/sql/add_credits_to_empresa.sql
```

Ou copie diretamente daqui:

```sql
-- ====================================================================
-- Script SQL completo para estrutura da tabela empresa
-- Execute este script no Supabase SQL Editor
-- ====================================================================

-- 1. Adicionar coluna user_limit (limite de usuários por empresa)
ALTER TABLE empresa 
ADD COLUMN IF NOT EXISTS user_limit INTEGER DEFAULT 1;

-- 2. Adicionar coluna credits (saldo de créditos da empresa)
ALTER TABLE empresa 
ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0;

-- 3. Atualizar valores NULL para os padrões corretos
UPDATE empresa 
SET user_limit = 1 
WHERE user_limit IS NULL OR user_limit < 1;

UPDATE empresa 
SET credits = 0 
WHERE credits IS NULL;

-- 4. Adicionar comentários explicativos
COMMENT ON COLUMN empresa.user_limit IS 'Limite máximo de usuários que podem ser vinculados a esta empresa';
COMMENT ON COLUMN empresa.credits IS 'Saldo de créditos da empresa para consultas API (Shift Data, etc)';

-- 5. Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_empresa_credits ON empresa(credits);

-- 6. Verificar estrutura final
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'empresa' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

### Passo 3: Executar

1. Cole o script no editor
2. Clique em **"Run"** (ou pressione `Ctrl + Enter`)
3. Aguarde a execução (deve levar 1-2 segundos)

### Passo 4: Verificar Resultado

Na parte inferior do SQL Editor, você verá:
- ✅ **Sucesso**: Uma tabela mostrando todas as colunas da tabela `empresa`, incluindo `user_limit` e `credits`
- ❌ **Erro**: Uma mensagem de erro (copie e me envie se isso acontecer)

---

## 🔄 Após Executar o Script

### O que vai funcionar automaticamente:

1. ✅ **Criar empresa** - Não vai mais dar erro `PGRST204`
2. ✅ **Editar empresa** - Campos `user_limit` e `credits` serão salvos corretamente
3. ✅ **Adicionar créditos** - Funcionalidade de ajustar saldo (+ ou -) vai funcionar
4. ✅ **Saldo no topo** - Crédito exibido será o da empresa (compartilhado entre usuários)
5. ✅ **Validação de limite** - Sistema vai respeitar o limite de usuários por empresa
6. ✅ **Consultas API** - Desconto de créditos será feito da empresa, não do usuário

---

## 📋 Verificação Manual (Opcional)

Se quiser confirmar que as colunas foram criadas, execute esta consulta:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'empresa' 
  AND column_name IN ('user_limit', 'credits');
```

**Resultado esperado:**
```
column_name  | data_type | column_default
-------------+-----------+----------------
user_limit   | integer   | 1
credits      | numeric   | 0
```

---

## 🎯 Valores Iniciais das Empresas Existentes

Todas as empresas existentes receberão automaticamente:
- `user_limit = 1` (1 usuário por empresa)
- `credits = 0.00` (saldo zero)

Você pode ajustar esses valores manualmente depois:
1. Acesse **Usuários > Empresas** no sistema
2. Clique em **"Editar"** na empresa desejada
3. Altere o **"Limite usuários"**
4. Clique em **"+ Créditos"** para adicionar saldo

---

## ❓ Perguntas Frequentes

### Q: E se eu já tenho empresas cadastradas?
**R:** O script usa `IF NOT EXISTS`, então é seguro executar múltiplas vezes. Empresas existentes não serão afetadas negativamente.

### Q: Os usuários vão perder créditos?
**R:** Não! O sistema de créditos **MIGROU** de usuário para empresa. O código agora busca créditos da empresa vinculada ao usuário.

### Q: Posso adicionar créditos negativos?
**R:** Sim! No formulário de ajustar créditos, use valores negativos para remover. O sistema garante que o saldo não ficará menor que zero.

### Q: Como funciona o limite de usuários?
**R:** Cada empresa tem um `user_limit` (padrão 1). Quando tentar vincular mais usuários do que o limite, o sistema bloqueia e mostra: `"Limite atingido (2/2)"`.

---

## 🆘 Precisa de Ajuda?

Se encontrar algum erro durante a execução:

1. **Copie a mensagem de erro completa**
2. **Tire um print da tela**
3. **Me envie** com a descrição do que aconteceu

Vou te ajudar a resolver! 🚀
