-- Tabela para gerenciar assinaturas com cobrança recorrente via créditos
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS product_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  credit_price_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  next_charge_date DATE NOT NULL,
  last_charge_date DATE,
  last_charge_status TEXT,
  failed_charges INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'cancelled', 'expired'))
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_user_id ON product_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_product_id ON product_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_next_charge ON product_subscriptions(next_charge_date) 
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_product_subscriptions_status ON product_subscriptions(status);

-- RLS (Row Level Security)
ALTER TABLE product_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ler suas próprias assinaturas
DROP POLICY IF EXISTS "Users can read own subscriptions" ON product_subscriptions;
CREATE POLICY "Users can read own subscriptions"
  ON product_subscriptions
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Comentários
COMMENT ON TABLE product_subscriptions IS 'Assinaturas ativas de produtos com cobrança recorrente via créditos';
COMMENT ON COLUMN product_subscriptions.user_id IS 'UUID do usuário assinante';
COMMENT ON COLUMN product_subscriptions.product_id IS 'ID do produto assinado';
COMMENT ON COLUMN product_subscriptions.credit_price_cents IS 'Valor em centavos a ser cobrado mensalmente';
COMMENT ON COLUMN product_subscriptions.status IS 'active=ativo, paused=pausado sem saldo, cancelled=cancelado, expired=expirado';
COMMENT ON COLUMN product_subscriptions.next_charge_date IS 'Data da próxima cobrança mensal';
COMMENT ON COLUMN product_subscriptions.last_charge_date IS 'Data da última cobrança executada';
COMMENT ON COLUMN product_subscriptions.last_charge_status IS 'success, failed, insufficient_balance';
COMMENT ON COLUMN product_subscriptions.failed_charges IS 'Contador de cobranças falhadas consecutivas';

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_product_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_subscriptions_updated_at
  BEFORE UPDATE ON product_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_product_subscriptions_updated_at();
