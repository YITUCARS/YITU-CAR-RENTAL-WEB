create table if not exists public.partner_bookings (
  id uuid primary key default gen_random_uuid(),
  partner_account_id uuid not null references public.partner_accounts(id) on delete cascade,
  reference text not null unique,
  rcm_reservation_ref text not null default '',
  rcm_reservation_no text not null default '',
  status text not null default 'confirmed',
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null default '',
  pickup_location text not null,
  dropoff_location text not null,
  pickup_date date not null,
  dropoff_date date not null,
  pickup_time text not null,
  dropoff_time text not null,
  vehicle_id text not null default '',
  vehicle_name text not null default '',
  days integer not null default 1,
  original_total numeric(12,2) not null default 0,
  partner_total numeric(12,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  pricing_breakdown jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists partner_bookings_account_created_idx on public.partner_bookings(partner_account_id, created_at desc);
alter table public.partner_bookings add column if not exists rcm_reservation_ref text not null default '';
alter table public.partner_bookings add column if not exists rcm_reservation_no text not null default '';
alter table public.partner_bookings add column if not exists pricing_breakdown jsonb not null default '{}'::jsonb;
alter table public.partner_bookings enable row level security;
