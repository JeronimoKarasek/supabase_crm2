-- ============================================================
-- Verificar se as tabelas existem e seus nomes exatos
-- ============================================================

-- Listar TODAS as tabelas do schema public
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Buscar tabelas que contenham 'cart' no nome (case insensitive)
SELECT 
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename ILIKE '%cart%'
ORDER BY tablename;

-- Buscar tabelas que contenham 'lote' no nome
SELECT 
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename ILIKE '%lote%'
ORDER BY tablename;

-- Buscar tabelas que contenham 'client' no nome
SELECT 
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename ILIKE '%client%'
ORDER BY tablename;
