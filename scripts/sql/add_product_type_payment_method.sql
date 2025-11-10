-- Adiciona campos product_type e payment_method na tabela products
-- Execute no SQL Editor do Supabase

-- Adicionar coluna product_type (setor ou usuario)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'setor' CHECK (product_type IN ('setor', 'usuario'));

-- Adicionar coluna payment_method (pix ou creditos)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'creditos'));

-- Comentários para documentação
COMMENT ON COLUMN products.product_type IS 'Tipo do produto: "setor" (libera setores) ou "usuario" (aumenta user_limit da empresa)';
COMMENT ON COLUMN products.payment_method IS 'Forma de pagamento: "pix" (Mercado Pago) ou "creditos" (usa saldo de créditos da empresa)';

-- Atualizar produtos existentes para valor default
UPDATE products SET product_type = 'setor' WHERE product_type IS NULL;
UPDATE products SET payment_method = 'pix' WHERE payment_method IS NULL;
