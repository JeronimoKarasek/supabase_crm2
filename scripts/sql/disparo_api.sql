-- WhatsApp credentials per user (suporta múltiplas credenciais por usuário)
create extension if not exists pgcrypto;

-- Tabela de credenciais (apenas WABA e token permanente, com label e verify token padrão)
create table if not exists whatsapp_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  waba_id text not null,
  access_token text not null,
  -- opcionais: App ID/Secret para gerar appsecret_proof nas chamadas Graph
  app_id text,
  app_secret text,
  webhook_verify_token text not null default 'verificadorcrm',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, waba_id)
);

alter table whatsapp_credentials enable row level security;

create policy if not exists whatsapp_credentials_is_owner_select on whatsapp_credentials
  for select using (auth.uid() = user_id);

create policy if not exists whatsapp_credentials_is_owner_ins on whatsapp_credentials
  for insert with check (auth.uid() = user_id);

create policy if not exists whatsapp_credentials_is_owner_upd on whatsapp_credentials
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists whatsapp_credentials_is_owner_del on whatsapp_credentials
  for delete using (auth.uid() = user_id);

-- Telefones disponibilizados pelo WABA (opcional, para cache/localização)
create table if not exists whatsapp_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid not null references whatsapp_credentials(id) on delete cascade,
  phone_number_id text not null,
  display_phone_number text,
  quality_rating text,
  name_status text,
  verified_name text,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (credential_id, phone_number_id)
);

alter table whatsapp_phone_numbers enable row level security;

create policy if not exists phone_numbers_is_owner_select on whatsapp_phone_numbers
  for select using (auth.uid() = user_id);

create policy if not exists phone_numbers_is_owner_ins on whatsapp_phone_numbers
  for insert with check (auth.uid() = user_id);

create policy if not exists phone_numbers_is_owner_upd on whatsapp_phone_numbers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists phone_numbers_is_owner_del on whatsapp_phone_numbers
  for delete using (auth.uid() = user_id);

-- Templates disponíveis (opcional, para cache)
create table if not exists whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid not null references whatsapp_credentials(id) on delete cascade,
  name text not null,
  language text,
  category text,
  status text,
  components jsonb,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (credential_id, name, language)
);

alter table whatsapp_templates enable row level security;

create policy if not exists templates_is_owner_select on whatsapp_templates
  for select using (auth.uid() = user_id);

create policy if not exists templates_is_owner_ins on whatsapp_templates
  for insert with check (auth.uid() = user_id);

create policy if not exists templates_is_owner_upd on whatsapp_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists templates_is_owner_del on whatsapp_templates
  for delete using (auth.uid() = user_id);

-- Base de disparo (lotes)
create table if not exists disparo_crm_api (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid not null references whatsapp_credentials(id) on delete cascade,
  batch_id uuid not null,
  phone text not null,
  name text,
  template_name text not null,
  template_language text default 'pt_BR',
  template_components jsonb,
  phone_number_id text not null,
  message_id text,
  status text default 'queued',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  interacted_at timestamptz,
  button_clicked text,
  attempt_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_disparo_user on disparo_crm_api(user_id);
create index if not exists idx_disparo_batch on disparo_crm_api(batch_id);
create index if not exists idx_disparo_status on disparo_crm_api(status);
create index if not exists idx_disparo_msg on disparo_crm_api(message_id);
create index if not exists idx_disparo_cred on disparo_crm_api(credential_id);

alter table disparo_crm_api enable row level security;

create policy if not exists disparo_is_owner_select on disparo_crm_api
  for select using (auth.uid() = user_id);

create policy if not exists disparo_is_owner_insert on disparo_crm_api
  for insert with check (auth.uid() = user_id);

create policy if not exists disparo_is_owner_update on disparo_crm_api
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists disparo_is_owner_delete on disparo_crm_api
  for delete using (auth.uid() = user_id);

-- Função de updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_whatsapp_credentials_updated_at on whatsapp_credentials;
create trigger trg_whatsapp_credentials_updated_at
before update on whatsapp_credentials
for each row execute function set_updated_at();

-- Migração: adicionar colunas opcionais se a tabela já existir sem elas
alter table if exists whatsapp_credentials add column if not exists app_id text;
alter table if exists whatsapp_credentials add column if not exists app_secret text;

drop trigger if exists trg_whatsapp_phone_numbers_updated_at on whatsapp_phone_numbers;
create trigger trg_whatsapp_phone_numbers_updated_at
before update on whatsapp_phone_numbers
for each row execute function set_updated_at();

drop trigger if exists trg_whatsapp_templates_updated_at on whatsapp_templates;
create trigger trg_whatsapp_templates_updated_at
before update on whatsapp_templates
for each row execute function set_updated_at();

drop trigger if exists trg_disparo_crm_api_updated_at on disparo_crm_api;
create trigger trg_disparo_crm_api_updated_at
before update on disparo_crm_api
for each row execute function set_updated_at();

-- Inbound messages table (for received counts)
create table if not exists whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid references whatsapp_credentials(id) on delete set null,
  phone_number_id text not null,
  from_wa_id text not null,
  type text,
  payload jsonb,
  received_at timestamptz default now()
);

create index if not exists idx_inbound_user on whatsapp_inbound(user_id);
create index if not exists idx_inbound_phone on whatsapp_inbound(phone_number_id);
create index if not exists idx_inbound_received_at on whatsapp_inbound(received_at);

alter table whatsapp_inbound enable row level security;

create policy if not exists inbound_is_owner_select on whatsapp_inbound
  for select using (auth.uid() = user_id);

create policy if not exists inbound_is_owner_ins on whatsapp_inbound
  for insert with check (auth.uid() = user_id);

-- Status events table (captures Meta webhook statuses even fora do CRM)
create table if not exists whatsapp_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid references whatsapp_credentials(id) on delete set null,
  phone_number_id text,
  message_id text,
  status text,
  -- novos campos para cálculos de pagas/grátis e categorias
  pricing_category text,
  pricing_billable boolean,
  conversation_id text,
  conversation_category text,
  conversation_origin text,
  event_ts timestamptz default now(),
  unique (message_id, status)
);

create index if not exists idx_status_user on whatsapp_status_events(user_id);
create index if not exists idx_status_phone on whatsapp_status_events(phone_number_id);
create index if not exists idx_status_ts on whatsapp_status_events(event_ts);
create index if not exists idx_status_pricing_billable on whatsapp_status_events(pricing_billable);
create index if not exists idx_status_pricing_category on whatsapp_status_events(pricing_category);

alter table whatsapp_status_events enable row level security;

create policy if not exists status_is_owner_select on whatsapp_status_events
  for select using (auth.uid() = user_id);

create policy if not exists status_is_owner_ins on whatsapp_status_events
  for insert with check (auth.uid() = user_id);

-- Migração segura: adicionar colunas se ainda não existirem
alter table if exists whatsapp_status_events add column if not exists pricing_category text;
alter table if exists whatsapp_status_events add column if not exists pricing_billable boolean;
alter table if exists whatsapp_status_events add column if not exists conversation_id text;
alter table if exists whatsapp_status_events add column if not exists conversation_category text;
alter table if exists whatsapp_status_events add column if not exists conversation_origin text;
create index if not exists idx_status_pricing_billable on whatsapp_status_events(pricing_billable);
create index if not exists idx_status_pricing_category on whatsapp_status_events(pricing_category);
