-- YITU Lite push notifications.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.

-- Devices that receive pushes (APNs device tokens), one row per phone.
create table if not exists public.staff_devices (
  device_token text primary key,
  staff_id text not null,
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists staff_devices_staff_idx on public.staff_devices (staff_id);

-- Notifications sent to staff; the unique key makes each booking notify only once.
create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                    -- 'new_booking'
  booking_ref text not null,
  reservation_no text not null default '',
  branch text not null default '',
  title text not null,
  body text not null,
  pickup_date date,
  created_at timestamptz not null default now(),
  unique (kind, booking_ref)
);

create index if not exists staff_notifications_created_idx on public.staff_notifications (created_at desc);

alter table public.staff_devices enable row level security;
alter table public.staff_notifications enable row level security;
