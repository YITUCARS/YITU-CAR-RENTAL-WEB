import { createHash } from 'node:crypto';

export function sha1(...parts: Array<string | number | undefined | null>): string {
  const h = createHash('sha1');
  h.update(parts.map((p) => (p === undefined || p === null ? '' : String(p))).join('|'));
  return h.digest('hex');
}

/** Short, human-scannable digest for fingerprints and dedupe keys. */
export function shortHash(...parts: Array<string | number | undefined | null>): string {
  return sha1(...parts).slice(0, 16);
}
