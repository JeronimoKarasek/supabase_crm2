-- Script para remover tabelas da visualização do CRM
-- Execute este script no SQL Editor do Supabase Dashboard

-- ============================================
-- OPÇÃO 1: Desabilitar temporariamente (RECOMENDADO)
-- ============================================
-- Mantém o registro mas oculta do CRM

-- Desabilitar uma tabela específica
UPDATE public.crm_tables
SET is_active = false,
    updated_at = NOW()
WHERE table_name = 'disparo_crm_api';

-- Desabilitar múltiplas tabelas
UPDATE public.crm_tables
SET is_active = false,
    updated_at = NOW()
WHERE table_name IN ('disparo_crm_api', 'Carteira', 'Leads');


-- ============================================
-- OPÇÃO 2: Remover permanentemente
-- ============================================
-- ⚠️ CUIDADO: Isso apaga o registro da tabela crm_tables
-- A tabela real no banco NÃO será afetada

-- Remover uma tabela específica
DELETE FROM public.crm_tables
WHERE table_name = 'disparo_crm_api';

-- Remover múltiplas tabelas
DELETE FROM public.crm_tables
WHERE table_name IN ('disparo_crm_api', 'Carteira', 'Leads');


-- ============================================
-- OPÇÃO 3: Remover TODAS as tabelas
-- ============================================
-- ⚠️ EXTREMO CUIDADO: Remove todos os registros

-- Desabilitar todas
-- UPDATE public.crm_tables
-- SET is_active = false,
--     updated_at = NOW();

-- Deletar todas
-- DELETE FROM public.crm_tables;


-- ============================================
-- REATIVAR TABELAS DESABILITADAS
-- ============================================

-- Reativar uma tabela específica
UPDATE public.crm_tables
SET is_active = true,
    updated_at = NOW()
WHERE table_name = 'disparo_crm_api';

-- Reativar todas
UPDATE public.crm_tables
SET is_active = true,
    updated_at = NOW();


-- ============================================
-- LISTAR TABELAS POR STATUS
-- ============================================

-- Tabelas ativas
SELECT 
  table_name as "Tabela",
  display_name as "Nome Exibido",
  description as "Descrição"
FROM public.crm_tables
WHERE is_active = true
ORDER BY display_name;

-- Tabelas desabilitadas
SELECT 
  table_name as "Tabela",
  display_name as "Nome Exibido",
  description as "Descrição"
FROM public.crm_tables
WHERE is_active = false
ORDER BY display_name;

-- Todas as tabelas com status
SELECT 
  table_name as "Tabela",
  display_name as "Nome Exibido",
  CASE 
    WHEN is_active THEN '✅ Ativa' 
    ELSE '❌ Desabilitada' 
  END as "Status",
  description as "Descrição",
  created_at as "Criada em",
  updated_at as "Atualizada em"
FROM public.crm_tables
ORDER BY is_active DESC, display_name;


-- ============================================
-- REMOVER POLÍTICAS RLS DE UMA TABELA
-- ============================================
-- Se você quer remover as permissões de uma tabela:

-- Exemplo para disparo_crm_api:
-- DROP POLICY IF EXISTS "Users can view own records" ON public.disparo_crm_api;
-- DROP POLICY IF EXISTS "Users can insert own records" ON public.disparo_crm_api;
-- DROP POLICY IF EXISTS "Users can update own records" ON public.disparo_crm_api;
-- 
-- -- Desabilitar RLS completamente (⚠️ CUIDADO: expõe todos os dados)
-- ALTER TABLE public.disparo_crm_api DISABLE ROW LEVEL SECURITY;


-- ============================================
-- LIMPAR COMPLETAMENTE (RESETAR TUDO)
-- ============================================
-- ⚠️ EXTREMO CUIDADO: Isso remove a tabela crm_tables do banco

-- DROP TABLE IF EXISTS public.crm_tables CASCADE;


-- ============================================
-- RESTAURAR TABELA REMOVIDA
-- ============================================
-- Se você deletou uma tabela por engano:

-- INSERT INTO public.crm_tables (table_name, display_name, description)
-- VALUES ('disparo_crm_api', 'BASE GERAL DISPARO', 'Base de dados para disparo via API')
-- ON CONFLICT (table_name) DO UPDATE 
-- SET display_name = EXCLUDED.display_name,
--     description = EXCLUDED.description,
--     is_active = true,
--     updated_at = NOW();


-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. DESABILITAR (is_active = false) é REVERSÍVEL
-- 2. DELETAR (DELETE FROM) é PERMANENTE (mas pode re-inserir)
-- 3. Remover de crm_tables NÃO afeta a tabela real no banco
-- 4. Remover de crm_tables NÃO afeta os dados existentes
-- 5. Use DESABILITAR quando não tiver certeza
-- 6. Sempre faça backup antes de operações destrutivas
