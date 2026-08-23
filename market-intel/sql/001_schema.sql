-- ============================================================================
-- market-intel : competitor rental price collection
-- Idempotent. Applied by `npm run mi -- migrate`.
--
-- Design rule that drives everything below: market_price_observations is
-- APPEND-ONLY. A price is never updated in place, because the whole point is
-- to see how the price for one specific pickup date moves as that date
-- approaches. Every collection writes a new row.
-- ============================================================================

create schema if not exists market_intel;

-- ---------------------------------------------------------------------------
-- Reference: normalized vehicle classes
-- ---------------------------------------------------------------------------
create table if not exists market_intel.vehicle_classes (
  code         text primary key,
  label        text not null,
  sort_order   int  not null default 100,
  typical_seats_min int,
  typical_seats_max int,
  description  text
);

-- ---------------------------------------------------------------------------
-- Locations / markets
-- ---------------------------------------------------------------------------
create table if not exists market_intel.locations (
  code        text primary key,               -- CHC_APT
  name        text not null,                  -- Christchurch Airport
  iata        text,
  city        text,
  country     text not null default 'NZ',
  timezone    text not null default 'Pacific/Auckland',
  currency    text not null default 'NZD',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sources (config-driven; runtime health tracked here)
-- ---------------------------------------------------------------------------
create table if not exists market_intel.sources (
  id           bigserial primary key,
  code         text not null unique,          -- matches the key in sources.yaml
  name         text not null,
  source_type  text not null check (source_type in ('direct','ota')),
  collector    text not null,                 -- adapter id in src/collectors
  access_mode  text not null default 'browser' check (access_mode in ('api','browser','mock')),
  base_url     text not null,
  search_url   text,
  enabled      boolean not null default true, -- mirrors sources.yaml
  config       jsonb  not null default '{}'::jsonb,  -- locations, rate limits, adapter options

  -- runtime health (owned by the runner, never by the config file)
  last_attempt_at        timestamptz,
  last_success_at        timestamptz,
  consecutive_failures   int not null default 0,
  auto_disabled          boolean not null default false,
  auto_disabled_at       timestamptz,
  auto_disabled_reason   text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column market_intel.sources.enabled is
  'Operator intent, synced from sources.yaml. A source is only collected when enabled AND NOT auto_disabled.';

-- ---------------------------------------------------------------------------
-- Collection runs: one batch of jobs (usually one scheduled sweep)
-- ---------------------------------------------------------------------------
create table if not exists market_intel.collection_runs (
  id            uuid primary key,
  label         text,
  trigger       text not null default 'manual' check (trigger in ('manual','schedule','backfill','test')),
  status        text not null default 'pending'
                check (status in ('pending','running','completed','failed','cancelled')),
  planned_jobs  int not null default 0,
  succeeded_jobs int not null default 0,
  failed_jobs   int not null default 0,
  offers_collected int not null default 0,
  started_at    timestamptz,
  finished_at   timestamptz,
  config_snapshot jsonb not null default '{}'::jsonb,  -- scenarios as they were at plan time
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Collection jobs : the queue. One row = one search to perform.
-- Claimed with SELECT ... FOR UPDATE SKIP LOCKED, so multiple workers are safe.
-- ---------------------------------------------------------------------------
create table if not exists market_intel.collection_jobs (
  id              bigserial primary key,
  run_id          uuid not null references market_intel.collection_runs(id) on delete cascade,
  source_id       bigint references market_intel.sources(id) on delete cascade,
  source_code     text not null,

  pickup_location_code text not null references market_intel.locations(code),
  return_location_code text not null references market_intel.locations(code),
  pickup_at       timestamptz not null,          -- absolute instant
  return_at       timestamptz not null,
  pickup_local    timestamp   not null,          -- local wall time at the location
  return_local    timestamp   not null,
  lead_time_days  int not null,                  -- planned lead time (pickup date - plan date)
  duration_days   int not null,
  driver_age      int,
  currency        text,

  status          text not null default 'pending'
                  check (status in ('pending','running','succeeded','failed','skipped','cancelled')),
  priority        int not null default 100,      -- lower runs first
  scheduled_for   timestamptz not null default now(),
  attempts        int not null default 0,
  max_attempts    int not null default 3,

  locked_at       timestamptz,
  locked_by       text,
  started_at      timestamptz,
  finished_at     timestamptz,
  duration_ms     int,
  offers_collected int,
  last_error      text,

  -- makes job generation idempotent: re-running the planner never duplicates
  dedupe_key      text not null unique,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists collection_jobs_claim_idx
  on market_intel.collection_jobs (status, scheduled_for, priority, id)
  where status = 'pending';
create index if not exists collection_jobs_run_idx    on market_intel.collection_jobs (run_id, status);
create index if not exists collection_jobs_source_idx on market_intel.collection_jobs (source_code, created_at desc);
create index if not exists collection_jobs_stale_idx  on market_intel.collection_jobs (locked_at)
  where status = 'running';

-- ---------------------------------------------------------------------------
-- Market price observations : the dataset. APPEND ONLY.
-- ---------------------------------------------------------------------------
create table if not exists market_intel.market_price_observations (
  id                bigserial primary key,
  job_id            bigint references market_intel.collection_jobs(id) on delete set null,
  run_id            uuid   references market_intel.collection_runs(id) on delete set null,

  observed_at       timestamptz not null default now(),
  observed_date     date generated always as (((observed_at at time zone 'Pacific/Auckland'))::date) stored,

  -- ---- who quoted it -------------------------------------------------------
  source_code       text not null,     -- the site we read
  channel           text not null,     -- OTA name, or the company itself when direct
  source_type       text not null check (source_type in ('direct','ota')),
  supplier          text,              -- normalized rental company key, e.g. 'avis'
  supplier_raw      text,              -- exactly as displayed, e.g. 'Avis Rent a Car'

  -- ---- what was searched ---------------------------------------------------
  pickup_location_code text not null,
  return_location_code text not null,
  pickup_location_raw  text,
  return_location_raw  text,
  pickup_datetime      timestamptz not null,
  return_datetime      timestamptz not null,
  pickup_datetime_local timestamp,
  return_datetime_local timestamp,
  lead_time_days    int  not null,     -- days between observed_at and pickup: the curve axis
  duration_days     numeric(6,2) not null,

  -- ---- vehicle -------------------------------------------------------------
  vehicle_name_raw        text not null,   -- 'Toyota RAV4 or similar'
  vehicle_or_similar_text text,            -- 'or similar' / 'or similar model' / null
  vehicle_class_raw       text,            -- the site's own label, 'Intermediate SUV'
  vehicle_class           text references market_intel.vehicle_classes(code),
  vehicle_class_method    text check (vehicle_class_method in ('mapping','rule','manual','llm','unresolved')),
  vehicle_class_confidence numeric(3,2),
  acriss_code       text,                  -- when the source exposes one
  transmission      text check (transmission in ('automatic','manual','unknown')),
  transmission_raw  text,
  fuel_type         text check (fuel_type in ('petrol','diesel','hybrid','plugin_hybrid','electric','unknown')),
  fuel_type_raw     text,
  seats             int,
  bags              int,
  doors             int,

  -- ---- price ---------------------------------------------------------------
  currency          text not null,
  total_price       numeric(12,2),
  daily_price       numeric(12,2),
  total_price_raw   text,                  -- 'NZ$449.00' exactly as shown
  daily_price_raw   text,
  price_includes_taxes boolean,
  pay_type          text check (pay_type in ('prepaid','pay_at_counter','unknown')),

  -- ---- terms ---------------------------------------------------------------
  availability      text not null default 'available'
                    check (availability in ('available','on_request','sold_out','unknown')),
  availability_raw  text,
  mileage_unlimited boolean,
  mileage_limit_km  int,
  mileage_limit_raw text,
  deposit_amount    numeric(12,2),
  deposit_raw       text,
  insurance_excess_amount numeric(12,2),
  insurance_excess_raw    text,
  insurance_product text,
  location_fees     numeric(12,2),
  location_fees_raw text,
  fees              jsonb,                 -- itemised breakdown when visible

  -- ---- provenance ----------------------------------------------------------
  source_url        text,
  offer_fingerprint text,                  -- stable id of this offer within one search
  collector_version text,
  raw               jsonb not null default '{}'::jsonb,  -- untouched extracted record

  created_at        timestamptz not null default now()
);

-- The query that matters most: one pickup date + class, over observation time.
create index if not exists mpo_curve_idx on market_intel.market_price_observations
  (pickup_location_code, pickup_datetime, vehicle_class, duration_days, observed_at desc);
create index if not exists mpo_observed_idx  on market_intel.market_price_observations (observed_at desc);
create index if not exists mpo_source_idx    on market_intel.market_price_observations (source_code, observed_at desc);
create index if not exists mpo_supplier_idx  on market_intel.market_price_observations (supplier, observed_at desc);
create index if not exists mpo_job_idx       on market_intel.market_price_observations (job_id);
create index if not exists mpo_unclassified_idx on market_intel.market_price_observations (vehicle_name_raw)
  where vehicle_class is null;

-- ---------------------------------------------------------------------------
-- Vehicle class mapping : deterministic raw text -> normalized class
-- Matched in priority order; first hit wins. No LLM in this path.
-- ---------------------------------------------------------------------------
create table if not exists market_intel.vehicle_class_mapping (
  id           bigserial primary key,
  match_type   text not null check (match_type in ('exact','contains','regex')),
  pattern      text not null,            -- compared against the normalized raw string
  source_code  text,                     -- null = applies to every source
  vehicle_class text not null references market_intel.vehicle_classes(code),
  seats_min    int,                      -- optional extra condition
  seats_max    int,
  priority     int not null default 100, -- lower wins
  confidence   numeric(3,2) not null default 0.90,
  active       boolean not null default true,
  notes        text,
  created_by   text not null default 'seed',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists vehicle_class_mapping_unique_idx
  on market_intel.vehicle_class_mapping (match_type, pattern, coalesce(source_code, '*'));
create index if not exists vehicle_class_mapping_lookup_idx
  on market_intel.vehicle_class_mapping (active, priority, match_type);

-- Everything the deterministic layer could not classify, queued for a human.
create table if not exists market_intel.vehicle_class_unresolved (
  id             bigserial primary key,
  vehicle_name_raw text not null,
  normalized_key   text not null,          -- lowercased/squashed form used for matching
  vehicle_class_raw text,
  source_code    text not null,
  sample_seats   int,
  sample_url     text,
  occurrences    int not null default 1,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  status         text not null default 'open' check (status in ('open','mapped','ignored')),
  resolved_class text references market_intel.vehicle_classes(code),
  resolved_at    timestamptz,
  resolved_by    text
);
create unique index if not exists vehicle_class_unresolved_key_idx
  on market_intel.vehicle_class_unresolved (source_code, normalized_key);

-- ---------------------------------------------------------------------------
-- Collection errors : one row per failed attempt, with debug artifacts
-- ---------------------------------------------------------------------------
create table if not exists market_intel.collection_errors (
  id            bigserial primary key,
  job_id        bigint references market_intel.collection_jobs(id) on delete cascade,
  run_id        uuid   references market_intel.collection_runs(id) on delete cascade,
  source_code   text not null,
  stage         text not null default 'unknown'
                check (stage in ('config','navigate','search','parse','normalize','persist','timeout','rate_limit','unknown')),
  error_type    text,
  message       text not null,
  stack         text,
  attempt       int not null default 1,
  retryable     boolean not null default true,
  http_status   int,
  url           text,
  screenshot_path   text,
  html_snapshot_path text,
  context       jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index if not exists collection_errors_source_idx on market_intel.collection_errors (source_code, occurred_at desc);
create index if not exists collection_errors_job_idx    on market_intel.collection_errors (job_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function market_intel.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['locations','sources','collection_jobs','vehicle_class_mapping'] loop
    execute format(
      'drop trigger if exists %I_touch on market_intel.%I; '
      'create trigger %I_touch before update on market_intel.%I '
      'for each row execute function market_intel.touch_updated_at();',
      t, t, t, t);
  end loop;
end $$;
