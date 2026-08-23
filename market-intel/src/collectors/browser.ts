import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { CollectionError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';

/**
 * One browser per collector instance, one fresh context per search.
 *
 * A fresh context per search means no cookies or session state carry between
 * searches, so each quote is what an ordinary first-time visitor would see —
 * which is the number we actually want to record. It is also why nothing here
 * touches logins, stored credentials or bot-evasion settings: we want the
 * public price, not a privileged one.
 */
export class BrowserSession {
  private browser?: Browser;

  constructor(
    private readonly log: Logger,
    private readonly options: { timeoutMs: number; userAgent?: string } = { timeoutMs: 60_000 },
  ) {}

  async launch(): Promise<void> {
    if (this.browser) return;
    this.log.debug('launching chromium');
    this.browser = await chromium.launch({ headless: true });
  }

  async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    await this.launch();
    if (!this.browser) throw new CollectionError({ stage: 'navigate', message: 'browser failed to launch' });

    let context: BrowserContext | undefined;
    try {
      context = await this.browser.newContext({
        locale: 'en-NZ',
        timezoneId: 'Pacific/Auckland',
        viewport: { width: 1440, height: 900 },
        ...(this.options.userAgent ? { userAgent: this.options.userAgent } : {}),
      });
      context.setDefaultTimeout(this.options.timeoutMs);
      context.setDefaultNavigationTimeout(this.options.timeoutMs);

      // esbuild (via tsx) rewrites named function expressions with a `__name`
      // helper that exists in Node but not in the page, so anything we pass to
      // page.evaluate() would throw ReferenceError. Defining a no-op identity
      // first makes the same source work under tsx and under compiled output.
      await context.addInitScript(() => {
        const w = globalThis as unknown as { __name?: unknown };
        w.__name = w.__name ?? ((fn: unknown) => fn);
      });

      const page = await context.newPage();
      this.lastPage = page;
      return await fn(page);
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  /** Kept only so a failure can be photographed before the context closes. */
  private lastPage?: Page;

  async capture(): Promise<{ screenshot?: Buffer; html?: string }> {
    const page = this.lastPage;
    if (!page || page.isClosed()) return {};
    try {
      const [screenshot, html] = await Promise.all([
        page.screenshot({ fullPage: false }).catch(() => undefined),
        page.content().catch(() => undefined),
      ]);
      return { screenshot, html };
    } catch {
      return {};
    }
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
  }
}
