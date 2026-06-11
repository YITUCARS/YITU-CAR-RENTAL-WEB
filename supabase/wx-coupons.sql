create table if not exists public.wx_users (
  openid text primary key,
  nick_name text,
  avatar_url text,
  admin_note text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

alter table public.wx_users add column if not exists admin_note text;

create table if not exists public.wx_user_coupons (
  id uuid primary key default gen_random_uuid(),
  openid text not null references public.wx_users(openid) on delete cascade,
  code text not null,
  title text not null,
  discount_type text not null default 'percent',
  discount_value numeric not null,
  status text not null default 'unused',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wx_user_coupons_openid_idx on public.wx_user_coupons(openid);
create index if not exists wx_user_coupons_code_idx on public.wx_user_coupons(code);

alter table public.wx_user_bookings add column if not exists cny_rate numeric;
alter table public.wx_user_bookings add column if not exists cny_deposit numeric;
alter table public.wx_user_bookings add column if not exists rate_date text;
alter table public.wx_user_bookings add column if not exists status text default 'created';
alter table public.wx_user_bookings add column if not exists promo_code text;
alter table public.wx_user_bookings add column if not exists reservation_no text;
alter table public.wx_user_bookings add column if not exists price_breakdown jsonb;

alter table public.wx_user_bookings add column if not exists deposit_paid boolean not null default false;
alter table public.wx_user_bookings add column if not exists deposit_paid_at timestamptz;
alter table public.wx_user_bookings add column if not exists wx_pay_out_trade_no text;
alter table public.wx_user_bookings add column if not exists wx_pay_amount_cny numeric;
