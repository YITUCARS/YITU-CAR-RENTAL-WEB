import crypto from 'crypto'

/**
 * Verification of Stripe's `Stripe-Signature` header.
 *
 * Written by hand rather than with the Stripe SDK because this codebase talks
 * to Stripe over plain fetch and carries no server-side SDK. The scheme is
 * Stripe's documented one: HMAC-SHA256 over `${timestamp}.${rawBody}`, keyed
 * on the endpoint's signing secret, compared against the `v1` entries.
 *
 * The raw request body must be passed exactly as received — parsing and
 * re-serialising it changes the bytes and invalidates the signature.
 */
export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: string }

/** How far a webhook's timestamp may drift before it is treated as a replay. */
export const SIGNATURE_TOLERANCE_SECONDS = 300

function parseHeader(header: string) {
  let timestamp = ''
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2)
    if (key?.trim() === 't') timestamp = (value ?? '').trim()
    if (key?.trim() === 'v1') signatures.push((value ?? '').trim())
  }
  return { timestamp, signatures }
}

function timingSafeEqualHex(a: string, b: string) {
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

export function verifyStripeSignature(params: {
  rawBody: string
  header: string | null
  secret: string
  nowSeconds?: number
}): SignatureCheck {
  const { rawBody, header, secret } = params
  if (!secret) return { ok: false, reason: 'signing secret is not configured' }
  if (!header) return { ok: false, reason: 'missing Stripe-Signature header' }

  const { timestamp, signatures } = parseHeader(header)
  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: 'malformed Stripe-Signature header' }
  }

  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: 'malformed timestamp' }
  }

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - sentAt) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside the tolerance window' }
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex')

  const matched = signatures.some((signature) =>
    timingSafeEqualHex(signature, expected),
  )
  return matched ? { ok: true } : { ok: false, reason: 'signature mismatch' }
}
