-- ==========================================
-- FIX: Migrar sistema de créditos para usar coluna 'credits' (float/numeric)
-- ao invés de 'credits_balance_cents' (bigint)
-- ==========================================

-- 1. Atualizar função empresa_add_credits para usar 'credits' (float)
create or replace function empresa_add_credits(p_empresa uuid, p_cents bigint)
returns bigint as $$
declare 
  new_balance numeric;
  amount_reais numeric;
begin
  -- Converter cents para reais (dividir por 100)
  amount_reais := p_cents::numeric / 100.0;
  
  -- Atualizar credits (float) ao invés de credits_balance_cents
  update empresa 
  set credits = coalesce(credits, 0) + amount_reais 
  where id = p_empresa 
  returning credits into new_balance;
  
  -- Retornar novo saldo em cents (multiplicar por 100 para compatibilidade)
  return (new_balance * 100)::bigint;
end;
$$ language plpgsql security definer;

-- 2. Atualizar função empresa_charge_credits para usar 'credits' (float)
create or replace function empresa_charge_credits(p_empresa uuid, p_cents bigint)
returns table(success boolean, new_balance bigint, error text) as $$
declare 
  cur_balance numeric;
  amount_reais numeric;
  new_bal numeric;
begin
  -- Buscar saldo atual em credits (float)
  select coalesce(credits, 0) into cur_balance from empresa where id = p_empresa;
  
  if cur_balance is null then
    return query select false, 0::bigint, 'Empresa não encontrada';
    return;
  end if;
  
  -- Converter cents para reais
  amount_reais := p_cents::numeric / 100.0;
  
  -- Verificar saldo suficiente
  if cur_balance < amount_reais then
    return query select false, (cur_balance * 100)::bigint, 'Saldo insuficiente';
    return;
  end if;
  
  -- Debitar credits (float)
  update empresa 
  set credits = credits - amount_reais 
  where id = p_empresa 
  returning credits into new_bal;
  
  -- Retornar sucesso com novo saldo em cents
  return query select true, (new_bal * 100)::bigint, null::text;
end;
$$ language plpgsql security definer;

-- 3. Atualizar view para usar 'credits' ao invés de 'credits_balance_cents'
create or replace view vw_user_empresa as
select au.id as user_id,
       eu.empresa_id,
       coalesce(eu.role, 'user') as role,
       e.credits,
       e.user_limit,
       e.nome as empresa_nome
from auth.users au
left join empresa_users eu on eu.user_id = au.id
left join empresa e on e.id = eu.empresa_id;

-- ==========================================
-- INSTRUÇÕES:
-- ==========================================
-- 1. Execute este script no SQL Editor do Supabase
-- 2. As stored procedures agora trabalham internamente com a coluna 'credits' (float)
-- 3. Compatibilidade mantida: recebem/retornam valores em cents (bigint) para não quebrar código existente
-- 4. Conversão cents ↔ reais é feita automaticamente dentro das funções
-- ==========================================
