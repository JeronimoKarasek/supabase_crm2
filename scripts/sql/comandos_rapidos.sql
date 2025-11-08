-- ============================================
-- COMANDOS SQL RÁPIDOS - COPIE E COLE
-- ============================================

-- 1. RECARREGAR SCHEMA DO POSTGREST (5 segundos)
-- Use este comando se houver erro ao criar produtos
NOTIFY pgrst, 'reload schema';


-- 2. VERIFICAR COLUNAS DA TABELA PRODUCTS
-- Execute para confirmar que 'description' existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;


-- 3. ADICIONAR COLUNA DESCRIPTION (Se não existir)
-- Só execute se a coluna realmente não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description text;
        RAISE NOTICE 'Coluna description adicionada';
    ELSE
        RAISE NOTICE 'Coluna description já existe';
    END IF;
END $$;


-- 4. COMANDO COMPLETO - CORRIGE TUDO
-- Verifica + Adiciona + Recarrega
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description text;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;


-- 5. VERIFICAR SE PRODUCTS EXISTE
-- Execute para confirmar que a tabela está criada
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'products'
) as products_exists;


-- 6. LISTAR TODOS OS PRODUTOS (Debug)
-- Use para ver produtos existentes
SELECT id, key, name, description, sectors
FROM products
ORDER BY created_at DESC
LIMIT 10;


-- 7. DELETAR PRODUTO DE TESTE (Cuidado!)
-- Substitua 'teste-produto' pela key do produto
DELETE FROM products WHERE key = 'teste-produto';


-- 8. CRIAR PRODUTO DE TESTE VIA SQL
-- Use para testar se insert funciona
INSERT INTO products (key, name, description, sectors, pricing)
VALUES (
    'produto-teste-sql',
    'Produto Teste SQL',
    'Produto criado via SQL para teste',
    ARRAY['teste'],
    '{"basePrice": 100}'::jsonb
)
RETURNING *;


-- ============================================
-- COMANDOS MAIS USADOS (COPIE ESTES)
-- ============================================

-- Apenas recarregar schema (mais comum):
NOTIFY pgrst, 'reload schema';

-- Verificar colunas:
SELECT column_name FROM information_schema.columns WHERE table_name = 'products';

-- Listar produtos:
SELECT * FROM products LIMIT 5;


-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- Se NOTIFY não funcionar, force restart do PostgREST:
-- (Geralmente não é necessário no Supabase)
-- No Supabase Dashboard, vá em Settings > API > Restart API


-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Execute sempre no SQL Editor do Supabase
-- 2. NOTIFY pgrst deve ser executado sozinho (sem transação)
-- 3. Se houver erro de permissão, use sua conta admin
-- 4. Mudanças no schema precisam de NOTIFY para refletir na API
-- 5. O código JavaScript já foi atualizado para ser mais robusto
