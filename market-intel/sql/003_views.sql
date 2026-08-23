-- ============================================================================
-- Analysis + monitoring views.
-- These are plain views over the append-only observation table, so they always
-- reflect the full history. Nothing here aggregates destructively.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Source health, for the admin dashboard (Milestone 5)
-- ---------------------------------------------------------------------------
create or replace view market_intel.v_source_health as
select
  s.code                       as source_code,
  s.name,
  s.source_type,
  s.enabled,
  s.auto_disabled,
  s.auto_disabled_reason,
  s.consecutive_failures,
  s.last_success_at,
  s.last_attempt_at,
  (select count(*) from market_intel.collection_jobs j
     where j.source_code = s.code and j.status = 'pending')                    as pending_jobs,
  (select count(*) from market_intel.collection_jobs j
     where j.source_code = s.code and j.status = 'failed'
       and j.finished_at > now() - interval '24 hours')                        as failed_jobs_24h,
  (select count(*) from market_intel.market_price_observations o
     where o.source_code = s.code and o.observed_at > now() - interval '24 hours') as offers_24h,
  (select count(*) from market_intel.collection_errors e
     where e.source_code = s.code and e.occurred_at > now() - interval '24 hours') as errors_24h,
  (select count(*) from market_intel.market_price_observations o
     where o.source_code = s.code and o.vehicle_class is null
       and o.observed_at > now() - interval '7 days')                          as unclassified_7d
from market_intel.sources s;

-- ---------------------------------------------------------------------------
-- One row per (observation day, pickup date, class, duration): the market
-- snapshot. min / median / max across every competitor seen that day.
-- ---------------------------------------------------------------------------
create or replace view market_intel.v_market_daily as
select
  o.observed_date,
  o.pickup_location_code,
  (o.pickup_datetime at time zone 'Pacific/Auckland')::date as pickup_date,
  o.vehicle_class,
  o.duration_days,
  min(o.lead_time_days)                                          as lead_time_days,
  count(*)                                                       as offer_count,
  count(distinct o.supplier)                                     as supplier_count,
  count(distinct o.source_code)                                  as source_count,
  min(o.daily_price)                                             as min_daily_price,
  percentile_cont(0.5) within group (order by o.daily_price)     as median_daily_price,
  avg(o.daily_price)::numeric(12,2)                              as avg_daily_price,
  max(o.daily_price)                                             as max_daily_price,
  min(o.total_price)                                             as min_total_price,
  percentile_cont(0.5) within group (order by o.total_price)     as median_total_price,
  o.currency
from market_intel.market_price_observations o
where o.availability = 'available'
  and o.daily_price is not null
  and o.vehicle_class is not null
group by 1,2,3,4,5, o.currency;

-- ---------------------------------------------------------------------------
-- THE point of the project: how the price for one fixed pickup date moves as
-- that date approaches.
--
--   select * from market_intel.v_lead_time_curve
--   where pickup_date = '2026-09-20' and vehicle_class = 'MIDSIZE_SUV'
--     and duration_days = 5
--   order by observed_date;
-- ---------------------------------------------------------------------------
create or replace view market_intel.v_lead_time_curve as
select
  o.pickup_location_code,
  (o.pickup_datetime at time zone 'Pacific/Auckland')::date      as pickup_date,
  o.vehicle_class,
  o.duration_days,
  o.observed_date,
  ((o.pickup_datetime at time zone 'Pacific/Auckland')::date - o.observed_date) as days_before_pickup,
  count(*)                                                       as offer_count,
  min(o.daily_price)                                             as min_daily_price,
  percentile_cont(0.5) within group (order by o.daily_price)     as median_daily_price,
  max(o.daily_price)                                             as max_daily_price,
  o.currency
from market_intel.market_price_observations o
where o.availability = 'available'
  and o.daily_price is not null
  and o.vehicle_class is not null
group by 1,2,3,4,5,6, o.currency;

-- ---------------------------------------------------------------------------
-- Per-supplier view, correctly de-duplicated across channels: the same Avis
-- car seen on three OTAs is three quotes for ONE supplier, not three fleets.
-- ---------------------------------------------------------------------------
create or replace view market_intel.v_supplier_daily as
select
  o.observed_date,
  o.pickup_location_code,
  (o.pickup_datetime at time zone 'Pacific/Auckland')::date as pickup_date,
  o.supplier,
  o.vehicle_class,
  o.duration_days,
  count(*)                                                   as quote_count,
  count(distinct o.channel)                                  as channel_count,
  array_agg(distinct o.channel order by o.channel)           as channels,
  min(o.daily_price)                                         as cheapest_daily_price,
  max(o.daily_price)                                         as dearest_daily_price,
  (min(o.daily_price) filter (where o.source_type = 'direct'))  as direct_daily_price,
  (min(o.daily_price) filter (where o.source_type = 'ota'))     as ota_daily_price,
  o.currency
from market_intel.market_price_observations o
where o.supplier is not null
  and o.daily_price is not null
group by 1,2,3,4,5,6, o.currency;

-- ---------------------------------------------------------------------------
-- Vehicles the deterministic normalizer could not classify, most frequent
-- first. This is the manual-review queue.
-- ---------------------------------------------------------------------------
create or replace view market_intel.v_unresolved_vehicles as
select
  u.normalized_key,
  u.vehicle_name_raw,
  u.vehicle_class_raw,
  u.source_code,
  u.sample_seats,
  u.occurrences,
  u.first_seen_at,
  u.last_seen_at,
  u.sample_url
from market_intel.vehicle_class_unresolved u
where u.status = 'open'
order by u.occurrences desc, u.last_seen_at desc;
