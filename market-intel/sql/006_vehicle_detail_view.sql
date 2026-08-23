-- ============================================================================
-- Per-model detail behind each normalized class.
--
-- The class is what makes competitors comparable; it is not what you price
-- against. Two cars in MIDSIZE_SUV can sit 50% apart, and that spread is
-- usually the interesting part — an untuned rate, an old model still on the
-- rack rate, or a genuine positioning gap. The dashboard shows the class
-- median, and this view is what it expands into.
-- ============================================================================

create or replace view public.mi_vehicle_prices as
select
  o.observed_date,
  o.pickup_location_code,
  (o.pickup_datetime at time zone 'Pacific/Auckland')::date as pickup_date,
  o.duration_days,
  o.vehicle_class,
  o.vehicle_name_raw,
  o.vehicle_class_method,
  o.acriss_code,
  o.seats,
  o.bags,
  o.transmission,
  o.fuel_type,
  o.source_code,
  o.channel,
  o.supplier,
  o.supplier_raw,
  o.availability,
  o.lead_time_days,
  o.currency,
  min(o.daily_price)  as daily_price,
  min(o.total_price)  as total_price,
  max(o.daily_price)  as daily_price_high,
  count(*)::int       as quote_count,
  max(o.source_url)   as source_url
from market_intel.market_price_observations o
group by
  o.observed_date, o.pickup_location_code, 3, o.duration_days,
  o.vehicle_class, o.vehicle_name_raw, o.vehicle_class_method, o.acriss_code,
  o.seats, o.bags, o.transmission, o.fuel_type,
  o.source_code, o.channel, o.supplier, o.supplier_raw,
  o.availability, o.lead_time_days, o.currency;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.mi_vehicle_prices from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.mi_vehicle_prices from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.mi_vehicle_prices to service_role;
  end if;
end $$;
