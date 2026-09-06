import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Stops a retried request from creating a second real reservation.
 *
 * A booking POST that times out, a double-tapped button, or an agent that
 * retries by default all currently produce duplicate bookings at the supplier,
 * which then have to be cancelled by hand.
 *
 * Clients send no idempotency key today, so one is derived from the booking
 * itself: the same customer, car, dates and locations within a short window is
 * treated as the same booking rather than a second one. A client that does
 * send `Idempotency-Key` gets that honoured instead, which is what an API
 * consumer or an agent would expect.
 */
const WINDOW_MINUTES = 15

/** Fields that make two requests the same booking rather than two bookings. */
export function bookingFingerprint(body: any): string {
  const parts = [
    body?.pickupDate,
    body?.pickupTime,
    body?.dropoffDate,
    body?.dropoffTime,
    body?.pickupLocationId,
    body?.dropoffLocationId,
    body?.vehicleCategoryId,
    String(body?.email ?? '').trim().toLowerCase(),
    String(body?.lastName ?? '').trim().toLowerCase(),
  ].map((value) => String(value ?? ''))
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex')
}

export function idempotencyKeyFor(headerKey: string | null, body: any): string {
  const supplied = String(headerKey ?? '').trim()
  if (supplied) return `key:${supplied.slice(0, 200)}`
  return `fp:${bookingFingerprint(body)}`
}

export type ClaimResult =
  | { status: 'claimed' }
  | { status: 'duplicate'; reservationRef: string; reservationNo: string | null }
  | { status: 'in_flight' }
  | { status: 'unavailable' }

/**
 * Takes ownership of this booking attempt.
 *
 * 'duplicate' means an identical booking already succeeded and its reference
 * should be returned again. 'in_flight' means an identical request is still
 * running — the caller has almost certainly retried — and should be told to
 * wait rather than given a second reservation.
 *
 * Fails open. The table is created separately, and refusing every booking
 * until it exists would be far worse than the duplicate this prevents.
 */
export async function claimBooking(
  key: string,
  fingerprint: string,
): Promise<ClaimResult> {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('rental_booking_idempotency').insert({
      idempotency_key: key,
      fingerprint,
    })
    if (!error) return { status: 'claimed' }
    if ((error as any)?.code !== '23505') {
      console.warn('[booking idempotency] ledger unavailable:', error.message)
      return { status: 'unavailable' }
    }

    const { data, error: readError } = await supabase
      .from('rental_booking_idempotency')
      .select('reservation_ref,reservation_no,created_at')
      .eq('idempotency_key', key)
      .maybeSingle()
    if (readError || !data) return { status: 'unavailable' }

    const ageMs = Date.now() - new Date(data.created_at).getTime()
    if (ageMs > WINDOW_MINUTES * 60_000) {
      // Old enough to be a genuinely new booking of the same trip.
      await supabase
        .from('rental_booking_idempotency')
        .delete()
        .eq('idempotency_key', key)
      const retry = await supabase
        .from('rental_booking_idempotency')
        .insert({ idempotency_key: key, fingerprint })
      return retry.error ? { status: 'unavailable' } : { status: 'claimed' }
    }

    if (data.reservation_ref) {
      return {
        status: 'duplicate',
        reservationRef: String(data.reservation_ref),
        reservationNo: data.reservation_no ? String(data.reservation_no) : null,
      }
    }
    return { status: 'in_flight' }
  } catch (error) {
    console.warn(
      '[booking idempotency] ledger unavailable:',
      error instanceof Error ? error.message : error,
    )
    return { status: 'unavailable' }
  }
}

/** Records the reference so a later retry can be answered with it. */
export async function completeBooking(
  key: string,
  reservationRef: string,
  reservationNo: unknown,
) {
  try {
    await getSupabaseAdmin()
      .from('rental_booking_idempotency')
      .update({
        reservation_ref: reservationRef,
        reservation_no: reservationNo ? String(reservationNo) : null,
        completed_at: new Date().toISOString(),
      })
      .eq('idempotency_key', key)
  } catch (error) {
    console.warn(
      '[booking idempotency] could not record the reference:',
      error instanceof Error ? error.message : error,
    )
  }
}

/** Frees the key so a failed attempt can be retried. */
export async function releaseBooking(key: string) {
  try {
    await getSupabaseAdmin()
      .from('rental_booking_idempotency')
      .delete()
      .eq('idempotency_key', key)
  } catch (error) {
    console.warn(
      '[booking idempotency] could not release the key:',
      error instanceof Error ? error.message : error,
    )
  }
}
