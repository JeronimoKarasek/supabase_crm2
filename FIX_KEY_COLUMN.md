# 🛠️ CORREÇÃO URGENTE - Coluna 'key' Faltando

## ❌ Erro: column products.key does not exist

Este erro significa que a tabela `products` foi criada sem a coluna `key`.

---

## ✅ SOLUÇÃO RÁPIDA (30 segundos)

### Passo 1: Abra o Supabase Dashboard
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)

### Passo 2: Execute Este Comando

Cole e execute:

```sql
-- Adicionar coluna 'key' se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'key'
    ) THEN
        -- Adiciona a coluna
        ALTER TABLE products ADD COLUMN key text;
        
        -- Adiciona unique constraint
        ALTER TABLE products ADD CONSTRAINT products_key_unique UNIQUE (key);
        
        -- Gera keys automáticas para produtos existentes (se houver)
        UPDATE products 
        SET key = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE key IS NULL;
        
        -- Torna obrigatória
        ALTER TABLE products ALTER COLUMN key SET NOT NULL;
        
        RAISE NOTICE 'Coluna key adicionada com sucesso!';
    END IF;
END $$;

-- Recarrega schema
NOTIFY pgrst, 'reload schema';
```

### Passo 3: Verificar

Execute para confirmar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;
```

Você deve ver a coluna `key` (text) na lista.

---

## 🎯 Após a Correção

1. Aguarde 5 segundos (para o PostgREST atualizar)
2. Tente criar um produto novamente
3. ✅ Deve funcionar!

---

## 📋 Script Completo (Alternativa)

Se preferir, execute o arquivo completo:

**Arquivo**: `scripts/sql/add_key_column.sql`

Ou execute o script original recriado:

**Arquivo**: `scripts/sql/products.sql`

---

## 🔍 Por Que Isso Aconteceu?

A tabela `products` foi criada antes do campo `key` ser adicionado ao schema. Isso pode acontecer se:
- A migração foi executada parcialmente
- A tabela foi criada manualmente
- Houve um erro durante a criação inicial

---

## ✅ Verificação Final

Após executar o script, teste criando um produto:

1. Acesse `/criacao-produtos`
2. Preencha:
   - **Key**: `meu-produto-teste`
   - **Name**: `Meu Produto Teste`
   - **Description**: `Teste`
3. Clique em **Criar**
4. ✅ Deve criar com sucesso!

---

## 🆘 Se Ainda Houver Erro

Execute este comando de diagnóstico:

```sql
-- Ver estrutura completa da tabela
\d products;

-- Ou
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
```

Envie o resultado se o erro persistir.
