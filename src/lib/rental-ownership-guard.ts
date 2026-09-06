/**
 * Proof that the caller is the customer whose booking they are acting on.
 *
 * `/api/rcm/*` carries no authentication and cannot easily gain any: rentals
 * are booked as a guest, so there is no session to require. What a genuine
 * customer does have is the booking's own details — the surname or email the
 * booking was made under — which is exactly what the website's manage-booking
 * form already asks for.
 *
 * The supplier is no help here: it accepts and ignores `lastname`, returning
 * the same booking whatever surname is passed. So the comparison has to happen
 * on our side, against `customerinfo[0]`.
 *
 * Runs in observe mode by default. Enforcing immediately would break every
 * caller that sends no surname — currently the released app — so the intended
 * path is to watch real traffic first and turn RENTAL_OWNERSHIP_GUARD=enforce
 * on once the logs show legitimate callers pass.
 */
export type OwnershipVerdict = 'match' | 'mismatch' | 'unverified'

export type OwnershipResult = {
  mode: 'observe' | 'enforce'
  verdict: OwnershipVerdict
  /** True when the request should be refused outright. */
  shouldBlock: boolean
  matchedOn: 'lastname' | 'email' | null
}

function guardMode(): 'observe' | 'enforce' {
  return process.env.RENTAL_OWNERSHIP_GUARD === 'enforce' ? 'enforce' : 'observe'
}

function normalise(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function customerOf(info: unknown): Record<string, unknown> | null {
  if (!info || typeof info !== 'object') return null
  const value = (info as Record<string, unknown>).customerinfo
  const record = Array.isArray(value) ? value[0] : value
  return record && typeof record === 'object'
    ? (record as Record<string, unknown>)
    : null
}

/**
 * Compares what the caller claims against what the supplier holds.
 *
 * Takes an already-fetched bookinginfo response so the caller does not pay for
 * a second lookup — cancellation already reads the booking to find the amount
 * paid.
 */
export function evaluateOwnership(
  info: unknown,
  claimed: { lastName?: string; email?: string },
): OwnershipResult {
  const mode = guardMode()
  const lastName = normalise(claimed.lastName)
  const email = normalise(claimed.email)

  if (!lastName && !email) {
    return {
      mode,
      verdict: 'unverified',
      shouldBlock: mode === 'enforce',
      matchedOn: null,
    }
  }

  const customer = customerOf(info)
  if (!customer) {
    // Nothing to compare against; treat as unproven rather than as a match.
    return {
      mode,
      verdict: 'unverified',
      shouldBlock: mode === 'enforce',
      matchedOn: null,
    }
  }

  const actualLastName = normalise(customer.lastname)
  const actualEmail = normalise(customer.email)

  if (email && actualEmail && email === actualEmail) {
    return { mode, verdict: 'match', shouldBlock: false, matchedOn: 'email' }
  }
  if (lastName && actualLastName && lastName === actualLastName) {
    return { mode, verdict: 'match', shouldBlock: false, matchedOn: 'lastname' }
  }

  return {
    mode,
    verdict: 'mismatch',
    shouldBlock: mode === 'enforce',
    matchedOn: null,
  }
}

/** One log line per check, without writing the customer's details out. */
export function logOwnership(
  route: string,
  reservationRef: string,
  result: OwnershipResult,
  claimed: { lastName?: string; email?: string },
) {
  const detail = {
    mode: result.mode,
    reservationRef,
    verdict: result.verdict,
    matchedOn: result.matchedOn,
    suppliedLastName: Boolean(String(claimed.lastName ?? '').trim()),
    suppliedEmail: Boolean(String(claimed.email ?? '').trim()),
    action: result.shouldBlock ? 'rejected' : 'allowed through',
  }
  if (result.verdict === 'match') {
    console.log(`[${route}] ownership ok`, detail)
  } else {
    console.warn(`[${route}] ownership`, detail)
  }
}
