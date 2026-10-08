-- Etsy Autopilot: core schema
-- Every user-owned table has RLS. Etsy tokens and OAuth state live in tables
-- with RLS enabled and NO policies, so only edge functions (service role) can read them.

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- Settings
-- --------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  brand text not null default '',
  default_currency text not null default 'USD',
  default_taxonomy_id bigint,
  ai_disclosure boolean not null default true,
  price_multiplier numeric(6, 3) not null default 1.0,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Etsy connection (public part) + tokens (private part)
-- --------------------------------------------------------------------------
create table public.etsy_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  etsy_user_id bigint not null,
  shop_id bigint,
  shop_name text,
  shop_url text,
  currency_code text,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.etsy_connections enable row level security;
create policy "read own connection" on public.etsy_connections
  for select using (auth.uid() = user_id);

create table public.etsy_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.etsy_tokens enable row level security; -- service role only

create table public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_verifier text not null,
  redirect_to text not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security; -- service role only
create index oauth_states_created_idx on public.oauth_states (created_at);

-- --------------------------------------------------------------------------
-- Products
-- --------------------------------------------------------------------------
create type public.product_status as enum (
  'draft',      -- spec saved, files not generated yet
  'ready',      -- files + images + copy ready for review
  'pushing',    -- being uploaded to Etsy
  'on_etsy',    -- exists as an Etsy draft, awaiting your approval
  'live',       -- published (active) on Etsy
  'error'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id text not null,
  name text not null,
  params jsonb not null default '{}',
  spec jsonb not null,
  listing jsonb not null default '{}',     -- { title, description, tags[], price }
  taxonomy_id bigint,
  files jsonb not null default '[]',       -- [{ path, name, mime, size }]
  images jsonb not null default '[]',      -- [{ path, name, alt }]
  status public.product_status not null default 'draft',
  etsy_listing_id bigint,
  etsy_state text,
  etsy_url text,
  last_error text,
  pushed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_user_idx on public.products (user_id, updated_at desc);
alter table public.products enable row level security;
create policy "own products" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Activity log
-- --------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  kind text not null,               -- generated | copy | pushed | published | error | connected …
  message text not null,
  created_at timestamptz not null default now()
);
create index events_user_idx on public.events (user_id, created_at desc);
alter table public.events enable row level security;
create policy "read own events" on public.events for select using (auth.uid() = user_id);
create policy "write own events" on public.events for insert with check (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- Storage: private bucket, one folder per user  ({user_id}/{product_id}/…)
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('products', 'products', false, 20971520)
on conflict (id) do nothing;

create policy "own product files read" on storage.objects for select
  using (bucket_id = 'products' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own product files write" on storage.objects for insert
  with check (bucket_id = 'products' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own product files update" on storage.objects for update
  using (bucket_id = 'products' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own product files delete" on storage.objects for delete
  using (bucket_id = 'products' and (storage.foldername(name))[1] = auth.uid()::text);
