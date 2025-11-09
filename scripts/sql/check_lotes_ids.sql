-- Verificar registros na tabela importar

-- 1. Contar total de registros
SELECT 
  'Total de registros' as descricao,
  COUNT(*) as quantidade
FROM importar;

-- 2. Contar registros COM lote_id
SELECT 
  'Registros COM lote_id' as descricao,
  COUNT(*) as quantidade
FROM importar
WHERE lote_id IS NOT NULL;

-- 3. Contar registros SEM lote_id
SELECT 
  'Registros SEM lote_id' as descricao,
  COUNT(*) as quantidade
FROM importar
WHERE lote_id IS NULL;

-- 4. Listar lotes únicos (últimos 20)
SELECT DISTINCT
  lote_id,
  MIN(created_at) as primeira_insercao,
  COUNT(*) as total_registros,
  produto,
  banco_simulado,
  status,
  cliente
FROM importar
WHERE lote_id IS NOT NULL
GROUP BY lote_id, produto, banco_simulado, status, cliente
ORDER BY primeira_insercao DESC
LIMIT 20;

-- 5. Verificar registros antigos sem lote_id
SELECT 
  id,
  created_at,
  cliente,
  produto,
  banco_simulado,
  status,
  lote_id
FROM importar
WHERE lote_id IS NULL
ORDER BY created_at DESC
LIMIT 10;
