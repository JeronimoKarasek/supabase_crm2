-- Tabela dedicada para tracking de lotes
-- Garante que lotes NUNCA desapareçam da listagem

CREATE TABLE IF NOT EXISTS lotes (
  id TEXT PRIMARY KEY, -- lote_id gerado no frontend
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  
  -- Informações do lote
  produto TEXT NOT NULL,
  banco_key TEXT NOT NULL,
  banco_name TEXT NOT NULL,
  
  -- Status do lote
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | processando | concluido | erro
  
  -- Contadores
  total_registros INT DEFAULT 0,
  registros_consultados INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- quando começou processamento
  completed_at TIMESTAMPTZ, -- quando terminou
  
  -- Metadados
  webhook_url TEXT,
  error_message TEXT
);

-- Criar índices separadamente (sintaxe correta do PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_lotes_user_created ON lotes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_user_email ON lotes (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes (status);

-- RLS: Usuários só veem seus próprios lotes
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lotes"
  ON lotes
  FOR SELECT
  USING (auth.uid() = user_id OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own lotes"
  ON lotes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own lotes"
  ON lotes
  FOR UPDATE
  USING (auth.uid() = user_id OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Service role pode fazer tudo (para webhooks)
CREATE POLICY "Service role can manage all lotes"
  ON lotes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para auto-update do updated_at
CREATE OR REPLACE FUNCTION update_lotes_updated_at()
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

-- Comentários
COMMENT ON TABLE lotes IS 'Tracking permanente de lotes de consulta - nunca são deletados automaticamente';
COMMENT ON COLUMN lotes.id IS 'ID único do lote (formato: timestamp_random)';
COMMENT ON COLUMN lotes.total_registros IS 'Número total de registros no lote';
COMMENT ON COLUMN lotes.registros_consultados IS 'Número de registros já consultados (para progresso)';
COMMENT ON COLUMN lotes.status IS 'pendente: aguardando | processando: em andamento | concluido: 100% | erro: falha no processamento';

-- Migração: Criar lotes para registros existentes (executar apenas uma vez)
INSERT INTO lotes (id, user_id, user_email, produto, banco_key, banco_name, status, total_registros, created_at)
SELECT DISTINCT ON (i.lote_id)
  i.lote_id,
  u.id,
  i.cliente,
  i.produto,
  COALESCE(
    (SELECT key FROM jsonb_to_recordset((SELECT data->'banks' FROM global_settings WHERE id = 'global')) AS x(key TEXT, name TEXT) WHERE name = i.banco_simulado LIMIT 1),
    i.banco_simulado
  ) as banco_key,
  i.banco_simulado,
  'pendente',
  (SELECT COUNT(*) FROM importar WHERE lote_id = i.lote_id),
  MIN(i.created_at)
FROM importar i
LEFT JOIN auth.users u ON u.email = i.cliente
WHERE i.lote_id IS NOT NULL
GROUP BY i.lote_id, u.id, i.cliente, i.produto, i.banco_simulado
ON CONFLICT (id) DO NOTHING;

-- Atualizar progresso dos lotes existentes
UPDATE lotes
SET 
  registros_consultados = (
    SELECT COUNT(*) FROM importar 
    WHERE lote_id = lotes.id AND consultado = true
  ),
  status = CASE 
    WHEN (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id AND consultado = true) = total_registros THEN 'concluido'
    WHEN (SELECT COUNT(*) FROM importar WHERE lote_id = lotes.id AND consultado = true) > 0 THEN 'processando'
    ELSE 'pendente'
  END;
