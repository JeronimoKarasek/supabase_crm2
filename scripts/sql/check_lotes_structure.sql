-- Script para verificar estrutura da tabela lotes
-- Execute este primeiro para ver quais colunas existem

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'lotes'
ORDER BY ordinal_position;
