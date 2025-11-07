-- Tabela para credenciais Kolmeya SMS
CREATE TABLE IF NOT EXISTS kolmeya_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  api_token TEXT NOT NULL,
  sms_api_id INTEGER,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kolmeya_credentials_user_id_idx ON kolmeya_credentials(user_id);

-- Tabela para disparos de SMS
CREATE TABLE IF NOT EXISTS sms_disparo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES kolmeya_credentials(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  request_id TEXT, -- ID retornado pela API Kolmeya
  phone TEXT NOT NULL,
  name TEXT,
  cpf TEXT,
  message TEXT NOT NULL,
  reference TEXT,
  tenant_segment_id INTEGER,
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, failed, blacklist, not_disturb
  status_code INTEGER,
  error_message TEXT,
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sms_disparo_user_id_idx ON sms_disparo(user_id);
CREATE INDEX IF NOT EXISTS sms_disparo_batch_id_idx ON sms_disparo(batch_id);
CREATE INDEX IF NOT EXISTS sms_disparo_status_idx ON sms_disparo(status);
CREATE INDEX IF NOT EXISTS sms_disparo_request_id_idx ON sms_disparo(request_id);

-- RLS policies
ALTER TABLE kolmeya_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_disparo ENABLE ROW LEVEL SECURITY;

CREATE POLICY kolmeya_credentials_user_policy ON kolmeya_credentials
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY sms_disparo_user_policy ON sms_disparo
  FOR ALL USING (auth.uid() = user_id);
