/** Collapse whitespace, trim, drop empty-ish values. */
export function clean(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalization key used by the vehicle mapper. Lowercase, strip accents and
 * punctuation, squash whitespace. 'CX-5' and 'cx 5' must land on the same key.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OR_SIMILAR = /\b(or|and)\s+similar(\s+(model|vehicle|car))?\b/i;

/** Split 'Toyota RAV4 or similar' into the model and the hedge text. */
export function splitOrSimilar(raw: string): { model: string; orSimilar?: string } {
  const match = OR_SIMILAR.exec(raw);
  if (!match) return { model: clean(raw) ?? raw };
  return {
    model: clean(raw.slice(0, match.index)) ?? raw,
    orSimilar: clean(match[0]),
  };
}

/**
 * Pull a number out of a displayed price. Handles 'NZ$1,234.50', '$89 /day',
 * '1 234,50' and returns undefined rather than guessing when it cannot tell.
 */
export function parseMoney(raw: string | null | undefined): number | undefined {
  const text = clean(raw);
  if (!text) return undefined;
  const stripped = text.replace(/[^\d.,]/g, '');
  if (!stripped) return undefined;

  let candidate = stripped;
  const lastComma = candidate.lastIndexOf(',');
  const lastDot = candidate.lastIndexOf('.');
  if (lastComma > lastDot) {
    // european style: 1.234,50
    candidate = candidate.replace(/\./g, '').replace(',', '.');
  } else {
    candidate = candidate.replace(/,/g, '');
  }

  const value = Number.parseFloat(candidate);
  return Number.isFinite(value) ? value : undefined;
}

/** 'NZ$', 'NZD 123' -> 'NZD'. Falls back to the caller's default. */
export function parseCurrency(raw: string | null | undefined, fallback: string): string {
  const text = clean(raw);
  if (!text) return fallback;
  const iso = /\b(NZD|AUD|USD|EUR|GBP|CNY|JPY|SGD)\b/i.exec(text);
  if (iso) return iso[1]!.toUpperCase();
  if (/NZ\$/i.test(text)) return 'NZD';
  if (/A\$/i.test(text)) return 'AUD';
  if (/US\$/i.test(text)) return 'USD';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  return fallback;
}

export function parseIntSafe(raw: string | number | null | undefined): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : undefined;
  const text = clean(raw ?? undefined);
  if (!text) return undefined;
  const match = /\d+/.exec(text.replace(/,/g, ''));
  if (!match) return undefined;
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) ? value : undefined;
}
