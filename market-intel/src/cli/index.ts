#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from '../config/load.js';
import type { AppConfig } from '../config/types.js';
import { enabledLocations, enabledSources } from '../config/types.js';
import { closeDb, getDb, type Db } from '../database/client.js';
import { migrate } from '../database/migrate.js';
import { errorsRepo, jobsRepo, observationsRepo, sourcesRepo } from '../database/repositories/index.js';
import { listCollectors, hasCollector } from '../collectors/registry.js';
import { describePlan, planJobs } from '../jobs/generate.js';
import { createCollector } from '../collectors/registry.js';
import { resolveQueryLocation } from '../models/search-query.js';
import { normalizeOffer } from '../normalizers/offer.js';
import { VehicleClassifier, FALLBACK_RULES, toMappingRule } from '../normalizers/vehicle-class.js';
import { ArtifactStore } from '../utils/artifacts.js';
import { atLocalTime, formatLocal, leadTimeDays } from '../utils/dates.js';
import { parse as parseDate } from 'date-fns';
import { CollectionRunner } from '../jobs/runner.js';
import { logger } from '../utils/logger.js';

type Command = (args: Args, config: AppConfig) => Promise<void>;

interface Args {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { _: [], flags: {} };
  for (const token of argv) {
    if (token.startsWith('--')) {
      const [key, value] = token.slice(2).split('=');
      args.flags[key!] = value ?? true;
    } else {
      args._.push(token);
    }
  }
  return args;
}

const flagList = (args: Args, name: string): string[] | undefined => {
  const value = args.flags[name];
  return typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
};

// ---------------------------------------------------------------------------

const doctor: Command = async (_args, config) => {
  console.log('config files');
  for (const [name, file] of Object.entries(config.files)) console.log(`  ${name.padEnd(11)} ${file}`);

  console.log('\nlocations');
  for (const l of config.locations) {
    console.log(`  ${l.enabled ? '[on ]' : '[off]'} ${l.code.padEnd(10)} ${l.name} (${l.timezone}, ${l.currency})`);
  }

  console.log('\nsources');
  for (const s of config.sources) {
    const known = hasCollector(s.collector) ? '' : '  <-- NO COLLECTOR REGISTERED';
    const markets = Object.keys(s.locations).join(',') || '(none)';
    console.log(
      `  ${s.enabled ? '[on ]' : '[off]'} ${s.code.padEnd(16)} ${s.type.padEnd(6)} collector=${s.collector.padEnd(10)} markets=${markets}${known}`,
    );
    console.log(
      `        rate: ${s.rateLimit.maxConcurrency} concurrent, ${s.rateLimit.minDelayMs}ms gap, ${s.rateLimit.maxRequestsPerHour}/h; ` +
        `retry: ${s.retry.maxAttempts}x; timeout ${s.timeoutMs}ms`,
    );
  }

  console.log(`\nregistered collectors: ${listCollectors().join(', ')}`);

  const { scenarios } = config;
  const perSourceLocation = scenarios.leadTimeDays.length * scenarios.durationDays.length;
  const pairs = enabledSources(config).reduce(
    (acc, s) => acc + enabledLocations(config).filter((l) => s.locations[l.code]).length,
    0,
  );
  console.log(
    `\nscenario grid: ${scenarios.leadTimeDays.length} lead times x ${scenarios.durationDays.length} durations ` +
      `= ${perSourceLocation} searches per source/market`,
  );
  console.log(`enabled source-market pairs: ${pairs} -> ${pairs * perSourceLocation} jobs per run`);

  console.log('\ndatabase');
  const db = getDb(config.env.databaseUrl);
  try {
    const { rows } = await db.query<{ now: Date; version: string }>('select now() as now, version() as version');
    console.log(`  connected: ${rows[0]?.version.split(',')[0]}`);
    const { rows: applied } = await db
      .query<{ filename: string }>('select filename from market_intel._migrations order by filename')
      .catch(() => ({ rows: [] as { filename: string }[] }));
    console.log(`  migrations applied: ${applied.length === 0 ? '(none - run migrate)' : applied.map((r) => r.filename).join(', ')}`);
  } catch (err) {
    console.log(`  NOT CONNECTED: ${(err as Error).message}`);
  }
};

const migrateCmd: Command = async (_args, config) => {
  const db = getDb(config.env.databaseUrl);
  const result = await migrate(db);
  console.log(`applied: ${result.applied.join(', ') || '(none)'}`);
  console.log(`already applied: ${result.skipped.length}`);
  if (result.changed.length > 0) {
    console.log(`WARNING: these files changed after being applied: ${result.changed.join(', ')}`);
    console.log('Add a new numbered file instead of editing an applied one.');
  }
};

const syncSources: Command = async (_args, config) => {
  const db = getDb(config.env.databaseUrl);
  await sourcesRepo.syncLocations(db, config.locations);
  const rows = await sourcesRepo.syncSources(db, config.sources);
  console.log(`synced ${config.locations.length} locations, ${rows.length} sources`);
  for (const row of rows) {
    console.log(`  ${row.enabled ? '[on ]' : '[off]'} ${row.code.padEnd(16)} ${row.source_type}`);
  }
};

const planCmd: Command = async (args, config) => {
  const plan = planJobs(config, {
    sourceCodes: flagList(args, 'source'),
    locationCodes: flagList(args, 'location'),
  });
  console.log(describePlan(plan));
  for (const skip of plan.skipped) {
    console.log(`  skipped ${skip.sourceCode} / ${skip.locationCode}: ${skip.reason}`);
  }
  const sample = plan.jobs.slice(0, 8);
  if (sample.length > 0) {
    console.log('\nfirst jobs:');
    for (const job of sample) {
      console.log(
        `  ${job.sourceCode.padEnd(14)} ${job.pickupLocationCode} ` +
          `pickup ${job.pickupLocal} return ${job.returnLocal} lead=${job.leadTimeDays}d duration=${job.durationDays}d`,
      );
    }
  }
  console.log('\n(dry run - nothing written. use jobs:generate to enqueue)');
};

const generateCmd: Command = async (args, config) => {
  const db = getDb(config.env.databaseUrl);
  const runId = randomUUID();
  const plan = planJobs(config, {
    runId,
    sourceCodes: flagList(args, 'source'),
    locationCodes: flagList(args, 'location'),
  });

  if (plan.jobs.length === 0) {
    console.log('nothing to enqueue (no enabled source/market pairs)');
    return;
  }

  await jobsRepo.createRun(db, {
    id: runId,
    label: typeof args.flags.label === 'string' ? args.flags.label : undefined,
    trigger: typeof args.flags.trigger === 'string' ? args.flags.trigger : 'manual',
    configSnapshot: { scenarios: config.scenarios },
  });
  const inserted = await jobsRepo.insertJobs(db, plan.jobs);

  console.log(`run ${runId}`);
  console.log(`planned ${plan.jobs.length} jobs, inserted ${inserted}`);
  if (inserted < plan.jobs.length) {
    console.log(`${plan.jobs.length - inserted} were already queued today (dedupe_key match)`);
  }
  console.log(`\nnext: npm run mi -- run --run=${runId}`);
};

const runCmd: Command = async (args, config) => {
  const db = getDb(config.env.databaseUrl);
  const runner = new CollectionRunner(db, config);

  const shutdown = () => {
    logger.warn('shutdown requested, finishing in-flight jobs');
    runner.stop();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const summary = await runner.run({
    maxJobs: typeof args.flags.limit === 'string' ? Number(args.flags.limit) : undefined,
    sourceCode: typeof args.flags.source === 'string' ? args.flags.source : undefined,
    runId: typeof args.flags.run === 'string' ? args.flags.run : undefined,
    daemon: args.flags.daemon === true,
  });

  console.log(
    `processed ${summary.processed} jobs: ${summary.succeeded} ok, ${summary.failed} failed, ` +
      `${summary.offersStored} offers stored`,
  );

  if (typeof args.flags.run === 'string') {
    const rows = await observationsRepo.summariseRun(db, args.flags.run);
    if (rows.length > 0) {
      console.log('\nper source (available offers only):');
      for (const r of rows) {
        console.log(
          `  ${r.source_code.padEnd(14)} ${String(r.offers).padStart(5)} offers  ` +
            `${r.unclassified} unclassified  median NZ$${r.median_daily?.toFixed(2) ?? '-'}/day ` +
            `(min ${r.min_daily?.toFixed(2) ?? '-'} / max ${r.max_daily?.toFixed(2) ?? '-'})`,
        );
      }
    }
  }
};

const statusCmd: Command = async (_args, config) => {
  const db = getDb(config.env.databaseUrl);

  const stats = await jobsRepo.jobStats(db);
  console.log('jobs');
  if (stats.length === 0) console.log('  (queue empty)');
  for (const s of stats) console.log(`  ${s.status.padEnd(10)} ${s.count}`);

  const { rows: health } = await db.query<Record<string, unknown>>(
    'select * from market_intel.v_source_health order by source_code',
  );
  console.log('\nsource health');
  for (const h of health) {
    const state = h.auto_disabled ? 'DISABLED' : h.enabled ? 'on' : 'off';
    console.log(
      `  ${String(h.source_code).padEnd(16)} ${state.padEnd(9)} ` +
        `offers24h=${h.offers_24h} errors24h=${h.errors_24h} fails=${h.consecutive_failures} ` +
        `last_ok=${h.last_success_at ? new Date(h.last_success_at as string).toISOString().slice(0, 16) : 'never'}`,
    );
    if (h.auto_disabled) console.log(`      reason: ${h.auto_disabled_reason}`);
  }

  const { rows: totals } = await db.query<{ observations: number; first: Date | null; last: Date | null }>(
    `select count(*)::int as observations, min(observed_at) as first, max(observed_at) as last
       from market_intel.market_price_observations`,
  );
  const t = totals[0];
  console.log(
    `\nobservations: ${t?.observations ?? 0}` +
      (t?.first ? ` (${t.first.toISOString().slice(0, 10)} -> ${t.last?.toISOString().slice(0, 10)})` : ''),
  );

  const errors = await errorsRepo.recentErrors(db, 5);
  if (errors.length > 0) {
    console.log('\nrecent errors');
    for (const e of errors) {
      console.log(`  ${String(e.occurred_at).slice(0, 19)} ${String(e.source_code).padEnd(14)} ${e.stage}: ${e.message}`);
    }
  }
};

const curveCmd: Command = async (args, config) => {
  const db = getDb(config.env.databaseUrl);
  const location = (args.flags.location as string) ?? 'CHC_APT';
  const pickupDate = args.flags.pickup as string;
  const vehicleClass = (args.flags.class as string) ?? 'MIDSIZE_SUV';
  const duration = Number(args.flags.duration ?? 5);

  if (!pickupDate) {
    console.log('usage: npm run mi -- curve --pickup=2026-11-20 [--class=MIDSIZE_SUV] [--duration=5] [--location=CHC_APT]');
    return;
  }

  const rows = await observationsRepo.leadTimeCurve(db, {
    locationCode: location,
    pickupDate,
    vehicleClass,
    durationDays: duration,
  });

  console.log(`booking curve  ${location}  pickup ${pickupDate}  ${vehicleClass}  ${duration} days\n`);
  if (rows.length === 0) {
    console.log('no observations yet for that combination');
    return;
  }
  console.log('  observed     days out   offers   min      median    max');
  for (const r of rows) {
    console.log(
      `  ${String(r.observed_date).slice(0, 10)}   ${String(r.days_before_pickup).padStart(6)}   ` +
        `${String(r.offer_count).padStart(6)}   ${fmt(r.min_daily_price)}  ${fmt(r.median_daily_price)}  ${fmt(r.max_daily_price)}`,
    );
  }
};

const unresolvedCmd: Command = async (_args, config) => {
  const db = getDb(config.env.databaseUrl);
  const { rows } = await db.query<Record<string, unknown>>(
    'select * from market_intel.v_unresolved_vehicles limit 50',
  );
  if (rows.length === 0) {
    console.log('nothing unresolved - every vehicle seen so far mapped to a class');
    return;
  }
  console.log('vehicles needing a mapping rule (most frequent first)\n');
  for (const r of rows) {
    console.log(
      `  ${String(r.occurrences).padStart(5)}x  ${String(r.source_code).padEnd(14)} ` +
        `"${r.vehicle_name_raw}"  class_raw="${r.vehicle_class_raw ?? ''}" seats=${r.sample_seats ?? '?'}`,
    );
  }
  console.log(
    '\nadd a rule:\n' +
      "  insert into market_intel.vehicle_class_mapping (match_type, pattern, vehicle_class, priority, created_by)\n" +
      "  values ('contains', 'foton view', 'MIDSIZE', 40, 'manual');",
  );
};


/**
 * One live search against one source, printed as normalized rows. No database
 * and no queue involved - this is the loop you develop a new collector in, and
 * the fastest way to see whether a site changed under us.
 */
const probeCmd: Command = async (args, config) => {
  const sourceCode = args.flags.source as string;
  const pickupDate = args.flags.pickup as string;
  const duration = Number(args.flags.duration ?? 5);
  const locationCode = (args.flags.location as string) ?? 'CHC_APT';

  if (!sourceCode || !pickupDate) {
    console.log('usage: npm run mi -- probe --source=yes_rentals --pickup=2027-02-10 [--duration=5] [--location=CHC_APT]');
    return;
  }

  const source = config.sources.find((s) => s.code === sourceCode);
  const location = config.locations.find((l) => l.code === locationCode);
  if (!source) throw new Error(`no source "${sourceCode}" in sources.yaml`);
  if (!location) throw new Error(`no location "${locationCode}" in locations.yaml`);

  const queryLocation = resolveQueryLocation(source, location);
  if (!queryLocation) throw new Error(`source "${sourceCode}" has no mapping for "${locationCode}"`);

  const pickupLocalDate = parseDate(pickupDate, 'yyyy-MM-dd', new Date());
  const pickup = atLocalTime(pickupLocalDate, config.scenarios.pickupTime, location.timezone);
  const dropoff = atLocalTime(
    new Date(pickupLocalDate.getTime() + duration * 86_400_000),
    config.scenarios.returnTime,
    location.timezone,
  );
  const observedAt = new Date();

  // use the database rules when we can reach it, built-ins otherwise
  let classifier = new VehicleClassifier(FALLBACK_RULES);
  let ruleCount = FALLBACK_RULES.length;
  if (config.env.databaseUrl) {
    try {
      const rows = await observationsRepo.loadMappingRules(getDb(config.env.databaseUrl));
      if (rows.length > 0) {
        classifier = new VehicleClassifier(rows.map(toMappingRule));
        ruleCount = rows.length;
      }
    } catch {
      /* fall through to the warning below */
    }
  }
  if (ruleCount === FALLBACK_RULES.length) {
    console.log(
      `(no database reachable: classifying with ${ruleCount} built-in fallback rules, not the full\n` +
        ` mapping table. Expect UNRESOLVED rows here that would classify fine in a real collection.)\n`,
    );
  }

  const collector = createCollector({
    source,
    config,
    log: logger,
    artifacts: new ArtifactStore(config.env.artifactsDir),
    dryRun: false,
  });

  const query = {
    runId: randomUUID(),
    source,
    pickup: queryLocation,
    dropoff: queryLocation,
    pickupAt: pickup.utc,
    returnAt: dropoff.utc,
    pickupLocal: pickup.local,
    returnLocal: dropoff.local,
    leadTimeDays: leadTimeDays(observedAt, pickup.utc, location.timezone),
    durationDays: duration,
    driverAge: config.scenarios.driverAge,
    currency: location.currency,
    observedAt,
  };

  console.log(
    `${source.name}  ${location.name}  ${query.pickupLocal} -> ${query.returnLocal}  ` +
      `(${duration} days, ${query.leadTimeDays} days out)\n`,
  );

  const startedAt = Date.now();
  await collector.init?.();
  try {
    const offers = await collector.search(query);
    const elapsed = Date.now() - startedAt;

    console.log(`${offers.length} offers in ${(elapsed / 1000).toFixed(1)}s\n`);
    console.log('  daily    total   class          seats  avail  vehicle');
    console.log('  ' + '-'.repeat(88));

    let unresolvedCount = 0;
    for (const offer of offers) {
      const { observation, unresolved } = normalizeOffer(query, offer, classifier, collector.version);
      if (unresolved) unresolvedCount++;
      console.log(
        '  ' +
          fmt(observation.dailyPrice) + '  ' +
          fmt(observation.totalPrice) + '  ' +
          (observation.vehicleClass ?? 'UNRESOLVED').padEnd(13) + '  ' +
          String(observation.seats ?? '?').padStart(4) + '   ' +
          observation.availability.padEnd(9) +
          observation.vehicleNameRaw.slice(0, 40) +
          (observation.acrissCode ? `  [${observation.acrissCode}]` : ''),
      );
    }

    if (unresolvedCount > 0) {
      console.log(`\n${unresolvedCount} offer(s) could not be classified - run "unresolved" after a real collection`);
    }
    if (args.flags.json) {
      console.log('\nfirst normalized row:\n' + JSON.stringify(normalizeOffer(query, offers[0]!, classifier, collector.version).observation, null, 2));
    }
    if (typeof args.flags.out === 'string') {
      // captured live responses make the best regression fixtures: when a site
      // changes, the test tells us what it used to return
      await writeFile(args.flags.out, JSON.stringify({ source: source.code, capturedAt: observedAt.toISOString(), query: { pickupLocal: query.pickupLocal, returnLocal: query.returnLocal, durationDays: duration }, offers }, null, 2));
      console.log(`\nwrote ${offers.length} raw offers to ${args.flags.out}`);
    }
  } finally {
    await collector.dispose?.();
  }
};

function fmt(value: unknown): string {
  return value === null || value === undefined ? '     -' : Number(value).toFixed(2).padStart(6);
}

// ---------------------------------------------------------------------------

const COMMANDS: Record<string, { run: Command; help: string }> = {
  doctor: { run: doctor, help: 'validate config, list sources, test the database connection' },
  migrate: { run: migrateCmd, help: 'apply sql/*.sql migrations' },
  'sources:sync': { run: syncSources, help: 'push sources.yaml + locations.yaml into the database' },
  'jobs:plan': { run: planCmd, help: 'show the jobs a run would create (writes nothing)' },
  'jobs:generate': { run: generateCmd, help: 'create a run and enqueue its jobs' },
  run: { run: runCmd, help: 'work the queue [--run=ID --source=CODE --limit=N --daemon]' },
  status: { run: statusCmd, help: 'queue state, source health, dataset size, recent errors' },
  curve: { run: curveCmd, help: 'print the lead-time price curve for one pickup date' },
  unresolved: { run: unresolvedCmd, help: 'vehicles the classifier could not map' },
  probe: { run: probeCmd, help: 'one live search against one source, printed - no database needed' },
};

function usage(): void {
  console.log('market-intel\n\nusage: npm run mi -- <command> [flags]\n');
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(16)} ${cmd.help}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const name = args._[0];

  if (!name || name === 'help' || args.flags.help) {
    usage();
    return;
  }

  const command = COMMANDS[name];
  if (!command) {
    console.error(`unknown command "${name}"\n`);
    usage();
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  try {
    await command.run(args, config);
  } finally {
    await closeDb();
  }
}

main().catch((err: Error) => {
  logger.error({ err: err.message }, 'command failed');
  if (process.env.LOG_LEVEL === 'debug') console.error(err);
  process.exitCode = 1;
  void closeDb();
});

export type { Db };
