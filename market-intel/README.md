# market-intel

Competitor rental price collection for Yitu Rental. Collects competitor prices
on a schedule, stores every observation permanently, and turns that history
into a lead-time pricing curve we can model against.

The dataset is the product. Collection is just how we fill it.

## Why append-only

The same pickup date is searched repeatedly as it approaches, and every search
writes a new row:

```
observed 2026-08-23 -> pickup 2026-09-20, 5 days, midsize SUV = $90/day
observed 2026-08-30 -> pickup 2026-09-20, 5 days, midsize SUV = $100/day
observed 2026-09-10 -> pickup 2026-09-20, 5 days, midsize SUV = $125/day
```

Nothing is ever updated in place, so that curve is reconstructable for any
pickup date, class and duration we have collected.

## Where it lives

`market-intel/` is an independent Node package inside the website repo. It has
its own `package.json`, its own dependencies and its own lifecycle — `next
build` does not touch it (it is excluded in the root `tsconfig.json`).

It writes to the **`market_intel` schema** of the same Supabase Postgres the
website uses, and never touches the website's `public` tables. Sharing the
database is what will let the `/admin` dashboard read this data directly in
Milestone 5.

## Setup

```bash
cd market-intel
npm install
cp .env.example .env          # then fill in DATABASE_URL
npm run mi -- doctor          # validates config + database connection
npm run mi -- migrate         # creates the market_intel schema
npm run mi -- sources:sync    # pushes sources.yaml into the database
```

`DATABASE_URL` comes from Supabase → Project Settings → Database → Connection
string → URI. Any other Postgres works too.

## Daily use

```bash
npm run mi -- probe --source=yes_rentals --pickup=2027-02-10 --duration=5
                                         # one live search, printed, no database
npm run mi -- jobs:plan                  # show what a run would search, write nothing
npm run mi -- jobs:generate              # create a run and enqueue its jobs
npm run mi -- run --run=<run-id>         # work the queue
npm run mi -- status                     # queue state, source health, dataset size
npm run mi -- curve --pickup=2026-11-20  # the lead-time price curve
npm run mi -- unresolved                 # vehicles needing a mapping rule
```

`npm test` runs everything, including an end-to-end pipeline test against an
in-process Postgres (PGlite) — no database required.

## Configuration

Three files in `config/`, validated on load; a malformed file stops the process
rather than collecting garbage.

| file | holds |
| --- | --- |
| `sources.yaml` | one entry per competitor: name, type (`direct`/`ota`), base + search URL, enabled flag, collector id, per-market location codes, rate limits |
| `locations.yaml` | the markets. Christchurch Airport is live; Auckland, Queenstown and Wellington are staged and disabled |
| `collection.yaml` | the scenario grid (lead times, durations, pickup/return times), politeness defaults, runner limits |

Adding a market is an entry in `locations.yaml` plus a `locations:` block on
each source that serves it. Nothing else changes.

## Sources

| source | type | engine | markets | status |
| --- | --- | --- | --- | --- |
| `yes_rentals` | direct | RCM v3.2 | Christchurch Airport (id 7) | live |
| `mock_direct` / `mock_ota` | synthetic | - | CHC | always on, no network |

Yes Rentals runs on **Rental Car Manager**, the booking engine behind a large
part of NZ's independent fleet. The adapter is written against the engine, not
the company, so the next RCM competitor is a `sources.yaml` entry rather than
new code — their Auckland and Queenstown ids are already noted in the file.

It reads prices the way a visitor does: fill in the public search form, let
their server answer, then read `window.rcmAvailableCars`, the array the results
page renders itself from. RCM's own API is signed with the operator's
credentials, and we do not forge that signature.

The results page echoes back the location and dates it actually priced, and the
collector rejects the response if that echo does not match what was asked. A
silently mis-dated quote is worse than no quote.

## Target windows

The rolling grid only reaches 90 days out. When a specific season needs
tracking before it enters that window, name it in `collection.yaml`:

```yaml
target_windows:
  - code: feb_2027
    locations: [CHC_APT]
    pickup_from: "2027-02-01"
    pickup_to:   "2027-02-28"
    every_n_days: 3
    duration_days: [3, 5, 7]
```

Those dates are re-planned on every run, so each one accumulates observations
from however far out we start right up to the day itself — a complete booking
curve rather than only its last 90 days.

## The scenario grid

7 lead times (1, 3, 7, 14, 30, 60, 90 days) x 4 durations (1, 3, 5, 7 days)
= **28 searches per source per market per day**. Short lead times run first:
their prices move fastest and are the ones we least want to miss if a run is
cut short.

## Architecture

```
config/            sources.yaml, locations.yaml, collection.yaml
sql/               numbered, forward-only migrations
src/
  collectors/      one adapter per site, all implementing RentalPriceCollector
    mock/          synthetic market: the reference implementation
  normalizers/     raw listing -> normalized class, supplier, price, terms
  jobs/            planner (the grid), executor (one search), runner (the queue)
  database/        pg pool, migrations, repositories
  pricing/         Milestone 5 — empty on purpose
  config/          loading + validation
  utils/           logger, retry, rate limiter, artifacts, dates, text
```

Every source implements one interface:

```ts
interface RentalPriceCollector {
  search(query: SearchQuery): Promise<VehicleOffer[]>;
}
```

A collector reads a page and returns what it says. It does not decide what a
vehicle class is, what a supplier is called, or how a price should be stored —
that is the normalizer's job, and keeping the two apart is what lets us re-run
normalization over historical raw data when a rule turns out to be wrong.

### Queue

`collection_jobs` is the queue. Workers claim jobs with
`SELECT ... FOR UPDATE SKIP LOCKED`, so several workers (or machines) are safe
against one queue with no Redis or broker to run. A dead worker's job is
released after `job_lock_timeout_ms`.

Job generation is idempotent: the dedupe key is (plan date, source, market,
pickup, return), so re-running the planner on the same day inserts nothing,
while tomorrow's run legitimately re-observes the same pickup dates.

### Rate limiting

Per source, three independent limits: max concurrency, minimum delay between
searches (plus jitter), and a rolling hourly cap. Retries use exponential
backoff with full jitter. A source that fails
`disable_after_consecutive_failures` times in a row is auto-disabled and
flagged on the dashboard for a human — that circuit breaker protects them from
us as much as it protects our data quality.

These limits only ever slow us down. Nothing in this system solves CAPTCHAs,
touches a login, or works around anti-bot measures; a source whose terms forbid
automated access does not go in `sources.yaml`.

### Errors

Every failed attempt writes a `collection_errors` row with its stage
(`navigate` / `parse` / `timeout` / ...), the attempt number and — for browser
collectors — a screenshot and HTML snapshot under `artifacts/`, pruned by age.
A collector that fails to *parse* is the failure mode that matters most: it
means a competitor changed their page and our data is silently degrading.

## Vehicle normalization

Raw listings are mapped onto 11 classes: `ECONOMY`, `COMPACT`, `MIDSIZE`,
`FULLSIZE`, `COMPACT_SUV`, `MIDSIZE_SUV`, `LARGE_SUV`, `PREMIUM`, `EV`,
`VAN_8_SEAT`, `VAN_12_SEAT`.

The mapping is **data, not code** — 140+ seeded rules in
`vehicle_class_mapping`, matched deterministically in priority order:

1. hard signals that beat any name match (fuel = electric → `EV`, 11+ seats → `VAN_12_SEAT`)
2. specific models (`rav4` → `MIDSIZE_SUV`, `mg zs` → `COMPACT_SUV`)
3. the source's own class label (`Intermediate SUV` → `MIDSIZE_SUV`)
4. brand fallback (`bmw` → `PREMIUM`)
5. seat-count adjustment (a 7-seat Outlander is a `LARGE_SUV`, a 5-seat one is not)

No LLM runs in this path. Anything unmatched is recorded as **unresolved** and
listed by frequency for review — a wrong-but-confident class quietly corrupts
every median it touches, while an unresolved one is merely missing. Adding a
rule is one `insert`; `npm run mi -- unresolved` prints the statement.

## Supplier vs channel

For OTAs, `supplier` is the rental company and `channel` is the marketplace:

```
supplier = avis     channel = ExampleOTA    source_type = ota
supplier = avis     channel = Avis          source_type = direct
```

Supplier names are normalized (`Avis`, `AVIS Rent a Car`, `Avis Rental Cars NZ`
all collapse to `avis`), so the same company seen on three channels is three
quotes for one fleet, not three fleets. `v_supplier_daily` reports exactly that,
including the direct-vs-OTA price gap per supplier.

## Database

| table | purpose |
| --- | --- |
| `sources` | config mirror + runtime health (last success, failure streak, auto-disable) |
| `locations` | markets |
| `collection_runs` | one batch of jobs |
| `collection_jobs` | the queue |
| `market_price_observations` | **the dataset — append only** |
| `vehicle_classes` / `vehicle_class_mapping` | normalization reference + rules |
| `vehicle_class_unresolved` | manual review queue |
| `collection_errors` | every failed attempt, with debug artifacts |

Views: `v_source_health`, `v_market_daily`, `v_lead_time_curve`,
`v_supplier_daily`, `v_unresolved_vehicles`.

Every observation keeps both the parsed value and the raw string
(`total_price` = 449 alongside `total_price_raw` = `'NZ$449.00'`), plus the
whole extracted record in `raw`. A parsing rule we get wrong today can be
re-run over the raw values; a discarded string is gone forever.

## Admin dashboard

`/admin` -> **竞品价格监控**. Read-only: source health, the market snapshot by
vehicle class, the booking-curve chart, recent runs and errors. Collection is
never triggered from the website, so a bug in the UI cannot corrupt the dataset.

Supabase's PostgREST only serves schemas it has been told to expose, and
`market_intel` is deliberately not one of them. `sql/005_admin_views.sql`
publishes a handful of `public.mi_*` read-only views instead, granted to
`service_role` and revoked from `anon`/`authenticated`, so the dataset is
reachable from the admin API routes and from nowhere else. No Supabase
dashboard setting has to change.

Website files involved:

```
src/app/api/admin/market-intel/route.ts   read-only API, x-admin-token auth
src/components/admin/MarketIntel.tsx      the dashboard (inline SVG chart)
src/app/admin/page.tsx                    tab registration
```

## Milestones

- **1 — done.** Architecture, config system, schema, models, collector
  interface, mock collector, job generation, queue, rate limiting, retries,
  error capture, CLI, tests.
- **2 — done.** RCM collector, validated live against Yes Rentals at
  Christchurch Airport; captured responses kept as regression fixtures; target
  windows so February 2027 is tracked from 170+ days out.
- **3.** More collectors, expanded normalization rules, monitoring.
- **4.** Scheduled daily collection, historical analysis queries.
- **5 — dashboard done.** The `/admin` page is live; the pricing engine
  (`src/pricing/`) is still empty and waits on having several competitors.
