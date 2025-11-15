-- Script para adicionar tabelas à visualização do CRM
-- Execute este script no SQL Editor do Supabase Dashboard

-- ============================================
-- PASSO 1: Criar tabela crm_tables (se não existir)
-- ============================================
-- Esta tabela armazena a lista de tabelas visíveis no CRM

CREATE TABLE IF NOT EXISTS public.crm_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_crm_tables_active ON public.crm_tables(is_active);

-- Comentário descritivo
COMMENT ON TABLE public.crm_tables IS 'Tabelas disponíveis para visualização no CRM';


-- ============================================
-- PASSO 2: Adicionar suas tabelas
-- ============================================
-- Formato: (nome_tabela_real, nome_exibição, descrição)

-- Exemplo 1: Base Geral Disparo
INSERT INTO public.crm_tables (table_name, display_name, description)
VALUES ('disparo_crm_api', 'BASE GERAL DISPARO', 'Base de dados para disparo via API')
ON CONFLICT (table_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Exemplo 2: Carteira
INSERT INTO public.crm_tables (table_name, display_name, description)
VALUES ('Carteira', 'Carteira', 'Carteira de contratos e propostas')
ON CONFLICT (table_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Exemplo 3: Leads
INSERT INTO public.crm_tables (table_name, display_name, description)
VALUES ('Leads', 'Leads', 'Base de leads para prospecção')
ON CONFLICT (table_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Exemplo 4: Atendimentos
INSERT INTO public.crm_tables (table_name, display_name, description)
VALUES ('Atendimentos', 'Atendimentos', 'Histórico de atendimentos aos clientes')
ON CONFLICT (table_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();


-- ============================================
-- TEMPLATE PARA ADICIONAR NOVAS TABELAS
-- ============================================
-- Copie e cole este bloco para cada nova tabela:

-- INSERT INTO public.crm_tables (table_name, display_name, description)
-- VALUES ('nome_tabela_real', 'Nome para Exibir', 'Descrição da tabela')
-- ON CONFLICT (table_name) DO UPDATE 
-- SET display_name = EXCLUDED.display_name,
--     description = EXCLUDED.description,
--     updated_at = NOW();


-- ============================================
-- PASSO 3: Adicionar múltiplas tabelas de uma vez
-- ============================================
-- Use este bloco para adicionar várias tabelas ao mesmo tempo

INSERT INTO public.crm_tables (table_name, display_name, description) VALUES
  ('disparo_crm_api', 'BASE GERAL DISPARO', 'Base de dados para disparo via API'),
  ('Carteira', 'Carteira', 'Carteira de contratos e propostas'),
  ('Leads', 'Leads', 'Base de leads para prospecção'),
  ('Atendimentos', 'Atendimentos', 'Histórico de atendimentos'),
  ('Vendas', 'Vendas', 'Registro de vendas realizadas'),
  ('Produtos', 'Produtos Contratados', 'Produtos contratados pelos clientes')
ON CONFLICT (table_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();


-- ============================================
-- PASSO 4: Configurar permissões RLS
-- ============================================
-- Habilitar Row Level Security na tabela crm_tables

ALTER TABLE public.crm_tables ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler (necessário para o CRM)
CREATE POLICY "Anyone can read crm_tables"
  ON public.crm_tables
  FOR SELECT
  USING (true);

-- Política: Apenas admins podem modificar (opcional)
CREATE POLICY "Only admins can modify crm_tables"
  ON public.crm_tables
  FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT unnest(string_to_array(
        (SELECT data->>'adminEmails' FROM public.global_settings WHERE id = 'global'),
        ','
      ))
    )
  );


-- ============================================
-- PASSO 5: Configurar permissões nas tabelas referenciadas
-- ============================================
-- Exemplo para a tabela disparo_crm_api

-- Habilitar RLS
ALTER TABLE public.disparo_crm_api ENABLE ROW LEVEL SECURITY;

-- Política: Usuários veem apenas seus próprios registros
CREATE POLICY "Users can view own records"
  ON public.disparo_crm_api
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    -- Ou se for multi-tenant por empresa
    auth.uid() IN (
      SELECT user_id FROM public.empresa_users 
      WHERE empresa_id = disparo_crm_api.empresa_id
    )
  );

-- Política: Usuários podem inserir seus próprios registros
CREATE POLICY "Users can insert own records"
  ON public.disparo_crm_api
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar seus próprios registros
CREATE POLICY "Users can update own records"
  ON public.disparo_crm_api
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================
-- QUERIES ÚTEIS
-- ============================================

-- Listar todas as tabelas cadastradas no CRM
SELECT 
  table_name as "Tabela Real",
  display_name as "Nome Exibido",
  description as "Descrição",
  is_active as "Ativa",
  created_at as "Criada em"
FROM public.crm_tables
WHERE is_active = true
ORDER BY display_name;


-- Verificar se uma tabela existe no banco
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name = 'disparo_crm_api'
) as "Tabela Existe";


-- Listar colunas de uma tabela específica
SELECT 
  column_name as "Coluna",
  data_type as "Tipo",
  is_nullable as "Permite NULL"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'disparo_crm_api'
ORDER BY ordinal_position;


-- Verificar políticas RLS de uma tabela
SELECT 
  schemaname as "Schema",
  tablename as "Tabela",
  policyname as "Política",
  permissive as "Permissiva",
  roles as "Roles",
  cmd as "Comando",
  qual as "Condição USING",
  with_check as "Condição WITH CHECK"
FROM pg_policies
WHERE tablename = 'disparo_crm_api';


-- ============================================
-- DESABILITAR UMA TABELA (sem deletar)
-- ============================================
-- Para ocultar temporariamente uma tabela do CRM:

-- UPDATE public.crm_tables
-- SET is_active = false
-- WHERE table_name = 'nome_da_tabela';


-- ============================================
-- REATIVAR UMA TABELA
-- ============================================
-- UPDATE public.crm_tables
-- SET is_active = true
-- WHERE table_name = 'nome_da_tabela';


-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. table_name deve ser o nome REAL da tabela no banco
-- 2. display_name é o nome que aparece no CRM (pode ser diferente)
-- 3. Configure RLS em TODAS as tabelas para segurança
-- 4. Teste com um usuário não-admin após configurar
-- 5. Use ON CONFLICT para evitar duplicatas
-- 6. As tabelas precisam existir antes de adicionar ao CRM
