-- Tabela de empresas (multi-tenant)
create table if not exists empresa (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  responsavel text,
  telefone text,
  credits_balance_cents bigint default 0, -- saldo compartilhado da empresa
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table empresa enable row level security;

-- Usuários vinculados à empresa (não altera auth.users diretamente)
create table if not exists empresa_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references empresa(id) on delete set null,
  role text default 'user', -- user | gestor | admin
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table empresa_users enable row level security;

drop policy if exists empresa_users_select on empresa_users;
create policy empresa_users_select on empresa_users
  for select using (auth.uid() = user_id);

drop policy if exists empresa_users_insert on empresa_users;
create policy empresa_users_insert on empresa_users
  for insert with check (auth.uid() = user_id);

drop policy if exists empresa_users_update on empresa_users;
create policy empresa_users_update on empresa_users
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Função utilitária para atualizar updated_at
create or replace function empresa_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_empresa_updated_at on empresa;
create trigger trg_empresa_updated_at
before update on empresa
for each row execute function empresa_set_updated_at();

drop trigger if exists trg_empresa_users_updated_at on empresa_users;
create trigger trg_empresa_users_updated_at
before update on empresa_users
for each row execute function empresa_set_updated_at();

-- Função para adicionar créditos à empresa (empresa_id)
create or replace function empresa_add_credits(p_empresa uuid, p_cents bigint)
returns bigint as $$
declare new_balance bigint;
begin
  update empresa set credits_balance_cents = credits_balance_cents + p_cents where id = p_empresa returning credits_balance_cents into new_balance;
  return new_balance;
end;
$$ language plpgsql security definer;

-- Função para debitar créditos da empresa (falha se saldo insuficiente)
create or replace function empresa_charge_credits(p_empresa uuid, p_cents bigint)
returns table(success boolean, new_balance bigint, error text) as $$
declare cur_balance bigint;
begin
  select credits_balance_cents into cur_balance from empresa where id = p_empresa;
  if cur_balance is null then
    return query select false, cur_balance, 'Empresa não encontrada';
    return;
  end if;
  if cur_balance < p_cents then
    return query select false, cur_balance, 'Saldo insuficiente';
    return;
  end if;
  update empresa set credits_balance_cents = credits_balance_cents - p_cents where id = p_empresa returning credits_balance_cents into cur_balance;
  return query select true, cur_balance, null;
end;
$$ language plpgsql security definer;

-- View para obter papel do usuário e empresa em uma única linha
create or replace view vw_user_empresa as
select au.id as user_id,
       eu.empresa_id,
       coalesce(eu.role, 'user') as role,
       e.credits_balance_cents,
       e.nome as empresa_nome
from auth.users au
left join empresa_users eu on eu.user_id = au.id
left join empresa e on e.id = eu.empresa_id;
