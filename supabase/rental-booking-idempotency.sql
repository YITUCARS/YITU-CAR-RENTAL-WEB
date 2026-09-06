-- Stops a retried booking request from creating a second real reservation.
--
-- The key is either the caller's Idempotency-Key or a fingerprint of the
-- booking itself (customer, car, dates, locations) for the clients that send
-- none. The primary key is what does the work, so it must stay a primary key.
--
-- A row with no reservation_ref means an attempt is still in flight; one with
-- a reference is a completed booking whose reference a retry gets back.

create table if not exists public.rental_booking_idempotency (
  idempotency_key text primary key,
  fingerprint text not null,
  reservation_ref text,
  reservation_no text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists rental_booking_idempotency_created_idx
  on public.rental_booking_idempotency (created_at desc);

create index if not exists rental_booking_idempotency_ref_idx
  on public.rental_booking_idempotency (reservation_ref);

alter table public.rental_booking_idempotency enable row level security;

revoke all on table public.rental_booking_idempotency from anon;
revoke all on table public.rental_booking_idempotency from authenticated;

grant select, insert, update, delete
  on table public.rental_booking_idempotency to service_role;
