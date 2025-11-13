-- ================================================
-- Migração: Renomear tabela 'importar' → 'lote_items'
-- Data: 13 de novembro de 2025
-- ================================================

-- 1. Renomear tabela
ALTER TABLE importar RENAME TO lote_items;

-- 2. Renomear índices existentes (se houver)
-- Exemplo: se havia índice idx_importar_lote_id, renomeie
DO $$
DECLARE
    idx_name text;
BEGIN
    FOR idx_name IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'lote_items' 
        AND indexname LIKE '%importar%'
    LOOP
        EXECUTE format('ALTER INDEX %I RENAME TO %I', 
            idx_name, 
            replace(idx_name, 'importar', 'lote_items')
        );
    END LOOP;
END $$;

-- 3. Atualizar RLS policies (se existirem)
-- Exemplo: se havia policy "Usuários podem ver importar", renomeie
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'lote_items'
    LOOP
        -- Policies são recriadas automaticamente ao renomear tabela
        -- Nenhuma ação adicional necessária
        NULL;
    END LOOP;
END $$;

-- 4. Atualizar triggers (se existirem)
-- Se havia trigger relacionado à tabela importar, será necessário ajustar manualmente

-- 5. Confirmar estrutura
SELECT 
    'lote_items' as nova_tabela,
    COUNT(*) as total_registros,
    COUNT(DISTINCT lote_id) as total_lotes
FROM lote_items;

-- ================================================
-- IMPORTANTE: Executar este script no Supabase SQL Editor
-- Após executar, atualizar código da aplicação para usar 'lote_items'
-- ================================================
