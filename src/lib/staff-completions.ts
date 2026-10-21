import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { nzLocalToMs } from '@/lib/nz-time'
import { staffHasPermission, type StaffPayload } from '@/lib/staff-api'

// Shared record of pick-ups / drop-offs finished in YITU Lite (Supabase `staff_completions`).
// Rows double as a checklist: until an admin confirms, staff still have to set the booking to
// Hired / Returned in RCM by hand.

export type CompletionType = 'pickup' | 'dropoff'

/** Accounts granted this permission may tick off the RCM checklist. */
export function isStaffAdmin(payload: StaffPayload | null) {
  return staffHasPermission(payload, 'completions.confirm')
}

export function toCompletion(row: any) {
  return {
    bookingRef: row.booking_ref,
    reservationNo: row.reservation_no || '',
    type: row.type,
    customerName: row.customer_name || '',
    vehicle: row.vehicle || '',
    plate: row.plate || '',
    branch: row.branch || '',
    completedAt: row.completed_at,
    completedBy: row.completed_by || '',
    rcmUpdatedAt: row.rcm_updated_at,
    rcmUpdatedBy: row.rcm_updated_by,
  }
}

function nzTodayStartIso() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date())
  return new Date(nzLocalToMs(today, '00:00')).toISOString()
}

export async function listCompletions() {
  const supabase = getSupabaseAdmin()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [pending, today, done] = await Promise.all([
    supabase.from('staff_completions').select('*').is('rcm_updated_at', null).order('completed_at', { ascending: false }).limit(200),
    supabase.from('staff_completions').select('*').gte('completed_at', nzTodayStartIso()).order('completed_at', { ascending: false }),
    supabase.from('staff_completions').select('*').gte('rcm_updated_at', weekAgo).order('rcm_updated_at', { ascending: false }).limit(200),
  ])
  const error = pending.error || today.error || done.error
  if (error) throw error
  return {
    pending: (pending.data || []).map(toCompletion),
    today: (today.data || []).map(toCompletion),
    recentDone: (done.data || []).map(toCompletion),
  }
}

export async function recordCompletion(input: {
  bookingRef: string
  type: CompletionType
  reservationNo?: string
  customerName?: string
  vehicle?: string
  plate?: string
  branch?: string
  completedBy: string
}) {
  // Upsert leaves rcm_updated_* alone, so completing again keeps an earlier confirmation.
  const { data, error } = await getSupabaseAdmin().from('staff_completions').upsert({
    booking_ref: input.bookingRef,
    type: input.type,
    reservation_no: input.reservationNo || '',
    customer_name: input.customerName || '',
    vehicle: input.vehicle || '',
    plate: input.plate || '',
    branch: input.branch || '',
    completed_at: new Date().toISOString(),
    completed_by: input.completedBy,
  }, { onConflict: 'booking_ref,type' }).select('*').single()
  if (error) throw error
  return toCompletion(data)
}

export async function confirmRcmUpdated(bookingRef: string, type: CompletionType, confirmedBy: string) {
  const { data, error } = await getSupabaseAdmin().from('staff_completions')
    .update({ rcm_updated_at: new Date().toISOString(), rcm_updated_by: confirmedBy })
    .eq('booking_ref', bookingRef).eq('type', type)
    .select('*').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Completion not found.')
  return toCompletion(data)
}
