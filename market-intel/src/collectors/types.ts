import type { AppConfig, SourceConfig } from '../config/types.js';
import type { SearchQuery, VehicleOffer } from '../models/index.js';
import type { ArtifactStore } from '../utils/artifacts.js';
import type { Logger } from '../utils/logger.js';

/**
 * Everything a collector is allowed to depend on. Passing this in rather than
 * importing globals is what keeps adapters unit-testable and swappable.
 */
export interface CollectorContext {
  source: SourceConfig;
  config: AppConfig;
  log: Logger;
  artifacts: ArtifactStore;
  /** when true the collector must not touch the network */
  dryRun: boolean;
}

export interface CollectorCapabilities {
  /** can this adapter read one-way rentals? */
  oneWay: boolean;
  /** does the source expose per-supplier results (true for OTAs)? */
  multiSupplier: boolean;
  /** does it need a browser (affects concurrency budgeting)? */
  requiresBrowser: boolean;
}

/**
 * The one interface every data source implements.
 *
 * `search` must:
 *   - return every offer the page/endpoint showed, including sold-out ones it
 *     can see (mark them via `availability`), because an absent price and a
 *     sold-out price mean very different things in the dataset
 *   - return [] for "searched fine, nothing available"
 *   - throw a CollectionError for "could not search" — never return [] to hide
 *     a failure, or the dataset silently fills with false zeroes
 *   - never mutate the query
 */
export interface RentalPriceCollector {
  readonly id: string;
  /** bumped when extraction logic changes; stored on every observation */
  readonly version: string;
  readonly capabilities: CollectorCapabilities;

  /** optional one-time setup (launch browser, warm a token) */
  init?(): Promise<void>;
  search(query: SearchQuery): Promise<VehicleOffer[]>;
  /** always called, even after a failure */
  dispose?(): Promise<void>;
}

export type CollectorFactory = (ctx: CollectorContext) => RentalPriceCollector;

export const DEFAULT_CAPABILITIES: CollectorCapabilities = {
  oneWay: false,
  multiSupplier: false,
  requiresBrowser: true,
};
