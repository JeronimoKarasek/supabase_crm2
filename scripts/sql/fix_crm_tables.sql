-- Script de correção para a tabela crm_tables
-- Execute este script no SQL Editor do Supabase Dashboard

-- ============================================
-- PASSO 1: Verificar estrutura atual da tabela
-- ============================================

-- Primeiro, vamos ver como a tabela está agora
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crm_tables' 
  AND table_schema = 'public';

-- ============================================
-- PASSO 2: Deletar tabela antiga e recriar (OPÇÃO 1 - RECOMENDADA)
-- ============================================
-- ⚠️ Isso vai apagar todos os dados existentes na tabela

DROP TABLE IF EXISTS public.crm_tables CASCADE;

-- Recriar a tabela com a estrutura correta
CREATE TABLE public.crm_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar índice para performance
CREATE INDEX idx_crm_tables_active ON public.crm_tables(is_active);

-- Comentário descritivo
COMMENT ON TABLE public.crm_tables IS 'Tabelas disponíveis para visualização no CRM';

-- ============================================
-- PASSO 3: Configurar permissões RLS
-- ============================================

ALTER TABLE public.crm_tables ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler (necessário para o CRM)
CREATE POLICY "Anyone can read crm_tables"
  ON public.crm_tables
  FOR SELECT
  USING (true);

-- ============================================
-- PASSO 4: Adicionar suas tabelas
-- ============================================

INSERT INTO public.crm_tables (table_name, display_name, description) VALUES
  ('disparo_crm_api', 'BASE GERAL DISPARO', 'Base de dados para disparo via API'),
  ('Carteira', 'Carteira', 'Carteira de contratos e propostas')
ON CONFLICT (table_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================
-- VERIFICAR RESULTADO
-- ============================================

SELECT * FROM public.crm_tables ORDER BY display_name;
