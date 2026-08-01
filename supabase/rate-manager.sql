-- ============================================================
-- Rate Manager (价格管理) schema
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
-- Seed data (parsed from the OTA template + RCM export) is appended below.
-- ============================================================

-- Stores / 门店 (e.g. 易途租车-基督城 222, 易途租车-皇后镇 8625)
create table if not exists public.rate_stores (
  id          uuid primary key default gen_random_uuid(),
  ota_store_id text not null unique,        -- 门店ID used by the OTA upload template
  name        text not null,                -- 门店名称
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Vehicle categories / 车型组. The OTA vehicle-group id is global per platform;
-- which stores actually offer a group is tracked in rate_store_categories.
create table if not exists public.rate_vehicle_categories (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,            -- website display name
  rcm_category_code           text,                     -- RCM category code (e.g. UVAR / CDAH)
  rcm_export_name             text,                     -- exact "Category" name in the RCM Rate Export (import match key)
  ota_group_id                text unique,              -- 车型组ID (OTA "OTA-A" template)
  ota_group_name              text,                     -- 车型组名称 (full string the OTA validates)
  ota_codes                   jsonb not null default '{}'::jsonb,  -- future: { "<channelId>": "<code>" }
  minimum_net_revenue_per_day numeric,                  -- warn when any tier's net falls below this
  currency                    text not null default 'NZD',
  active                      boolean not null default true,
  created_at                  timestamptz not null default now()
);

-- Which categories each store sells (drives the export row set)
create table if not exists public.rate_store_categories (
  store_id    uuid not null references public.rate_stores(id) on delete cascade,
  category_id uuid not null references public.rate_vehicle_categories(id) on delete cascade,
  primary key (store_id, category_id)
);

-- Seasons / 区间价格 (a named date range)
create table if not exists public.rate_seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                  -- 区间价格名称
  date_from  date not null,
  date_to    date not null,
  created_at timestamptz not null default now(),
  unique (date_from, date_to)
);

-- Master retail rates — the single source of truth. Tiered by rental length
-- (1-3 / 4-6 / 7+ days) to match both the OTA template and RCM export.
-- Prices are store-independent: same master price across every channel & store.
create table if not exists public.rate_master_rates (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.rate_vehicle_categories(id) on delete cascade,
  season_id    uuid not null references public.rate_seasons(id) on delete cascade,
  price_1_3    numeric,                       -- per-day retail price, 1-3 days
  price_4_6    numeric,                       -- per-day retail price, 4-6 days
  price_7_plus numeric,                       -- per-day retail price, 7+ days
  currency     text not null default 'NZD',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (category_id, season_id)
);

-- OTA channels. pricing_policy is fixed to 'same_retail_price': commission only
-- affects internal net-revenue maths, never the exported customer price.
create table if not exists public.rate_ota_channels (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  commission_rate     numeric not null default 0.15,            -- 0.15 = 15%
  pricing_policy      text not null default 'same_retail_price',
  excel_template_type text not null default 'pricing_period',   -- which export template
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- Export history / 导出历史. channel & store names are denormalised so the log
-- stays readable even if the channel/store is later renamed or deleted.
create table if not exists public.rate_export_logs (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid references public.rate_ota_channels(id) on delete set null,
  channel_name text,
  store_id     uuid references public.rate_stores(id) on delete set null,
  store_name   text,
  season_id    uuid references public.rate_seasons(id) on delete set null,
  date_from    date,
  date_to      date,
  category_ids jsonb not null default '[]'::jsonb,
  row_count    int not null default 0,
  generated_by text,
  file_name    text not null,
  generated_at timestamptz not null default now()
);

create index if not exists rate_master_rates_cat_idx    on public.rate_master_rates(category_id);
create index if not exists rate_master_rates_season_idx on public.rate_master_rates(season_id);
create index if not exists rate_export_logs_at_idx      on public.rate_export_logs(generated_at desc);

-- Safety for databases created before rcm_export_name existed:
alter table public.rate_vehicle_categories add column if not exists rcm_export_name text;

-- ============================================================
-- Rate Manager seed data (generated from OTA template + RCM export)
-- Run AFTER rate-manager schema (tables created in same file above).
-- ============================================================

-- Stores
insert into public.rate_stores (ota_store_id, name) values ('222', '易途租车-基督城') on conflict (ota_store_id) do update set name = excluded.name;
insert into public.rate_stores (ota_store_id, name) values ('8625', '易途租车-皇后镇') on conflict (ota_store_id) do update set name = excluded.name;

-- Vehicle categories (from OTA vehicle groups)
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高级豪华型MPV(Toyota Alphard 2016-2018·2016-2018款·UVAR·7座)', 'UVAR', '1003', '高级豪华型MPV(Toyota Alphard 2016-2018·2016-2018款·UVAR·7座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端经济型SUV(丰田 RAV4·2019-2022款·HFAV·5座)', 'HFAV', '1298', '高端经济型SUV(丰田 RAV4·2019-2022款·HFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端豪华型SUV(玛莎拉蒂 Levante·WFAD·5座)', 'WFAD', '2110', '高端豪华型SUV(玛莎拉蒂 Levante·WFAD·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端豪华型SUV(路虎 揽胜·WFAD·5座)', 'WFAD', '2111', '高端豪华型SUV(路虎 揽胜·WFAD·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('大型车MPV(Toyota Alphard 8 Seats·2016-2018款·FVAV·8座)', 'FVAV', '2251', '大型车MPV(Toyota Alphard 8 Seats·2016-2018款·FVAV·8座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端经济型SUV(丰田 RAV4 混动四驱版·2019-2022款·HFBH·5座)', 'HFBH', '4295', '高端经济型SUV(丰田 RAV4 混动四驱版·2019-2022款·HFBH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(本田 CR-V 4WD·2024-2024款·CFBV·5座)', 'CFBV', '37162', '紧凑型SUV(本田 CR-V 4WD·2024-2024款·CFBV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型SUV(日产 奇骏 四驱版·2025-2025款·SFDV·7座)', 'SFDV', '37429', '标准型SUV(日产 奇骏 四驱版·2025-2025款·SFDV·7座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型SUV(本田 CR-V·2023-2023款·SFAV·5座)', 'SFAV', '37464', '标准型SUV(本田 CR-V·2023-2023款·SFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端大型车SUV(丰田 FJ Cruiser·GFBV·5座)', 'GFBV', '37603', '高端大型车SUV(丰田 FJ Cruiser·GFBV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端大型车MPV(Toyota Vellfire·GVAV·8座)', 'GVAV', '37658', '高端大型车MPV(Toyota Vellfire·GVAV·8座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('豪华型MPV(Toyota Alphard·2016-2018款·LVAV·7座)', 'LVAV', '37705', '豪华型MPV(Toyota Alphard·2016-2018款·LVAV·7座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('大型车MPV(起亚 嘉华·2023-2023款·FVAD·8座)', 'FVAD', '37798', '大型车MPV(起亚 嘉华·2023-2023款·FVAD·8座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(Nissan X-Trail·2025-2025款·CFAV·5座)', 'CFAV', '38142', '紧凑型SUV(Nissan X-Trail·2025-2025款·CFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型轿车(本田 Jazz·CCAV·5座)', 'CCAV', '38287', '紧凑型轿车(本田 Jazz·CCAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型轿车(斯巴鲁 Levorg·SDBV·5座)', 'SDBV', '38300', '标准型轿车(斯巴鲁 Levorg·SDBV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型轿车(丰田 卡罗拉 两厢版·2023-2023款·CDAV·5座)', 'CDAV', '38343', '紧凑型轿车(丰田 卡罗拉 两厢版·2023-2023款·CDAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型SUV(丰田 RAV4 四驱版·2022-2022款·SFDV·5座)', 'SFDV', '38384', '标准型SUV(丰田 RAV4 四驱版·2022-2022款·SFDV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(丰田 RAV4 GX·2013-2015款·CFBV·5座)', 'CFBV', '38427', '紧凑型SUV(丰田 RAV4 GX·2013-2015款·CFBV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(丰田 RAV4·2022-2022款·CFAV·5座)', 'CFAV', '38456', '紧凑型SUV(丰田 RAV4·2022-2022款·CFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('中型车SUV(长城 坦克300·IFBV·5座)', 'IFBV', '38461', '中型车SUV(长城 坦克300·IFBV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('中型车SUV(三菱 欧蓝德·2021-2021款·IFAV·5座)', 'IFAV', '38767', '中型车SUV(三菱 欧蓝德·2021-2021款·IFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(本田 CR-V·2024-2024款·CFDV·5座)', 'CFDV', '38857', '紧凑型SUV(本田 CR-V·2024-2024款·CFDV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(本田 致在·CFAH·5座)', 'CFAH', '38922', '紧凑型SUV(本田 致在·CFAH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(丰田 卡罗拉锐放·2023-2023款·CFAH·5座)', 'CFAH', '38923', '紧凑型SUV(丰田 卡罗拉锐放·2023-2023款·CFAH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端紧凑型SUV(MINI Countryman·DFAV·5座)', 'DFAV', '39129', '高端紧凑型SUV(MINI Countryman·DFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('大型车MPV(丰田 海狮·FVAV·10座)', 'FVAV', '39606', '大型车MPV(丰田 海狮·FVAV·10座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(丰田 RAV4·2025-2025款·CFAV·5座)', 'CFAV', '39734', '紧凑型SUV(丰田 RAV4·2025-2025款·CFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型轿车(丰田 Aqua·2017-2020款·CDAH·5座)', 'CDAH', '39957', '紧凑型轿车(丰田 Aqua·2017-2020款·CDAH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('大型车SUV(丰田 普拉多 GX·2012-2015款·FFAD·5座)', 'FFAD', '39959', '大型车SUV(丰田 普拉多 GX·2012-2015款·FFAD·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型轿车(奥迪 A6·SDAV·5座)', 'SDAV', '39991', '标准型轿车(奥迪 A6·SDAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(丰田 RAV4·2025-2025款·CFAH·5座)', 'CFAH', '40031', '紧凑型SUV(丰田 RAV4·2025-2025款·CFAH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(本田 HR-V·CFAH·5座)', 'CFAH', '40159', '紧凑型SUV(本田 HR-V·CFAH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(本田 致在·CFAV·5座)', 'CFAV', '40160', '紧凑型SUV(本田 致在·CFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型轿车(雷克萨斯 IS·SDAV·5座)', 'SDAV', '40235', '标准型轿车(雷克萨斯 IS·SDAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('大型车常规皮卡(丰田 Hilux·FPBD·5座)', 'FPBD', '40722', '大型车常规皮卡(丰田 Hilux·FPBD·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(奇瑞 欧萌达·CFAE·5座)', 'CFAE', '40768', '紧凑型SUV(奇瑞 欧萌达·CFAE·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('标准型轿车(特斯拉 Model 3·SDAE·5座)', 'SDAE', '40769', '标准型轿车(特斯拉 Model 3·SDAE·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高级豪华型旅行车(Audi A4·UWAH·5座)', 'UWAH', '41357', '高级豪华型旅行车(Audi A4·UWAH·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高级豪华型SUV(BMW X1·UFAV·5座)', 'UFAV', '41457', '高级豪华型SUV(BMW X1·UFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('紧凑型SUV(MG ZS·CFAV·5座)', 'CFAV', '41763', '紧凑型SUV(MG ZS·CFAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('大型车SUV(MG linghang·FFAV·7座)', 'FFAV', '41764', '大型车SUV(MG linghang·FFAV·7座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('豪华型MPV(Toyota Alphard 4th Generation·2019-2023款·LVAV·7座)', 'LVAV', '41779', '豪华型MPV(Toyota Alphard 4th Generation·2019-2023款·LVAV·7座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端豪华型轿车(Maserati Ghibli·WDAV·5座)', 'WDAV', '41788', '高端豪华型轿车(Maserati Ghibli·WDAV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('高端豪华型跑车(MINI JCW Hatchback·WRAV·4座)', 'WRAV', '41789', '高端豪华型跑车(MINI JCW Hatchback·WRAV·4座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;
insert into public.rate_vehicle_categories (name, rcm_category_code, ota_group_id, ota_group_name) values ('豪华型旅行车(BMW M340 Estate·LWBV·5座)', 'LWBV', '42076', '豪华型旅行车(BMW M340 Estate·LWBV·5座)') on conflict (ota_group_id) do update set ota_group_name = excluded.ota_group_name;

-- Store ↔ category availability
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='1003' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='1298' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='2110' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='2111' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='2251' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='4295' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37162' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37429' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37464' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37603' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37658' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37705' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='37798' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38142' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38287' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38300' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38343' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38384' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38427' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38456' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38461' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38767' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38857' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38922' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='38923' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='39129' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='39606' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='39734' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='39957' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='39959' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='39991' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40031' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40159' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40160' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40235' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40722' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40768' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='40769' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41357' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41457' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41763' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41764' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41779' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41788' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='41789' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='222' and c.ota_group_id='42076' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='1003' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='37464' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='38142' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='38767' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='38857' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='39129' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='39606' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='39734' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='39991' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='40031' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='40160' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='40722' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='40768' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='40769' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='41763' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='41764' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='41779' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='41788' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='41789' on conflict do nothing;
insert into public.rate_store_categories (store_id, category_id) select st.id, c.id from public.rate_stores st, public.rate_vehicle_categories c where st.ota_store_id='8625' and c.ota_group_id='42076' on conflict do nothing;

-- Seasons
insert into public.rate_seasons (name, date_from, date_to) values ('2026-05-26 → 2026-07-01', '2026-05-26', '2026-07-01') on conflict (date_from, date_to) do update set name = excluded.name;

-- Default OTA channel (15% commission, same-retail-price policy)
insert into public.rate_ota_channels (name, commission_rate, pricing_policy, excel_template_type) values ('OTA-A', 0.15, 'same_retail_price', 'pricing_period') on conflict (name) do nothing;

-- Bind matched RCM export names so future RCM imports auto-match by exact name
update public.rate_vehicle_categories set rcm_export_name = 'Audi A4 2021-2025' where ota_group_id = '41357';
update public.rate_vehicle_categories set rcm_export_name = 'Audi A6 2012-2015' where ota_group_id = '39991';
update public.rate_vehicle_categories set rcm_export_name = 'BMW X1' where ota_group_id = '41457';
update public.rate_vehicle_categories set rcm_export_name = 'GWM TANK 300 2024-2025' where ota_group_id = '38461';
update public.rate_vehicle_categories set rcm_export_name = 'Honda CRV AWD or Similar' where ota_group_id = '37162';
update public.rate_vehicle_categories set rcm_export_name = 'HONDA HRV OR Similar' where ota_group_id = '40159';
update public.rate_vehicle_categories set rcm_export_name = 'Honda JAZZ or Similar' where ota_group_id = '38287';
update public.rate_vehicle_categories set rcm_export_name = 'Lexus IS 2013-2018' where ota_group_id = '40235';
update public.rate_vehicle_categories set rcm_export_name = 'Maserati Ghibli 2014-2019' where ota_group_id = '41788';
update public.rate_vehicle_categories set rcm_export_name = 'Maserati Levante 2017-2020' where ota_group_id = '2110';
update public.rate_vehicle_categories set rcm_export_name = 'MG ZS' where ota_group_id = '41763';
update public.rate_vehicle_categories set rcm_export_name = 'MINI Countryman 2024-2025' where ota_group_id = '39129';
update public.rate_vehicle_categories set rcm_export_name = 'MINI JCW 2026' where ota_group_id = '41789';
update public.rate_vehicle_categories set rcm_export_name = 'Nissan X-Trail AWD or Simialr' where ota_group_id = '38142';
update public.rate_vehicle_categories set rcm_export_name = 'Subaru Levorg Station Wagon' where ota_group_id = '38300';
update public.rate_vehicle_categories set rcm_export_name = 'Telsa Model 3 2021-2023' where ota_group_id = '40769';
update public.rate_vehicle_categories set rcm_export_name = 'Toyota FJ Cruiser  2012-2015' where ota_group_id = '37603';
update public.rate_vehicle_categories set rcm_export_name = 'Toyota Hilux Or Similar' where ota_group_id = '40722';
update public.rate_vehicle_categories set rcm_export_name = 'Toyota RAV4 Hybrid or Similar' where ota_group_id = '1298';
update public.rate_vehicle_categories set rcm_export_name = 'Toyota Vellfire 7 Seats' where ota_group_id = '37658';

-- Master rates (matched RCM prices → OTA categories)
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 160, 140, 120, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='41357' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 120, 100, 80, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='39991' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 150, 130, 110, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='41457' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 130, 110, 90, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='38461' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 100, 80, 50, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='37162' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 100, 80, 50, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='40159' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 100, 80, 50, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='38287' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 120, 100, 80, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='40235' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 320, 300, 280, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='41788' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 320, 300, 280, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='2110' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 80, 60, 40, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='41763' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 150, 130, 110, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='39129' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 320, 300, 280, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='41789' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 100, 80, 60, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='38142' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 110, 90, 70, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='38300' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 190, 170, 150, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='40769' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 150, 130, 110, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='37603' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 126, 112, 105, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='40722' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 90, 70, 50, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='1298' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;
insert into public.rate_master_rates (category_id, season_id, price_1_3, price_4_6, price_7_plus, currency) select c.id, s.id, 240, 220, 200, 'NZD' from public.rate_vehicle_categories c, public.rate_seasons s where c.ota_group_id='37658' and s.date_from='2026-05-26' and s.date_to='2026-07-01' on conflict (category_id, season_id) do update set price_1_3=excluded.price_1_3, price_4_6=excluded.price_4_6, price_7_plus=excluded.price_7_plus;

-- Unmatched RCM rows (no confident OTA group match) — set prices manually in the UI:
--   BMW M340i  →  290/270/250
--   Honda CRV or Similar  →  100/80/50
--   HONDA ZRV HYBRID or Similar  →  90/70/50
--   HONDA ZRV or Similar  →  80/60/40
--   MG QS  →  140/120/100
--   Mitsubishi Outlander Or Simila  →  110/90/70
--   Range Rover Vogue 2014-2018  →  320/300/280
--   Toyota Haice 10-12 Seats  →  189/175/161
--   Toyota Prado or Similar  →  120/100/80
--   Toyota RAV4 or Similar  →  90/70/50
--   Toyota Vellfire 8 Seats  →  240/220/200

-- Reload PostgREST schema cache so new columns are visible to the API immediately
notify pgrst, 'reload schema';
