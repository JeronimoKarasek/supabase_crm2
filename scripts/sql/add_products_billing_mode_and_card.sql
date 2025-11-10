-- Adicionar colunas e ajustar enum textual para métodos de pagamento e modo de cobrança
-- Execute no Supabase SQL Editor

-- billing_mode: one_time | subscription
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'one_time' CHECK (billing_mode IN ('one_time','subscription'));

-- Expandir payment_method para incluir 'card'
-- Não há enum real, usamos CHECK. Se já existir, recria a constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'products' AND column_name = 'payment_method'
  ) THEN
    BEGIN
      ALTER TABLE products DROP CONSTRAINT IF EXISTS products_payment_method_check;
    EXCEPTION WHEN undefined_object THEN NULL; END;
  END IF;
END $$;

ALTER TABLE products
  ADD CONSTRAINT products_payment_method_check CHECK (payment_method IN ('pix','creditos','card'));

-- Defaults
UPDATE products SET billing_mode = 'one_time' WHERE billing_mode IS NULL;
UPDATE products SET payment_method = 'pix' WHERE payment_method IS NULL;

COMMENT ON COLUMN products.billing_mode IS 'Modo de cobrança: one_time (avulso) | subscription (mensal)';
COMMENT ON COLUMN products.payment_method IS 'Forma de pagamento: pix | creditos | card (assinatura)';
