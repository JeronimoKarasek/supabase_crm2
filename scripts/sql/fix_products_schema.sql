-- Script para garantir que a tabela products está correta
-- Execute no SQL Editor do Supabase para atualizar o schema cache

-- Verifica se a coluna description existe e adiciona se necessário
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description text;
    END IF;
END $$;

-- Atualiza o cache do PostgREST (força reload do schema)
NOTIFY pgrst, 'reload schema';

-- Lista todas as colunas da tabela products para verificação
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
