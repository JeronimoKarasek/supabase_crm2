-- Adiciona coluna base_filename na tabela lote_items
-- Executar no Supabase SQL Editor

ALTER TABLE lote_items 
ADD COLUMN IF NOT EXISTS base_filename TEXT;

-- Criar índice para performance em buscas por lote_id
CREATE INDEX IF NOT EXISTS idx_lote_items_lote_id ON lote_items(lote_id);

COMMENT ON COLUMN lote_items.base_filename IS 'Nome do arquivo CSV original do lote';
