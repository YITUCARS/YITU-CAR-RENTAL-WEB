import { sleep } from './retry.js';

export interface RateLimitConfig {
  maxConcurrency: number;
  minDelayMs: number;
  jitterMs: number;
  maxRequestsPerHour: number;
}

/**
 * Per-source politeness gate. Three independent constraints:
 *   - at most N in flight at once
 *   - at least `minDelayMs` (+ jitter) between two starts
 *   - a rolling hourly cap
 *
 * This is deliberately conservative: it slows us down, it never speeds us up,
 * and it is not a mechanism for working around anyone's limits.
 */
export class RateLimiter {
  private inFlight = 0;
  private lastStart = 0;
  private readonly waiters: Array<() => void> = [];
  private readonly startTimes: number[] = [];

  constructor(
    readonly key: string,
    private readonly config: RateLimitConfig,
  ) {}

  async acquire(): Promise<() => void> {
    while (this.inFlight >= this.config.maxConcurrency) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.inFlight++;

    await this.waitForHourlyBudget();
    await this.waitForSpacing();

    const now = Date.now();
    this.lastStart = now;
    this.startTimes.push(now);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inFlight--;
      this.waiters.shift()?.();
    };
  }

  /** Wrap one unit of work. Always releases, even on throw. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async waitForSpacing(): Promise<void> {
    const jitter = Math.round(Math.random() * this.config.jitterMs);
    const target = this.lastStart + this.config.minDelayMs + jitter;
    const wait = target - Date.now();
    if (wait > 0) await sleep(wait);
  }

  private async waitForHourlyBudget(): Promise<void> {
    const hour = 60 * 60 * 1000;
    for (;;) {
      const cutoff = Date.now() - hour;
      while (this.startTimes.length > 0 && this.startTimes[0]! < cutoff) this.startTimes.shift();
      if (this.startTimes.length < this.config.maxRequestsPerHour) return;
      const oldest = this.startTimes[0]!;
      await sleep(Math.max(1000, oldest + hour - Date.now()));
    }
  }

  get stats(): { inFlight: number; lastHour: number } {
    return { inFlight: this.inFlight, lastHour: this.startTimes.length };
  }
}

/** One limiter per source code, shared by every worker in the process. */
export class RateLimiterRegistry {
  private readonly limiters = new Map<string, RateLimiter>();

  get(key: string, config: RateLimitConfig): RateLimiter {
    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new RateLimiter(key, config);
      this.limiters.set(key, limiter);
    }
    return limiter;
  }
}
