-- Shared website / WeChat mini-program deal content.
-- Run this once in Supabase SQL Editor before using the new mini-program editor.
alter table public.deals add column if not exists tag_zh text not null default '';
alter table public.deals add column if not exists badge_zh text not null default '';
alter table public.deals add column if not exists title_zh text not null default '';
alter table public.deals add column if not exists subtitle_zh text not null default '';
alter table public.deals add column if not exists detail_zh text not null default '';
alter table public.deals add column if not exists theme text not null default 'navy';

-- Seed the Chinese fields from existing website content so existing deals remain visible.
update public.deals
set title_zh = coalesce(nullif(title_zh, ''), title),
    subtitle_zh = coalesce(nullif(subtitle_zh, ''), description),
    detail_zh = coalesce(nullif(detail_zh, ''), content),
    badge_zh = coalesce(nullif(badge_zh, ''), badge)
where title_zh = '' or subtitle_zh = '' or detail_zh = '' or badge_zh = '';
