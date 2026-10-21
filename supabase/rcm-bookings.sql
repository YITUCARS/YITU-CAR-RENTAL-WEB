-- RCM bookings mirrored for YITU Lite (incremental sync from the RCM Export API).
-- One row per reservation; staff lists and the calendar read from here instead of calling RCM.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
create table if not exists public.rcm_bookings (
  reservation_ref text primary key,
  reservation_no text not null default '',
  status text not null default '',                 -- RCM booking type: Reservation / Hired / Returned / Cancelled / …
  pickup_date date,                                -- pick-up location local date
  pickup_time text not null default '',            -- HH:mm local
  dropoff_date date,
  dropoff_time text not null default '',
  pickup_location_id integer,
  dropoff_location_id integer,
  pickup_branch text not null default '',          -- RCM location name
  dropoff_branch text not null default '',
  customer_name text not null default '',
  vehicle text not null default '',
  plate text not null default '',
  total numeric not null default 0,
  agency text not null default '',
  rcm_updated text not null default '',            -- RCM "last updated" as exported
  details jsonb,                                   -- normalised bookinginfo used by YITU Lite
  synced_at timestamptz not null default now()
);

create index if not exists rcm_bookings_pickup_idx on public.rcm_bookings (pickup_date);
create index if not exists rcm_bookings_dropoff_idx on public.rcm_bookings (dropoff_date);

-- Sync bookkeeping (e.g. key 'incremental' → last successful sync time).
create table if not exists public.rcm_sync_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.rcm_bookings enable row level security;
alter table public.rcm_sync_state enable row level security;
