create extension if not exists pgcrypto;

-- Products (global)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  learn_more_url text,
  webhook_url text,
  sectors text[] not null default '{}',
  pricing jsonb, -- e.g., {"basePrice": 100.0, "userPrice": 10.0, "connectionPrice": 20.0}
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table products enable row level security;

-- allow public SELECT for listing
drop policy if exists products_public_select on products;
create policy products_public_select on products for select using (true);

-- Purchases
create table if not exists product_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  reference_id text unique,
  amount numeric(12,2),
  status text default 'created', -- created | paid | canceled | failed
  buyer jsonb,   -- {nome, cpf, email, telefone, empresa}
  metadata jsonb, -- arbitrary
  webhook_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table product_purchases enable row level security;

drop policy if exists purchases_is_owner_select on product_purchases;
create policy purchases_is_owner_select on product_purchases for select using (auth.uid() = user_id);

drop policy if exists purchases_is_owner_insert on product_purchases;
create policy purchases_is_owner_insert on product_purchases for insert with check (auth.uid() = user_id);

drop policy if exists purchases_is_owner_update on product_purchases;
create policy purchases_is_owner_update on product_purchases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at
before update on products
for each row execute function set_updated_at();

drop trigger if exists trg_product_purchases_updated_at on product_purchases;
create trigger trg_product_purchases_updated_at
before update on product_purchases
for each row execute function set_updated_at();

