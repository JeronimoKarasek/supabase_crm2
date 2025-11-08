-- ============================================
-- CORREÇÃO: Adicionar coluna 'key' à tabela products
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Verificar se a coluna 'key' existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'key';

-- 2. Se não existir, adicionar a coluna 'key'
DO $$ 
BEGIN
    -- Verifica se a coluna key não existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'key'
    ) THEN
        -- Adiciona a coluna key
        ALTER TABLE products ADD COLUMN key text;
        
        -- Adiciona constraint unique
        ALTER TABLE products ADD CONSTRAINT products_key_unique UNIQUE (key);
        
        -- Adiciona constraint not null (depois de preencher os valores)
        -- Primeiro, gera keys automáticas para registros existentes
        UPDATE products 
        SET key = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE key IS NULL;
        
        -- Agora adiciona not null
        ALTER TABLE products ALTER COLUMN key SET NOT NULL;
        
        RAISE NOTICE 'Coluna key adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna key já existe';
    END IF;
END $$;

-- 3. Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- 4. Verificar estrutura final da tabela products
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 5. Verificar constraints
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'products'
ORDER BY tc.constraint_type, tc.constraint_name;
