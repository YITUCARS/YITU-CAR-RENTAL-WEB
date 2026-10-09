-- Settings for the WeChat mini program that are shared by every phone,
-- such as the Chinese home-page promotions (key 'promotions').
-- Separate from the website's English `deals` table on purpose.
create table if not exists public.mp_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Only the website's server (service role) reads and writes this table.
alter table public.mp_settings enable row level security;
