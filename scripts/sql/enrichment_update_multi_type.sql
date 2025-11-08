-- Migração: Suporte para múltiplos tipos de consulta na API Shift Data
-- Adiciona suporte para: CPF, CNPJ, Placa, Telefone

-- 1. Adicionar campo query_type nas tabelas
DO $$ 
BEGIN
  -- Adicionar em enrichment_jobs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'enrichment_jobs' 
    AND column_name = 'query_type'
  ) THEN
    ALTER TABLE enrichment_jobs ADD COLUMN query_type TEXT DEFAULT 'cpf';
    COMMENT ON COLUMN enrichment_jobs.query_type IS 'Tipo de consulta: cpf, cnpj, placa, telefone';
  END IF;

  -- Adicionar em enrichment_records
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'enrichment_records' 
    AND column_name = 'query_type'
  ) THEN
    ALTER TABLE enrichment_records ADD COLUMN query_type TEXT DEFAULT 'cpf';
    COMMENT ON COLUMN enrichment_records.query_type IS 'Tipo de consulta: cpf, cnpj, placa, telefone';
  END IF;

  -- Adicionar campo genérico query_value
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'enrichment_records' 
    AND column_name = 'query_value'
  ) THEN
    ALTER TABLE enrichment_records ADD COLUMN query_value TEXT;
    COMMENT ON COLUMN enrichment_records.query_value IS 'Valor da consulta (CPF, CNPJ, Placa ou Telefone)';
  END IF;

  -- Adicionar campos específicos para cada tipo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'enrichment_records' 
    AND column_name = 'cnpj'
  ) THEN
    ALTER TABLE enrichment_records ADD COLUMN cnpj TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'enrichment_records' 
    AND column_name = 'placa'
  ) THEN
    ALTER TABLE enrichment_records ADD COLUMN placa TEXT;
  END IF;
END $$;

-- 2. Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_query_type ON enrichment_jobs(query_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_records_query_type ON enrichment_records(query_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_records_query_value ON enrichment_records(query_value);
CREATE INDEX IF NOT EXISTS idx_enrichment_records_cnpj ON enrichment_records(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrichment_records_placa ON enrichment_records(placa) WHERE placa IS NOT NULL;

-- 3. Atualizar registros existentes (migrar CPF para query_value)
UPDATE enrichment_records 
SET query_value = cpf, query_type = 'cpf' 
WHERE query_value IS NULL AND cpf IS NOT NULL;

-- 4. Adicionar constraints de validação
DO $$
BEGIN
  -- Garantir que query_type seja um valor válido
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'enrichment_jobs_query_type_check'
  ) THEN
    ALTER TABLE enrichment_jobs 
    ADD CONSTRAINT enrichment_jobs_query_type_check 
    CHECK (query_type IN ('cpf', 'cnpj', 'placa', 'telefone'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'enrichment_records_query_type_check'
  ) THEN
    ALTER TABLE enrichment_records 
    ADD CONSTRAINT enrichment_records_query_type_check 
    CHECK (query_type IN ('cpf', 'cnpj', 'placa', 'telefone'));
  END IF;
END $$;

-- 5. Comentários adicionais
COMMENT ON COLUMN enrichment_jobs.query_type IS 'Tipo de enriquecimento: cpf (Pessoa Física), cnpj (Pessoa Jurídica), placa (Veículos), telefone (Telefone)';

-- Informações sobre os endpoints da API Shift Data:
-- cpf:      POST /api/PessoaFisica    - Retorna dados de pessoa física
-- cnpj:     POST /api/PessoaJuridica  - Retorna dados de empresa
-- placa:    POST /api/Veiculos        - Retorna dados de veículo
-- telefone: POST /api/Telefone        - Retorna dados do telefone

SELECT 'Migração concluída! Tabelas atualizadas para suportar múltiplos tipos de consulta.' as resultado;
