import { normalizeKey } from '../utils/text.js';

/**
 * Requirement: the same rental company seen through three different OTAs must
 * collapse to ONE supplier, or every downstream median is wrong. `channel`
 * keeps the distinction; `supplier` is the identity.
 */

const NOISE_WORDS = [
  'rent a car',
  'rent-a-car',
  'rentacar',
  'car rental',
  'car rentals',
  'rental cars',
  'car hire',
  'rentals',
  'rental',
  'group',
  'limited',
  'ltd',
  'nz',
  'new zealand',
  'aotearoa',
  'international',
];

/** Known aliases that survive the generic cleanup. Extend as sources are added. */
const ALIASES: Record<string, string> = {
  'avis budget': 'avis',
  'apex car rentals': 'apex',
  apex: 'apex',
  'go rentals': 'go',
  'jucy rentals': 'jucy',
  'omega rental cars': 'omega',
  'ezi car rental': 'ezi',
  'ace rental cars': 'ace',
  'snap rentals': 'snap',
  'bargain rental cars': 'bargain',
  'pegasus rental cars': 'pegasus',
  'lucky rentals': 'lucky',
  enterprise: 'enterprise',
  'enterprise rent a car': 'enterprise',
  'national car rental': 'national',
  'alamo rent a car': 'alamo',
  sixt: 'sixt',
  'sixt rent a car': 'sixt',
};

export function normalizeSupplier(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const key = normalizeKey(raw);
  if (!key) return undefined;

  const alias = ALIASES[key];
  if (alias) return alias;

  let cleaned = key;
  for (const noise of NOISE_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${noise.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'), ' ');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  const aliasAfterClean = ALIASES[cleaned];
  if (aliasAfterClean) return aliasAfterClean;

  return (cleaned || key).replace(/\s+/g, '_');
}
