export type ErrorStage =
  | 'config'
  | 'navigate'
  | 'search'
  | 'parse'
  | 'normalize'
  | 'persist'
  | 'timeout'
  | 'rate_limit'
  | 'unknown';

export interface CollectionErrorInit {
  stage: ErrorStage;
  message: string;
  /** false stops the retry loop immediately (e.g. bad config, blocked by robots) */
  retryable?: boolean;
  cause?: unknown;
  url?: string;
  httpStatus?: number;
  context?: Record<string, unknown>;
}

/**
 * The error type every collector should throw. `stage` and `retryable` decide
 * how the runner reacts, and both land in market_intel.collection_errors.
 */
export class CollectionError extends Error {
  readonly stage: ErrorStage;
  readonly retryable: boolean;
  readonly url?: string;
  readonly httpStatus?: number;
  readonly context: Record<string, unknown>;

  constructor(init: CollectionErrorInit) {
    super(init.message, init.cause ? { cause: init.cause } : undefined);
    this.name = 'CollectionError';
    this.stage = init.stage;
    this.retryable = init.retryable ?? true;
    this.url = init.url;
    this.httpStatus = init.httpStatus;
    this.context = init.context ?? {};
  }
}

export function toCollectionError(err: unknown, fallbackStage: ErrorStage = 'unknown'): CollectionError {
  if (err instanceof CollectionError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new CollectionError({ stage: fallbackStage, message, cause: err });
}

export function errorTypeOf(err: unknown): string {
  if (err instanceof CollectionError) return `CollectionError:${err.stage}`;
  if (err instanceof Error) return err.name;
  return typeof err;
}
