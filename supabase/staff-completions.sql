-- YITU Lite: pick-ups / drop-offs finished in the app, shared by all staff.
-- Each row is also a checklist item until an admin confirms the hire status was set in RCM
-- (Hired / Returned) — RCM's API can't change it.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
create table if not exists public.staff_completions (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null,
  type text not null check (type in ('pickup', 'dropoff')),
  reservation_no text not null default '',
  customer_name text not null default '',
  vehicle text not null default '',
  plate text not null default '',
  branch text not null default '',
  completed_at timestamptz not null default now(),
  completed_by text not null default '',
  rcm_updated_at timestamptz,
  rcm_updated_by text,
  unique (booking_ref, type)
);

create index if not exists staff_completions_pending_idx
  on public.staff_completions (completed_at desc) where rcm_updated_at is null;

alter table public.staff_completions enable row level security;
