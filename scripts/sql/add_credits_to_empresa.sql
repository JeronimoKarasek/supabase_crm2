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
