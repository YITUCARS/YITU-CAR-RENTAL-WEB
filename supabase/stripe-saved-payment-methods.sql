create table if not exists public.stripe_saved_payment_methods (
  reservation_ref text primary key,
  reservation_no text,
  payment_channel text not null default 'yitu_web',
  stripe_mode text not null default 'live',
  stripe_customer_id text not null,
  stripe_payment_method_id text,
  latest_payment_intent_id text,
  latest_charge_id text,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_method_type text,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  reusable boolean not null default false,
  last_payment_amount numeric,
  last_payment_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_saved_payment_methods_customer_idx
  on public.stripe_saved_payment_methods (stripe_customer_id);

create index if not exists stripe_saved_payment_methods_email_idx
  on public.stripe_saved_payment_methods (customer_email);

create index if not exists stripe_saved_payment_methods_reusable_idx
  on public.stripe_saved_payment_methods (reusable);

alter table public.stripe_saved_payment_methods enable row level security;

revoke all on table public.stripe_saved_payment_methods from anon;
revoke all on table public.stripe_saved_payment_methods from authenticated;

grant select, insert, update, delete on table public.stripe_saved_payment_methods to service_role;
