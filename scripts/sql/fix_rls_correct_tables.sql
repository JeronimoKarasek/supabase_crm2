-- ============================================================
-- Desabilitar RLS nas tabelas CORRETAS do CRM
-- ============================================================

-- Desabilitar RLS nas 3 tabelas principais
ALTER TABLE public."Carteira" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."lote_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Clientes_IA" DISABLE ROW LEVEL SECURITY;

-- Verificar se funcionou
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Carteira', 'lote_items', 'Clientes_IA')
ORDER BY tablename;
