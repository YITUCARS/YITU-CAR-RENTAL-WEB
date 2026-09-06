-- Tables behind the Stripe webhook.
--
-- rental_payment_confirmation is the claim that stops a payment being recorded
-- twice at the supplier. The browser and the webhook both fire for the same
-- payment; whichever inserts the payment intent id first is the one that talks
-- to RCM. The primary key is what enforces this, so it must stay a primary key.
--
-- stripe_webhook_event is the record of what Stripe sent, kept for replay
-- protection and for answering "did that payment ever reach us".

create table if not exists public.rental_payment_confirmation (
  payment_intent_id text primary key,
  reservation_ref text not null,
  amount numeric,
  payment_channel text,
  stripe_mode text,
  confirmed_by text not null default 'client',
  created_at timestamptz not null default now()
);

create index if not exists rental_payment_confirmation_ref_idx
  on public.rental_payment_confirmation (reservation_ref);

create table if not exists public.stripe_webhook_event (
  event_id text primary key,
  type text not null default '',
  payment_intent_id text,
  livemode boolean not null default false,
  handled boolean not null default false,
  error text,
  received_at timestamptz not null default now()
);

create index if not exists stripe_webhook_event_intent_idx
  on public.stripe_webhook_event (payment_intent_id);

create index if not exists stripe_webhook_event_received_idx
  on public.stripe_webhook_event (received_at desc);

alter table public.rental_payment_confirmation enable row level security;
alter table public.stripe_webhook_event enable row level security;

revoke all on table public.rental_payment_confirmation from anon;
revoke all on table public.rental_payment_confirmation from authenticated;
revoke all on table public.stripe_webhook_event from anon;
revoke all on table public.stripe_webhook_event from authenticated;

grant select, insert, update, delete
  on table public.rental_payment_confirmation to service_role;
grant select, insert, update, delete
  on table public.stripe_webhook_event to service_role;
