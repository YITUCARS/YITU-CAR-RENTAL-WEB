import { rcmCall } from '@/lib/rcm'

/**
 * Guards against a client choosing its own payment amount.
 *
 * The booking total is looked up from the supplier, which is the only
 * authoritative source we have until Kivio stores its own booking records.
 *
 * Runs in observe mode by default: a mismatch is logged but the payment still
 * proceeds. Set RENTAL_AMOUNT_GUARD=enforce to reject instead. Observe mode
 * exists because the supplier's total field name is not yet confirmed against
 * live data, and a wrong guess here would block every legitimate payment.
 */
export type AmountGuardResult = {
  mode: 'observe' | 'enforce' | 'skipped'
  ok: boolean
  submittedCents: number
  expectedCents: number | null
  reason?: string
}

function guardMode(): 'observe' | 'enforce' {
  return process.env.RENTAL_AMOUNT_GUARD === 'enforce' ? 'enforce' : 'observe'
}

/** Fields the supplier might carry the booking total in, most specific first. */
const TOTAL_FIELDS = [
  'totalcharge',
  'totalamount',
  'grandtotal',
  'totalrateafterdiscount',
  'total',
  'amountdue',
  'balance',
]

function readTotalCents(info: unknown): { cents: number; field: string } | null {
  if (!info || typeof info !== 'object') return null
  const record = info as Record<string, unknown>
  // Some responses nest the booking under a wrapper key.
  const candidates: Record<string, unknown>[] = [record]
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      candidates.push(value as Record<string, unknown>)
    }
  }

  for (const candidate of candidates) {
    for (const field of TOTAL_FIELDS) {
      const raw = candidate[field]
      const amount = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(amount) && amount > 0) {
        return { cents: Math.round(amount * 100), field }
      }
    }
  }
  return null
}

export async function checkRentalPaymentAmount(input: {
  reservationRef: string
  lastName: string
  submittedCents: number
}): Promise<AmountGuardResult> {
  const mode = guardMode()
  const { reservationRef, lastName, submittedCents } = input

  if (!reservationRef || !lastName) {
    return {
      mode: 'skipped',
      ok: true,
      submittedCents,
      expectedCents: null,
      reason: 'no reference or surname to look the booking up with',
    }
  }

  let info: unknown = null
  try {
    info = await rcmCall('bookinginfo', {
      reservationref: reservationRef,
      lastname: lastName,
    })
  } catch (error) {
    // A supplier outage must not stop a customer paying.
    return {
      mode: 'skipped',
      ok: true,
      submittedCents,
      expectedCents: null,
      reason: `supplier lookup failed: ${
        error instanceof Error ? error.message : 'unknown'
      }`,
    }
  }

  const total = readTotalCents(info)
  if (!total) {
    return {
      mode: 'skipped',
      ok: true,
      submittedCents,
      expectedCents: null,
      reason: 'no recognisable total on the supplier booking',
    }
  }

  // Deposits and part-payments are legitimate, so only an overpayment or a
  // suspiciously small payment is treated as wrong. The floor is what stops
  // "pay $1 for a $1000 rental".
  const MIN_SHARE = 0.05
  const tooSmall = submittedCents < Math.round(total.cents * MIN_SHARE)
  const tooLarge = submittedCents > total.cents + 100

  const ok = !tooSmall && !tooLarge
  if (!ok) {
    console.warn('[rental amount guard]', {
      mode,
      reservationRef,
      submittedCents,
      expectedCents: total.cents,
      matchedField: total.field,
      verdict: tooSmall ? 'below minimum share' : 'exceeds booking total',
    })
  } else {
    console.log('[rental amount guard] ok', {
      mode,
      reservationRef,
      submittedCents,
      expectedCents: total.cents,
      matchedField: total.field,
    })
  }

  return {
    mode,
    ok,
    submittedCents,
    expectedCents: total.cents,
    reason: ok
      ? undefined
      : tooSmall
        ? 'payment is far below the booking total'
        : 'payment exceeds the booking total',
  }
}
