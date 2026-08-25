-- Persistent catalogue cache for RCM vehicle categories.
-- Run once in Supabase SQL Editor.
create table if not exists public.rcm_vehicle_cache (
  vehiclecategoryid bigint primary key,
  vehicle_json jsonb not null,
  active boolean not null default true,
  synced_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rcm_vehicle_cache_active_idx
  on public.rcm_vehicle_cache (active, vehiclecategoryid);

alter table public.rcm_vehicle_cache enable row level security;

drop policy if exists "service role manages rcm vehicle cache" on public.rcm_vehicle_cache;
create policy "service role manages rcm vehicle cache"
  on public.rcm_vehicle_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.rcm_search_cache (
  cache_key text primary key,
  search_json jsonb not null,
  fetched_at timestamptz not null default timezone('utc', now())
);

create index if not exists rcm_search_cache_fetched_at_idx
  on public.rcm_search_cache (fetched_at);

alter table public.rcm_search_cache enable row level security;

drop policy if exists "service role manages rcm search cache" on public.rcm_search_cache;
create policy "service role manages rcm search cache"
  on public.rcm_search_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
