-- Tabela para tracking de requests de digitação bancária
-- Permite polling do frontend para aguardar retorno do webhook

CREATE TABLE IF NOT EXISTS digitacao_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_key TEXT NOT NULL,
  cpf TEXT NOT NULL,
  product TEXT,
  
  -- Status do request: pending | completed | error | timeout
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Dados enviados ao webhook
  payload JSONB,
  
  -- Resposta do webhook (armazenada quando webhook retornar)
  webhook_response JSONB,
  
  -- Link de formalização extraído da resposta
  formalizacao_link TEXT,
  
  -- Mensagem de erro (caso webhook retorne erro)
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Índices para queries rápidas
  INDEX idx_digitacao_user_status (user_id, status),
  INDEX idx_digitacao_created (created_at DESC)
);

-- RLS: Usuários só veem seus próprios requests
ALTER TABLE digitacao_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digitacao requests"
  ON digitacao_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own digitacao requests"
  ON digitacao_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role pode atualizar (para webhook)
CREATE POLICY "Service role can update digitacao requests"
  ON digitacao_requests
  FOR UPDATE
  USING (true);

-- Função para auto-update do updated_at
CREATE OR REPLACE FUNCTION update_digitacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER digitacao_requests_updated_at
  BEFORE UPDATE ON digitacao_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_digitacao_updated_at();

-- Comentários
COMMENT ON TABLE digitacao_requests IS 'Tracking de solicitações de digitação bancária para polling assíncrono';
COMMENT ON COLUMN digitacao_requests.status IS 'pending: aguardando webhook | completed: webhook retornou com sucesso | error: webhook retornou erro | timeout: timeout do polling';
COMMENT ON COLUMN digitacao_requests.formalizacao_link IS 'URL para formalização da proposta extraído da resposta do webhook';
