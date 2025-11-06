-- SQL para corrigir a tabela products e adicionar todas as colunas necessárias
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna 'key' se não existir (já deve existir do script anterior)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'key'
  ) THEN
    ALTER TABLE products ADD COLUMN key TEXT;
    
    -- Gerar keys para produtos existentes (se houver)
    UPDATE products 
    SET key = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '_', 'g'))
    WHERE key IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- 2. Adicionar coluna 'name' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'name'
  ) THEN
    ALTER TABLE products ADD COLUMN name TEXT;
    
    -- Se houver dados em 'title', copiar para 'name'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'title'
    ) THEN
      UPDATE products SET name = title WHERE name IS NULL AND title IS NOT NULL;
    END IF;
  END IF;
END $$;

-- 3. Remover constraint NOT NULL da coluna 'title' se existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'title'
  ) THEN
    ALTER TABLE products ALTER COLUMN title DROP NOT NULL;
  END IF;
END $$;

-- 4. Copiar dados de 'title' para 'name' se 'title' existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'title'
  ) THEN
    UPDATE products 
    SET name = COALESCE(name, title)
    WHERE title IS NOT NULL;
  END IF;
END $$;

-- 5. Adicionar coluna 'description' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN description TEXT;
  END IF;
END $$;

-- 6. Adicionar coluna 'learn_more_url' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'learn_more_url'
  ) THEN
    ALTER TABLE products ADD COLUMN learn_more_url TEXT;
  END IF;
END $$;

-- 7. Adicionar coluna 'webhook_url' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE products ADD COLUMN webhook_url TEXT;
  END IF;
END $$;

-- 8. Adicionar coluna 'sectors' se não existir (JSONB array)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'sectors'
  ) THEN
    ALTER TABLE products ADD COLUMN sectors JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 9. Adicionar coluna 'pricing' se não existir (JSONB)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'pricing'
  ) THEN
    ALTER TABLE products ADD COLUMN pricing JSONB;
  END IF;
END $$;

-- 10. Adicionar coluna 'active' se não existir (boolean)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'active'
  ) THEN
    ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 11. Adicionar colunas de timestamp se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE products ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE products ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- 12. Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_products_key ON products(key);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- 13. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- 14. Garantir valores padrão para registros existentes
UPDATE products SET sectors = '[]'::jsonb WHERE sectors IS NULL;
UPDATE products SET active = true WHERE active IS NULL;
UPDATE products SET created_at = now() WHERE created_at IS NULL;
UPDATE products SET updated_at = now() WHERE updated_at IS NULL;

-- 15. Recarregar schema do PostgREST (se disponível)
NOTIFY pgrst, 'reload schema';

-- Exibir estrutura final da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
