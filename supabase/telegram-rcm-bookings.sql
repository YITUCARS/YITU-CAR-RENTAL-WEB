create table if not exists public.telegram_rcm_booking_notifications (
  booking_ref text primary key,
  reservation_no text,
  status text not null default '',
  customer_name text not null default '',
  pickup_date text,
  dropoff_date text,
  first_notified_at timestamptz not null default now(),
  last_notified_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists telegram_rcm_booking_notifications_pickup_date_idx
  on public.telegram_rcm_booking_notifications (pickup_date);

create index if not exists telegram_rcm_booking_notifications_status_idx
  on public.telegram_rcm_booking_notifications (status);
