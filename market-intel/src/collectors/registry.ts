import type { CollectorContext, CollectorFactory, RentalPriceCollector } from './types.js';
import { createMockCollector } from './mock/mock-collector.js';
import { createRcmCollector } from './rcm/rcm-collector.js';
import { CollectionError } from '../utils/errors.js';

/**
 * collector id (as written in sources.yaml) -> factory.
 *
 * Adding a real source is: write the adapter, register it here, add the yaml
 * entry. Nothing else in the system needs to change.
 */
const registry = new Map<string, CollectorFactory>([
  ['mock', createMockCollector],
  // Rental Car Manager: powers many NZ independents, so one adapter covers
  // several competitors — each is just another sources.yaml entry
  ['rcm', createRcmCollector],
]);

export function registerCollector(id: string, factory: CollectorFactory): void {
  if (registry.has(id)) throw new Error(`Collector "${id}" is already registered`);
  registry.set(id, factory);
}

export function hasCollector(id: string): boolean {
  return registry.has(id);
}

export function listCollectors(): string[] {
  return [...registry.keys()].sort();
}

export function createCollector(ctx: CollectorContext): RentalPriceCollector {
  const factory = registry.get(ctx.source.collector);
  if (!factory) {
    throw new CollectionError({
      stage: 'config',
      retryable: false,
      message: `No collector registered for "${ctx.source.collector}" (source ${ctx.source.code}). Known: ${listCollectors().join(', ')}`,
    });
  }
  return factory(ctx);
}
