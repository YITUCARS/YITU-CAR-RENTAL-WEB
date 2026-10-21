-- Per-deal readability settings for text over the deal image (admin 优惠活动 → 显示效果).
alter table public.deals add column if not exists overlay smallint not null default 0;        -- extra dark layer, 0–80 %
alter table public.deals add column if not exists text_scale smallint not null default 100;  -- text size, % of default
