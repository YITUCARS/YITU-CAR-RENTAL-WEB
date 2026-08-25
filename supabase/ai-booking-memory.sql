create table if not exists public.ai_booking_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  locale text not null default 'en',
  response_language text not null default 'English',
  status text not null default 'needs_info',
  messages jsonb not null default '[]'::jsonb,
  structured_search jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  recommended_vehicles jsonb not null default '[]'::jsonb,
  booking_url text,
  source text not null default 'tri-ai-car-finder',
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_booking_conversations_last_activity_idx
  on public.ai_booking_conversations (last_activity_at desc);

alter table public.ai_booking_conversations enable row level security;

create or replace function public.set_ai_booking_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.last_activity_at = now();
  return new;
end;
$$;

drop trigger if exists ai_booking_conversations_updated_at on public.ai_booking_conversations;
create trigger ai_booking_conversations_updated_at
before update on public.ai_booking_conversations
for each row execute function public.set_ai_booking_conversations_updated_at();
