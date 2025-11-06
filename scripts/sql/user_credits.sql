-- Tabela para persistir saldo de créditos dos usuários
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_user_credits_updated_at ON user_credits(updated_at DESC);

-- RLS (Row Level Security) - opcional, ajuste conforme necessário
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler seu próprio saldo
CREATE POLICY "Users can read own balance"
  ON user_credits
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Política: apenas service_role pode modificar (via backend)
-- (não precisa de policy adicional, service_role bypassa RLS)

-- Comentários
COMMENT ON TABLE user_credits IS 'Saldo de créditos em centavos para cada usuário';
COMMENT ON COLUMN user_credits.user_id IS 'UUID do usuário (auth.users.id)';
COMMENT ON COLUMN user_credits.balance_cents IS 'Saldo em centavos (ex: 1000 = R$ 10,00)';
COMMENT ON COLUMN user_credits.updated_at IS 'Última atualização do saldo';
