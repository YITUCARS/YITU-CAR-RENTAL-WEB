alter table public.partner_accounts add column if not exists contact_email text not null default '';
alter table public.partner_accounts add column if not exists contact_phone text not null default '';
