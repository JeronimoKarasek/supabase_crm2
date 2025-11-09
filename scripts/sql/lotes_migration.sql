-- Script de migração para tabela 'lotes' existente
-- Execute este script se a tabela já existe

-- 1. Criar índices (se não existirem)
CREATE INDEX IF NOT EXISTS idx_lotes_user_created ON lotes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_user_email ON lotes (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes (status);

-- 2. Habilitar RLS (se ainda não estiver)
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas (drop se existir, então recria)
-- Usa user_email para evitar problemas de cast entre UUID e TEXT
DROP POLICY IF EXISTS "Users can view their own lotes" ON lotes;
CREATE POLICY "Users can view their own lotes"
  ON lotes
  FOR SELECT
  USING (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own lotes" ON lotes;
CREATE POLICY "Users can insert their own lotes"
  ON lotes
  FOR INSERT
  WITH CHECK (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their own lotes" ON lotes;
CREATE POLICY "Users can update their own lotes"
  ON lotes
  FOR UPDATE
  USING (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Service role pode fazer tudo (para webhooks e API)
DROP POLICY IF EXISTS "Service role can manage all lotes" ON lotes;
CREATE POLICY "Service role can manage all lotes"
  ON lotes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Criar função de trigger (drop se existir)
DROP TRIGGER IF EXISTS lotes_updated_at ON lotes;
DROP FUNCTION IF EXISTS update_lotes_updated_at();

CREATE FUNCTION update_lotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lotes_updated_at
  BEFORE UPDATE ON lotes
  FOR EACH ROW
  EXECUTE FUNCTION update_lotes_updated_at();

-- 5. Migração: Criar lotes para registros existentes da tabela importar
-- NOTA: A tabela lotes tem id do tipo bigint (autoincrement)
-- Não podemos inserir lote_id (que é text) diretamente no id (bigint)
-- Vamos apenas garantir que existe um mapeamento

-- Como a tabela lotes parece ser auto-increment e não aceita nosso lote_id customizado,
-- vamos pular a migração de dados antigos e deixar que novos lotes sejam criados
-- pela API a partir de agora

-- Se precisar realmente migrar dados antigos, precisaria:
-- 1. Criar coluna lote_id_externo TEXT na tabela lotes
-- 2. Inserir dados usando id auto-increment
-- 3. Armazenar referência em lote_id_externo

SELECT 'Migração de dados antigos pulada - tabela lotes usa id auto-increment' as info;

-- 6. Atualizar campos adicionais (se existirem na tabela)
-- Descomente as linhas conforme as colunas disponíveis na sua tabela

-- Se tiver coluna 'produto':
-- UPDATE lotes l
-- SET produto = (SELECT i.produto FROM importar i WHERE i.lote_id = l.id LIMIT 1)
-- WHERE EXISTS (SELECT 1 FROM importar WHERE lote_id = l.id);

-- Se tiver colunas de progresso:
-- UPDATE lotes
-- SET 
--   registros_consultados = (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id AND consultado = true),
--   total_registros = (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id)
-- WHERE EXISTS (SELECT 1 FROM importar WHERE lote_id = lotes.id);

-- Se tiver coluna 'status':
-- UPDATE lotes
-- SET status = CASE 
--   WHEN (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id AND consultado = true) = 
--        (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id) THEN 'concluido'
--   WHEN (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id AND consultado = true) > 0 THEN 'processando'
--   ELSE 'pendente'
-- END
-- WHERE EXISTS (SELECT 1 FROM importar WHERE lote_id = lotes.id);

-- 7. Adicionar comentários
COMMENT ON TABLE lotes IS 'Tracking permanente de lotes de consulta - nunca são deletados automaticamente';
COMMENT ON COLUMN lotes.id IS 'ID único do lote (formato: timestamp_random)';

-- Verificar resultado da migração
SELECT 
  COUNT(*) as total_lotes,
  MIN(created_at) as primeiro_lote,
  MAX(created_at) as ultimo_lote
FROM lotes;
