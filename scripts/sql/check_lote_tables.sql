-- Verificar todas as tabelas relacionadas a lote
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename ILIKE '%lote%'
ORDER BY tablename;

-- Se não existir tabela 'lote', criar uma estrutura básica
-- (execute apenas se necessário)
/*
CREATE TABLE IF NOT EXISTS public.lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  cpf TEXT,
  telefone TEXT,
  "Valor liberado" NUMERIC,
  simulou BOOLEAN DEFAULT false,
  digitou BOOLEAN DEFAULT false,
  produto TEXT,
  cliente TEXT,
  "data da atualização" TIMESTAMPTZ DEFAULT NOW(),
  empresa UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar RLS
ALTER TABLE public.lote DISABLE ROW LEVEL SECURITY;
*/
