-- ============================================================
-- SOLUÇÃO: Desabilitar RLS nas tabelas do CRM
-- ============================================================
-- Execute no Supabase SQL Editor
-- Isso permite que service_role (usado pela API) acesse todos os dados
-- ============================================================

-- Opção 1: Desabilitar RLS completamente (recomendado para CRM interno)
ALTER TABLE public."carteira" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."lote_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Clientes_IA" DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Opção 2 (alternativa): Manter RLS mas criar política para service_role
-- ============================================================
-- Se preferir manter RLS ativo e criar política específica:

/*
-- Política para carteira
CREATE POLICY "Service role has full access to carteira"
  ON public."carteira"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política para lote_items
CREATE POLICY "Service role has full access to lote_items"
  ON public."lote_items"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política para Clientes_IA
CREATE POLICY "Service role has full access to Clientes_IA"
  ON public."Clientes_IA"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
*/

-- ============================================================
-- Verificar se funcionou
-- ============================================================
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('carteira', 'lote_items', 'Clientes_IA')
ORDER BY tablename;
