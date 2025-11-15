-- Script para adicionar tabelas à visualização de Clientes no CRM
-- Execute este script no SQL Editor do Supabase Dashboard

-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
-- 1. Abra o Supabase Dashboard
-- 2. Vá em: SQL Editor
-- 3. Cole este script
-- 4. Execute (Run)
--
-- IMPORTANTE: Substitua 'nome_da_tabela' pelos nomes reais das suas tabelas
-- ============================================

-- Exemplo de tabelas comuns que podem ser adicionadas:
-- - Carteira (contratos/propostas)
-- - Leads (leads de vendas)
-- - Atendimentos (histórico de atendimentos)
-- - Vendas (vendas realizadas)
-- - Produtos (produtos contratados)

-- ============================================
-- TEMPLATE PARA ADICIONAR UMA TABELA
-- ============================================
-- Copie e cole este bloco para cada tabela que deseja adicionar
-- Substitua:
--   - 'nome_da_tabela' pelo nome real da tabela
--   - 'Descrição da Tabela' por uma descrição amigável

DO $$
DECLARE
  table_name TEXT := 'nome_da_tabela'; -- SUBSTITUA AQUI
  table_comment TEXT := 'Descrição da Tabela'; -- SUBSTITUA AQUI
BEGIN
  -- Adiciona comentário descritivo à tabela (aparece no CRM)
  EXECUTE format('COMMENT ON TABLE %I IS %L', table_name, table_comment);
  
  RAISE NOTICE 'Tabela % adicionada com sucesso!', table_name;
END $$;


-- ============================================
-- EXEMPLOS PRONTOS (descomente para usar)
-- ============================================

-- Exemplo 1: Adicionar tabela Carteira
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Carteira" IS 'Carteira de contratos e propostas';
--   RAISE NOTICE 'Tabela Carteira adicionada!';
-- END $$;

-- Exemplo 2: Adicionar tabela Leads
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Leads" IS 'Base de leads para prospecção';
--   RAISE NOTICE 'Tabela Leads adicionada!';
-- END $$;

-- Exemplo 3: Adicionar tabela Atendimentos
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Atendimentos" IS 'Histórico de atendimentos aos clientes';
--   RAISE NOTICE 'Tabela Atendimentos adicionada!';
-- END $$;

-- Exemplo 4: Adicionar tabela Vendas
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Vendas" IS 'Registro de vendas realizadas';
--   RAISE NOTICE 'Tabela Vendas adicionada!';
-- END $$;

-- Exemplo 5: Adicionar tabela Produtos
-- DO $$
-- BEGIN
--   COMMENT ON TABLE "Produtos" IS 'Produtos contratados pelos clientes';
--   RAISE NOTICE 'Tabela Produtos adicionada!';
-- END $$;


-- ============================================
-- ADICIONAR MÚLTIPLAS TABELAS DE UMA VEZ
-- ============================================
-- Use este bloco para adicionar várias tabelas ao mesmo tempo

DO $$
DECLARE
  tables_to_add TEXT[] := ARRAY[
    'Carteira:Carteira de contratos e propostas',
    'Leads:Base de leads para prospecção',
    'Atendimentos:Histórico de atendimentos'
    -- Adicione mais no formato 'nome_tabela:descrição'
  ];
  table_info TEXT;
  table_name TEXT;
  table_desc TEXT;
BEGIN
  FOREACH table_info IN ARRAY tables_to_add
  LOOP
    table_name := split_part(table_info, ':', 1);
    table_desc := split_part(table_info, ':', 2);
    
    EXECUTE format('COMMENT ON TABLE %I IS %L', table_name, table_desc);
    RAISE NOTICE 'Tabela % adicionada: %', table_name, table_desc;
  END LOOP;
  
  RAISE NOTICE 'Todas as tabelas foram adicionadas com sucesso!';
END $$;


-- ============================================
-- VERIFICAR TABELAS DISPONÍVEIS
-- ============================================
-- Execute esta query para ver todas as tabelas no schema público

SELECT 
  table_name as "Tabela",
  obj_description((table_schema||'.'||table_name)::regclass) as "Descrição"
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT IN (
    'global_settings',
    'bank_credentials',
    'bank_user_credentials',
    'sms_disparo',
    'lote_items',
    'user_credits',
    'empresa',
    'empresa_users'
  )
ORDER BY table_name;


-- ============================================
-- CONFIGURAR PERMISSÕES RLS (Row Level Security)
-- ============================================
-- Depois de adicionar as tabelas, configure as permissões RLS
-- para garantir que usuários vejam apenas seus próprios dados

-- Exemplo para tabela Carteira:
-- ALTER TABLE "Carteira" ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Users can view own records"
--   ON "Carteira"
--   FOR SELECT
--   USING (auth.uid() = user_id);
-- 
-- CREATE POLICY "Users can insert own records"
--   ON "Carteira"
--   FOR INSERT
--   WITH CHECK (auth.uid() = user_id);


-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. As tabelas precisam existir antes de adicionar comentários
-- 2. O CRM lista automaticamente tabelas com comentários
-- 3. Usuários veem apenas tabelas com permissões adequadas
-- 4. Configure RLS para segurança multi-tenant
-- 5. Teste com um usuário não-admin após configurar
