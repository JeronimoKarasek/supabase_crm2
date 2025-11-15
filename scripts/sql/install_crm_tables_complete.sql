-- ============================================================
-- INSTALAÇÃO COMPLETA DO SISTEMA CRM_TABLES
-- ============================================================
-- Execute este script no Supabase SQL Editor para:
-- 1. Recriar a tabela crm_tables com estrutura correta
-- 2. Criar a função RPC para listar tabelas
-- 3. Adicionar tabelas iniciais
-- 4. Configurar permissões RLS
-- ============================================================

-- ============================================================
-- PASSO 1: RECRIAR TABELA CRM_TABLES
-- ============================================================

-- Remove tabela antiga se existir
DROP TABLE IF EXISTS public.crm_tables CASCADE;

-- Cria tabela nova com estrutura correta
CREATE TABLE public.crm_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para performance
CREATE INDEX idx_crm_tables_active ON public.crm_tables(is_active);
CREATE INDEX idx_crm_tables_name ON public.crm_tables(table_name);

-- ============================================================
-- PASSO 2: INSERIR TABELAS INICIAIS
-- ============================================================

INSERT INTO public.crm_tables (table_name, display_name, description, is_active) VALUES
  ('clientes', 'Clientes', 'Cadastro principal de clientes do CRM', true),
  ('empresas', 'Empresas', 'Empresas cadastradas no sistema multi-tenant', true),
  ('usuarios', 'Usuários', 'Usuários do sistema com permissões e setores', true),
  ('disparo_sms', 'Disparos SMS', 'Histórico de campanhas de SMS enviadas', true),
  ('lote', 'Consultas em Lote', 'Lotes de consultas importadas via CSV', true)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================
-- PASSO 3: CRIAR FUNÇÃO RPC
-- ============================================================

-- Remove função existente primeiro (se existir)
DROP FUNCTION IF EXISTS public.rpc_list_crm_tables();

-- Cria função nova
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
-- PASSO 4: CONFIGURAR PERMISSÕES
-- ============================================================

-- RLS na tabela
ALTER TABLE public.crm_tables ENABLE ROW LEVEL SECURITY;

-- Política: Todos autenticados podem ler
CREATE POLICY "Permitir leitura de tabelas CRM"
  ON public.crm_tables
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Apenas admins podem modificar
CREATE POLICY "Apenas admins podem modificar tabelas CRM"
  ON public.crm_tables
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Permissões na função RPC
GRANT EXECUTE ON FUNCTION public.rpc_list_crm_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_list_crm_tables() TO service_role;

-- ============================================================
-- PASSO 5: COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE public.crm_tables IS 'Controle de tabelas visíveis no CRM';
COMMENT ON COLUMN public.crm_tables.table_name IS 'Nome da tabela no banco (deve corresponder à tabela real)';
COMMENT ON COLUMN public.crm_tables.display_name IS 'Nome amigável exibido na interface';
COMMENT ON COLUMN public.crm_tables.description IS 'Descrição opcional da finalidade da tabela';
COMMENT ON COLUMN public.crm_tables.is_active IS 'Se false, a tabela não aparece no CRM';
COMMENT ON FUNCTION public.rpc_list_crm_tables() IS 'Lista todas as tabelas ativas configuradas no CRM';

-- ============================================================
-- FIM DA INSTALAÇÃO
-- ============================================================

SELECT 'Instalação concluída! Sistema crm_tables configurado com sucesso.' AS status;
