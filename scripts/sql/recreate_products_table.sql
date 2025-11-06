-- SQL ALTERNATIVO: Recriar tabela products do zero
-- ATENÇÃO: Isso vai APAGAR todos os produtos existentes!
-- Use apenas se não tiver dados importantes na tabela

-- 1. Fazer backup da tabela antiga (opcional)
CREATE TABLE IF NOT EXISTS products_backup AS SELECT * FROM products;

-- 2. Dropar tabela existente
DROP TABLE IF EXISTS products CASCADE;

-- 3. Criar tabela products com estrutura correta
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  learn_more_url TEXT,
  webhook_url TEXT,
  sectors JSONB DEFAULT '[]'::jsonb,
  pricing JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar índices
CREATE INDEX idx_products_key ON products(key);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- 5. Criar trigger para updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- 6. Habilitar RLS (Row Level Security) se necessário
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 7. Criar policies (ajuste conforme sua necessidade)
-- Policy para leitura (todos autenticados podem ler)
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- Policy para insert/update/delete (apenas admins)
CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'user_metadata'->'sectors')::jsonb ? 'Criação de produtos'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'user_metadata'->'sectors')::jsonb ? 'Criação de produtos'
  );

-- 8. Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- 9. Inserir produtos de exemplo (opcional)
INSERT INTO products (key, name, description, sectors, pricing) VALUES
  ('produto-exemplo', 'Produto Exemplo', 'Descrição do produto', '["Setor 1", "Setor 2"]'::jsonb, '{"price": 100, "currency": "BRL"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Exibir estrutura da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
