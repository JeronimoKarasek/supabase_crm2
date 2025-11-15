-- Script para remover tabelas da visualização de Clientes no CRM
-- Execute este script no SQL Editor do Supabase Dashboard

-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
-- 1. Abra o Supabase Dashboard
-- 2. Vá em: SQL Editor
-- 3. Cole este script
-- 4. Execute (Run)
--
-- IMPORTANTE: Este script remove apenas a VISUALIZAÇÃO no CRM
-- Os dados da tabela NÃO serão deletados
-- ============================================

-- ============================================
-- REMOVER COMENTÁRIO DE UMA TABELA
-- ============================================
-- Remover o comentário faz a tabela desaparecer da lista de Clientes

DO $$
DECLARE
  table_name TEXT := 'nome_da_tabela'; -- SUBSTITUA pelo nome da tabela
BEGIN
  -- Remove o comentário da tabela (oculta do CRM)
  EXECUTE format('COMMENT ON TABLE %I IS NULL', table_name);
  
  RAISE NOTICE 'Tabela % removida da visualização!', table_name;
END $$;


-- ============================================
-- EXEMPLOS PRONTOS (descomente para usar)
-- ============================================

-- Exemplo 1: Remover tabela Carteira
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Carteira" IS NULL;
--   RAISE NOTICE 'Tabela Carteira removida da visualização!';
-- END $$;

-- Exemplo 2: Remover tabela Leads
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Leads" IS NULL;
--   RAISE NOTICE 'Tabela Leads removida da visualização!';
-- END $$;

-- Exemplo 3: Remover tabela Atendimentos
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Atendimentos" IS NULL;
--   RAISE NOTICE 'Tabela Atendimentos removida da visualização!';
-- END $$;


-- ============================================
-- REMOVER MÚLTIPLAS TABELAS DE UMA VEZ
-- ============================================
-- Use este bloco para remover várias tabelas ao mesmo tempo

DO $$
DECLARE
  tables_to_remove TEXT[] := ARRAY[
    'Carteira',
    'Leads',
    'Atendimentos'
    -- Adicione mais nomes de tabelas aqui
  ];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY tables_to_remove
  LOOP
    EXECUTE format('COMMENT ON TABLE %I IS NULL', table_name);
    RAISE NOTICE 'Tabela % removida da visualização', table_name;
  END LOOP;
  
  RAISE NOTICE 'Todas as tabelas foram removidas da visualização!';
END $$;


-- ============================================
-- LISTAR TABELAS ATUALMENTE VISÍVEIS NO CRM
-- ============================================
-- Execute esta query para ver quais tabelas estão visíveis

SELECT 
  table_name as "Tabela Visível",
  obj_description((table_schema||'.'||table_name)::regclass) as "Descrição"
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND obj_description((table_schema||'.'||table_name)::regclass) IS NOT NULL
ORDER BY table_name;


-- ============================================
-- LISTAR TODAS AS TABELAS (VISÍVEIS E OCULTAS)
-- ============================================
SELECT 
  table_name as "Tabela",
  CASE 
    WHEN obj_description((table_schema||'.'||table_name)::regclass) IS NOT NULL 
    THEN 'Visível no CRM' 
    ELSE 'Oculta do CRM' 
  END as "Status",
  obj_description((table_schema||'.'||table_name)::regclass) as "Descrição"
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;


-- ============================================
-- REMOVER TODAS AS TABELAS DA VISUALIZAÇÃO
-- ============================================
-- ⚠️ CUIDADO: Este comando remove TODAS as tabelas da visualização
-- Descomente apenas se tiver certeza

-- DO $$
-- DECLARE
--   rec RECORD;
-- BEGIN
--   FOR rec IN 
--     SELECT table_name 
--     FROM information_schema.tables 
--     WHERE table_schema = 'public' 
--       AND table_type = 'BASE TABLE'
--       AND obj_description((table_schema||'.'||table_name)::regclass) IS NOT NULL
--   LOOP
--     EXECUTE format('COMMENT ON TABLE %I IS NULL', rec.table_name);
--     RAISE NOTICE 'Removida: %', rec.table_name;
--   END LOOP;
--   
--   RAISE NOTICE 'Todas as tabelas foram removidas da visualização!';
-- END $$;


-- ============================================
-- DESABILITAR RLS (Row Level Security)
-- ============================================
-- Se você também quer desabilitar as políticas de segurança:

-- ⚠️ ATENÇÃO: Isso pode expor dados!
-- Descomente apenas se necessário e com cautela

-- Exemplo para tabela Carteira:
-- ALTER TABLE "Carteira" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Users can view own records" ON "Carteira";
-- DROP POLICY IF EXISTS "Users can insert own records" ON "Carteira";


-- ============================================
-- RESTAURAR UMA TABELA REMOVIDA
-- ============================================
-- Se você removeu uma tabela por engano, adicione o comentário novamente:

-- DO $$
-- BEGIN
--   COMMENT ON TABLE "nome_da_tabela" IS 'Descrição da tabela';
--   RAISE NOTICE 'Tabela restaurada na visualização!';
-- END $$;


-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Remover comentário apenas OCULTA a tabela do CRM
-- 2. Os DADOS da tabela NÃO são apagados
-- 3. A estrutura da tabela NÃO é alterada
-- 4. Usuários perdem acesso via interface de Clientes
-- 5. APIs e consultas diretas ainda funcionam
-- 6. Para restaurar, basta adicionar o comentário novamente
