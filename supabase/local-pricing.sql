-- Local pricing foundation. Safe to run after supabase/rate-manager.sql.
-- Snapshots keep the original RCM observations auditable; master rates remain
-- the editable customer-facing source of truth.

create table if not exists public.local_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  vehiclecategoryid bigint not null,
  pickup_location_id bigint not null,
  dropoff_location_id bigint not null,
  pickup_date date not null,
  dropoff_date date not null,
  rental_days integer not null,
  price_per_day numeric not null,
  source text not null default 'rcm',
  vehicle_json jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists local_price_snapshots_vehicle_idx
  on public.local_price_snapshots (vehiclecategoryid, pickup_date, rental_days);

alter table public.local_price_snapshots enable row level security;

drop policy if exists "service role manages local price snapshots" on public.local_price_snapshots;
create policy "service role manages local price snapshots"
  on public.local_price_snapshots for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
