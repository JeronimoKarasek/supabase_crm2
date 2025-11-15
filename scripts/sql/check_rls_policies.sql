-- ============================================================
-- Verificar políticas RLS ativas nas tabelas
-- ============================================================
-- Execute no Supabase SQL Editor para ver quais tabelas
-- têm Row Level Security ativa que pode estar bloqueando dados
-- ============================================================

-- Verificar RLS nas tabelas principais
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('carteira', 'lote_items', 'Clientes_IA', 'clientes')
ORDER BY tablename;

-- Ver políticas ativas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('carteira', 'lote_items', 'Clientes_IA', 'clientes')
ORDER BY tablename, policyname;

-- Se as tabelas tiverem RLS e você quiser desabilitar temporariamente para admin service_role:
-- ALTER TABLE public.carteira DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lote_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.Clientes_IA DISABLE ROW LEVEL SECURITY;
