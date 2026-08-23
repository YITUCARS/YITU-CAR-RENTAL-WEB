-- ============================================================================
-- Read-only bridge into the website's /admin.
--
-- Supabase's PostgREST only serves schemas it has been told to expose, and
-- market_intel is deliberately not one of them. Rather than exposing the whole
-- schema, this publishes a handful of `public.mi_*` views: read-only, granted
-- to service_role only, and revoked from anon/authenticated so nothing here is
-- reachable from the public website.
--
-- The admin API routes already run with the service role key server-side, so
-- they can read these and nobody else can.
-- ============================================================================

create or replace view public.mi_source_health as
  select * from market_intel.v_source_health;

create or replace view public.mi_market_daily as
  select * from market_intel.v_market_daily;

create or replace view public.mi_lead_time_curve as
  select * from market_intel.v_lead_time_curve;

create or replace view public.mi_supplier_daily as
  select * from market_intel.v_supplier_daily;

create or replace view public.mi_unresolved_vehicles as
  select * from market_intel.v_unresolved_vehicles;

-- Headline numbers for the dashboard's top row.
create or replace view public.mi_dataset_summary as
select
  (select count(*) from market_intel.market_price_observations)                    as observations,
  (select count(*) from market_intel.market_price_observations
     where observed_at > now() - interval '24 hours')                              as observations_24h,
  (select min(observed_at) from market_intel.market_price_observations)            as first_observed_at,
  (select max(observed_at) from market_intel.market_price_observations)            as last_observed_at,
  (select count(*) from market_intel.sources where enabled and not auto_disabled)  as active_sources,
  (select count(*) from market_intel.sources where auto_disabled)                  as disabled_sources,
  (select count(*) from market_intel.collection_jobs where status = 'pending')     as pending_jobs,
  (select count(*) from market_intel.collection_jobs
     where status = 'failed' and finished_at > now() - interval '24 hours')        as failed_jobs_24h,
  (select count(*) from market_intel.vehicle_class_unresolved where status = 'open') as unresolved_vehicles,
  (select count(distinct (pickup_datetime at time zone 'Pacific/Auckland')::date)
     from market_intel.market_price_observations)                                  as pickup_dates_tracked;

-- Which pickup dates have enough history to plot a curve, most imminent first.
create or replace view public.mi_pickup_dates as
select
  o.pickup_location_code,
  (o.pickup_datetime at time zone 'Pacific/Auckland')::date as pickup_date,
  o.duration_days,
  count(*)                                     as observations,
  count(distinct o.observed_date)              as observation_days,
  min(o.observed_date)                         as first_observed_on,
  max(o.observed_date)                         as last_observed_on,
  min(o.lead_time_days)                        as min_lead_time_days,
  max(o.lead_time_days)                        as max_lead_time_days
from market_intel.market_price_observations o
group by 1, 2, 3;

-- Most recent collection runs, for the "last collection" panel.
create or replace view public.mi_recent_runs as
select r.id, r.label, r.trigger, r.status, r.planned_jobs, r.succeeded_jobs,
       r.failed_jobs, r.offers_collected, r.started_at, r.finished_at
from market_intel.collection_runs r
order by coalesce(r.started_at, r.created_at) desc
limit 20;

create or replace view public.mi_recent_errors as
select e.id, e.source_code, e.stage, e.error_type, e.message, e.attempt,
       e.occurred_at, e.screenshot_path, e.html_snapshot_path
from market_intel.collection_errors e
order by e.occurred_at desc
limit 50;

-- ---------------------------------------------------------------------------
-- Lock them down. Supabase grants new public objects to anon/authenticated by
-- default, which would put our competitor dataset on the public API.
-- Wrapped in a role check so this file also applies to a plain Postgres (and
-- to the in-process Postgres the tests run against), where those roles do not
-- exist.
-- ---------------------------------------------------------------------------
do $$
declare
  v text;
  views text[] := array[
    'mi_source_health','mi_market_daily','mi_lead_time_curve','mi_supplier_daily',
    'mi_unresolved_vehicles','mi_dataset_summary','mi_pickup_dates',
    'mi_recent_runs','mi_recent_errors'
  ];
begin
  foreach v in array views loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', v);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', v);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select on public.%I to service_role', v);
    end if;
  end loop;
end $$;
