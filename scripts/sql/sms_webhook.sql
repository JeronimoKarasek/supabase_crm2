-- Tabela para armazenar eventos do webhook SMS Kolmeya
CREATE TABLE IF NOT EXISTS sms_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT,
  status TEXT,
  phone TEXT,
  message TEXT,
  segment_id INTEGER,
  error_code TEXT,
  error_message TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_sms_webhook_event_id ON sms_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_sms_webhook_status ON sms_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_sms_webhook_phone ON sms_webhook_events(phone);
CREATE INDEX IF NOT EXISTS idx_sms_webhook_created_at ON sms_webhook_events(created_at DESC);

-- Comentários para documentação
COMMENT ON TABLE sms_webhook_events IS 'Armazena eventos recebidos do webhook da Kolmeya SMS';
COMMENT ON COLUMN sms_webhook_events.event_id IS 'ID da mensagem na Kolmeya';
COMMENT ON COLUMN sms_webhook_events.status IS 'Status da mensagem: sent, delivered, failed, etc';
COMMENT ON COLUMN sms_webhook_events.phone IS 'Número de telefone destinatário';
COMMENT ON COLUMN sms_webhook_events.segment_id IS 'ID do centro de custo';
COMMENT ON COLUMN sms_webhook_events.raw_data IS 'Payload completo do webhook em JSON';

-- Habilitar RLS (Row Level Security)
ALTER TABLE sms_webhook_events ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver todos os registros
CREATE POLICY "Admins can view all webhook events" ON sms_webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Política: Sistema pode inserir (sem autenticação para webhook)
CREATE POLICY "System can insert webhook events" ON sms_webhook_events
  FOR INSERT
  WITH CHECK (true);
