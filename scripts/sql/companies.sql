-- Tabela de Empresas/Companhias
-- Permite gerenciar múltiplas empresas no sistema

-- Criar tabela companies se não existir
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas na tabela users se não existirem
DO $$ 
BEGIN
  -- Adicionar company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE users ADD COLUMN company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
  
  -- Adicionar active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'active'
  ) THEN
    ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
  
  -- Adicionar role (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- RLS (Row Level Security)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver todas as empresas
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
CREATE POLICY "Admins can view all companies" ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política: Admins podem criar empresas
DROP POLICY IF EXISTS "Admins can create companies" ON companies;
CREATE POLICY "Admins can create companies" ON companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política: Admins podem atualizar empresas
DROP POLICY IF EXISTS "Admins can update companies" ON companies;
CREATE POLICY "Admins can update companies" ON companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política: Usuários podem ver apenas sua própria empresa
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Comentários
COMMENT ON TABLE companies IS 'Empresas/Companhias cadastradas no sistema';
COMMENT ON COLUMN companies.id IS 'ID único da empresa';
COMMENT ON COLUMN companies.name IS 'Nome da empresa';
COMMENT ON COLUMN companies.cnpj IS 'CNPJ da empresa (opcional)';
COMMENT ON COLUMN companies.phone IS 'Telefone da empresa (opcional)';
COMMENT ON COLUMN companies.email IS 'Email da empresa (opcional)';
COMMENT ON COLUMN companies.address IS 'Endereço da empresa (opcional)';
COMMENT ON COLUMN companies.active IS 'Se a empresa está ativa';
COMMENT ON COLUMN companies.created_at IS 'Data de criação';
COMMENT ON COLUMN companies.updated_at IS 'Data da última atualização';
