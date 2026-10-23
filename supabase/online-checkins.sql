-- Online check-in: staff send the hirer a link (YITU Lite → "Send check-in link"); the hirer
-- fills in their details and licence photos before pick-up, and the details are written to RCM.
-- Only a hash of the link token is stored. Photos go to RCM documents, never into this table.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
create table if not exists public.online_checkins (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null,
  reservation_no text not null default '',
  token_hash text not null unique,
  status text not null default 'sent' check (status in ('sent', 'opened', 'submitted', 'cancelled')),
  email text not null default '',
  sent_by text not null default '',
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz not null,
  -- What the hirer entered (no photos), kept so staff can see it even if writing to RCM failed.
  data jsonb,
  photos text[] not null default '{}',
  rcm_synced_at timestamptz,
  rcm_error text
);

create index if not exists online_checkins_booking_idx on public.online_checkins (booking_ref, sent_at desc);

alter table public.online_checkins enable row level security;
