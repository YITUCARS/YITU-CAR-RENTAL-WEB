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
  /**
   * Which way the amount was wrong, if it was.
   *
   * Only 'under' is worth blocking a payment over. Paying more than the
   * booking total costs the business nothing and happens legitimately when a
   * customer adds extras at checkout before the supplier's total catches up,
   * so an overpayment is recorded and let through.
   */
  verdict: 'under' | 'over' | null
  /** True when this payment should be refused outright. */
  shouldBlock: boolean
  submittedCents: number
  expectedCents: number | null
  reason?: string
}

function guardMode(): 'observe' | 'enforce' {
  return process.env.RENTAL_AMOUNT_GUARD === 'enforce' ? 'enforce' : 'observe'
}

/**
 * Reads a positive number off a record, or null.
 *
 * Amounts come back from the supplier as either numbers or numeric strings.
 */
function amountOf(record: unknown, field: string): number | null {
  if (!record || typeof record !== 'object') return null
  const raw = (record as Record<string, unknown>)[field]
  if (raw === null || raw === '' || typeof raw === 'object') return null
  const amount = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

/** The supplier returns each section as an array; the booking is the first entry. */
function section(info: unknown, key: string): unknown {
  if (!info || typeof info !== 'object') return null
  const value = (info as Record<string, unknown>)[key]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

/**
 * The booking total, in cents.
 *
 * Field names here are taken from a real bookinginfo response, not guessed:
 * the total lives at bookinginfo[0].totalcost. Cancelled bookings come back
 * with totalcost zeroed, so the rate plus its fees acts as a fallback for any
 * state where the supplier has not filled the total in.
 */
function readTotalCents(info: unknown): { cents: number; field: string } | null {
  const booking = section(info, 'bookinginfo')
  const totalCost = amountOf(booking, 'totalcost')
  if (totalCost !== null) {
    return { cents: Math.round(totalCost * 100), field: 'bookinginfo.totalcost' }
  }

  const subtotal = amountOf(section(info, 'rateinfo'), 'ratesubtotal')
  if (subtotal === null) return null

  const extras = (info as Record<string, unknown> | null)?.extrafees
  const fees = Array.isArray(extras)
    ? extras.reduce((sum: number, fee) => sum + (amountOf(fee, 'totalfeeamount') ?? 0), 0)
    : 0

  return {
    cents: Math.round((subtotal + fees) * 100),
    field: 'rateinfo.ratesubtotal+extrafees',
  }
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
      verdict: null,
      shouldBlock: false,
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
      verdict: null,
      shouldBlock: false,
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
      verdict: null,
      shouldBlock: false,
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

  const verdict: 'under' | 'over' | null = tooSmall
    ? 'under'
    : tooLarge
      ? 'over'
      : null
  const ok = verdict === null
  // Only an underpayment is refused. See AmountGuardResult.verdict.
  const shouldBlock = mode === 'enforce' && verdict === 'under'

  const detail = {
    mode,
    reservationRef,
    submittedCents,
    expectedCents: total.cents,
    matchedField: total.field,
  }
  if (verdict === null) {
    console.log('[rental amount guard] ok', detail)
  } else {
    console.warn('[rental amount guard]', {
      ...detail,
      verdict,
      action: shouldBlock ? 'rejected' : 'allowed through',
    })
  }

  return {
    mode,
    ok,
    verdict,
    shouldBlock,
    submittedCents,
    expectedCents: total.cents,
    reason:
      verdict === 'under'
        ? 'payment is far below the booking total'
        : verdict === 'over'
          ? 'payment exceeds the booking total'
          : undefined,
  }
}
