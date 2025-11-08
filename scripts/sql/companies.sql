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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas em companies se não existirem
DO $$ 
BEGIN
  -- cnpj
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'cnpj'
  ) THEN
    ALTER TABLE companies ADD COLUMN cnpj TEXT;
  END IF;
  
  -- phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'phone'
  ) THEN
    ALTER TABLE companies ADD COLUMN phone TEXT;
  END IF;
  
  -- email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'email'
  ) THEN
    ALTER TABLE companies ADD COLUMN email TEXT;
  END IF;
  
  -- address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'address'
  ) THEN
    ALTER TABLE companies ADD COLUMN address TEXT;
  END IF;
  
  -- active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'active'
  ) THEN
    ALTER TABLE companies ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
  
  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
  
  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Criar tabela users se não existir (compatibilidade)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas na tabela users se não existirem
DO $$ 
BEGIN
  -- Adicionar company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
  
  -- Adicionar active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.users ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
  
  -- Adicionar role (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- Atualizar valores padrão nas colunas novas (garantir consistência)
UPDATE companies SET active = true WHERE active IS NULL;
UPDATE public.users SET active = true WHERE active IS NULL;
UPDATE public.users SET role = 'user' WHERE role IS NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(active);

-- RLS (Row Level Security)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver todas as empresas
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
CREATE POLICY "Admins can view all companies" ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
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
      SELECT 1 FROM public.users
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
      SELECT 1 FROM public.users
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
      SELECT company_id FROM public.users
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
