-- Sistema de Enriquecimento/Higienização de Dados
-- API: Shift Data (https://api.shiftdata.com.br)

-- Tabela para armazenar jobs de enriquecimento (similar a importar)
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id BIGSERIAL PRIMARY KEY,
  lote_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  user_id UUID,
  filename TEXT,
  status TEXT DEFAULT 'pendente',
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  credits_used NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Tabela para armazenar detalhes de cada registro enriquecido
CREATE TABLE IF NOT EXISTS enrichment_records (
  id BIGSERIAL PRIMARY KEY,
  lote_id TEXT NOT NULL,
  cpf TEXT,
  nome TEXT,
  telefone TEXT,
  email TEXT,
  -- Dados originais (antes do enriquecimento)
  original_data JSONB,
  -- Dados enriquecidos (resposta da API)
  enriched_data JSONB,
  status TEXT DEFAULT 'pending', -- pending, processing, success, failed
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_user_email ON enrichment_jobs(user_email);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_user_id ON enrichment_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_lote_id ON enrichment_jobs(lote_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_created_at ON enrichment_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_records_lote_id ON enrichment_records(lote_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_records_cpf ON enrichment_records(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrichment_records_status ON enrichment_records(status);

-- RLS (Row Level Security)
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_records ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários veem apenas seus próprios jobs
DROP POLICY IF EXISTS "Users can view their own enrichment jobs" ON enrichment_jobs;
CREATE POLICY "Users can view their own enrichment jobs" ON enrichment_jobs
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

DROP POLICY IF EXISTS "Users can insert their own enrichment jobs" ON enrichment_jobs;
CREATE POLICY "Users can insert their own enrichment jobs" ON enrichment_jobs
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::json->>'email');

DROP POLICY IF EXISTS "Users can update their own enrichment jobs" ON enrichment_jobs;
CREATE POLICY "Users can update their own enrichment jobs" ON enrichment_jobs
  FOR UPDATE
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Políticas para records (apenas visualização via lote_id)
DROP POLICY IF EXISTS "Users can view records of their jobs" ON enrichment_records;
CREATE POLICY "Users can view records of their jobs" ON enrichment_records
  FOR SELECT
  USING (
    lote_id IN (
      SELECT lote_id FROM enrichment_jobs
      WHERE user_email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

-- System/admin pode fazer tudo (para processamento em background)
DROP POLICY IF EXISTS "Service role full access to enrichment_jobs" ON enrichment_jobs;
CREATE POLICY "Service role full access to enrichment_jobs" ON enrichment_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to enrichment_records" ON enrichment_records;
CREATE POLICY "Service role full access to enrichment_records" ON enrichment_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE enrichment_jobs IS 'Jobs de enriquecimento de dados via API Shift Data';
COMMENT ON COLUMN enrichment_jobs.lote_id IS 'ID único do lote (UUID)';
COMMENT ON COLUMN enrichment_jobs.status IS 'Status: pendente, processando, concluido, erro';
COMMENT ON COLUMN enrichment_jobs.credits_used IS 'Total de créditos gastos neste lote';

COMMENT ON TABLE enrichment_records IS 'Registros individuais de cada enriquecimento';
COMMENT ON COLUMN enrichment_records.original_data IS 'Dados originais da planilha (JSONB)';
COMMENT ON COLUMN enrichment_records.enriched_data IS 'Dados retornados pela API Shift Data (JSONB)';
