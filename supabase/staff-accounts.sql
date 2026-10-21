-- YITU Lite staff accounts (员工账号), managed in /admin → 员工账号.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'staff' check (role in ('staff', 'manager')),
  -- Every protected YITU Lite action is checked by the server, not only hidden in the app UI.
  permissions text[] not null default '{}',
  -- RCM branch names this account can see; empty = all branches.
  branches text[] not null default '{}',
  active boolean not null default true,
  notes text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_accounts
  add column if not exists permissions text[] not null default '{}';

-- Safe migration for accounts created before granular permissions were introduced.
update public.staff_accounts
set permissions = case
  when role = 'manager' then array[
    'bookings.read', 'bookings.refresh', 'pickup.manage', 'dropoff.manage',
    'photos.upload', 'agreements.manage', 'completions.confirm'
  ]::text[]
  else array[
    'bookings.read', 'pickup.manage', 'dropoff.manage',
    'photos.upload', 'agreements.manage'
  ]::text[]
end
where coalesce(cardinality(permissions), 0) = 0;

alter table public.staff_accounts enable row level security;
