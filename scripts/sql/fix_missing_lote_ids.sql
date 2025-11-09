-- Script para adicionar lote_id aos registros antigos que não têm

-- ATENÇÃO: Este script agrupa registros antigos por cliente, produto, banco e data
-- e atribui o mesmo lote_id para registros que parecem ser do mesmo lote

-- Primeiro, vamos ver quantos registros sem lote_id existem
SELECT 
  COUNT(*) as registros_sem_lote_id,
  MIN(created_at) as mais_antigo,
  MAX(created_at) as mais_recente
FROM importar
WHERE lote_id IS NULL;

-- Agora vamos criar lote_id para eles agrupando por similaridade
-- ESTRATÉGIA: Agrupar por cliente + produto + banco + created_at (mesmo minuto)

DO $$
DECLARE
  rec RECORD;
  novo_lote_id TEXT;
  registros_atualizados INT := 0;
BEGIN
  -- Para cada grupo de registros similares sem lote_id
  FOR rec IN (
    SELECT 
      cliente,
      produto,
      banco_simulado,
      DATE_TRUNC('minute', created_at) as minuto_criacao,
      MIN(id) as primeiro_id,
      COUNT(*) as total
    FROM importar
    WHERE lote_id IS NULL
    GROUP BY cliente, produto, banco_simulado, DATE_TRUNC('minute', created_at)
    ORDER BY minuto_criacao DESC
  ) LOOP
    -- Gera novo lote_id baseado no timestamp e random
    novo_lote_id := EXTRACT(EPOCH FROM rec.minuto_criacao)::BIGINT || '_' || substr(md5(random()::text), 1, 8);
    
    -- Atualiza todos os registros deste grupo
    UPDATE importar
    SET lote_id = novo_lote_id
    WHERE lote_id IS NULL
      AND cliente = rec.cliente
      AND produto = rec.produto
      AND banco_simulado = rec.banco_simulado
      AND DATE_TRUNC('minute', created_at) = rec.minuto_criacao;
    
    registros_atualizados := registros_atualizados + rec.total;
    
    RAISE NOTICE 'Lote criado: % (% registros) - Cliente: %, Produto: %, Banco: %', 
      novo_lote_id, rec.total, rec.cliente, rec.produto, rec.banco_simulado;
  END LOOP;
  
  RAISE NOTICE 'Total de registros atualizados: %', registros_atualizados;
END $$;

-- Verificar resultado
SELECT 
  'Após migração' as momento,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN lote_id IS NOT NULL THEN 1 END) as com_lote_id,
  COUNT(CASE WHEN lote_id IS NULL THEN 1 END) as sem_lote_id
FROM importar;

-- Listar os novos lotes criados (últimos 10)
SELECT 
  lote_id,
  MIN(created_at) as data_envio,
  COUNT(*) as total_registros,
  produto,
  banco_simulado,
  cliente
FROM importar
WHERE lote_id IS NOT NULL
GROUP BY lote_id, produto, banco_simulado, cliente
ORDER BY data_envio DESC
LIMIT 10;
