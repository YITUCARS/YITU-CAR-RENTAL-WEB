create table if not exists public.wx_users (
  openid text primary key,
  nick_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

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
