-- ============================================================
-- RPC FUNCTION: rpc_list_crm_tables
-- ============================================================
-- Função PostgreSQL que lista todas as tabelas ativas
-- do CRM configuradas na tabela crm_tables
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_list_crm_tables()
RETURNS TABLE (
  table_name TEXT,
  display_name TEXT,
  description TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.table_name,
    ct.display_name,
    ct.description
  FROM public.crm_tables ct
  WHERE ct.is_active = true
  ORDER BY ct.display_name ASC;
END;
$$;

-- ============================================================
-- PERMISSÕES
-- ============================================================
-- Permite que usuários autenticados chamem esta função
GRANT EXECUTE ON FUNCTION public.rpc_list_crm_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_list_crm_tables() TO service_role;

-- ============================================================
-- COMENTÁRIO
-- ============================================================
COMMENT ON FUNCTION public.rpc_list_crm_tables() IS 'Lista todas as tabelas ativas configuradas no CRM para visualização na interface de clientes';
