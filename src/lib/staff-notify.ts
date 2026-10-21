import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isApnsConfigured, isDeadToken, sendApns, type ApnsEnvironment } from '@/lib/apns'

// New-booking alerts for YITU Lite: recorded in `staff_notifications` (once per booking, also
// shown in the app's Notifications list) and pushed to the phones of staff who can see the
// booking's branch.

const BRANCH_ZH: Record<string, string> = { Christchurch: '基督城', Queenstown: '皇后镇', Auckland: '奥克兰' }

export type NewBookingRow = {
  reservation_ref: string
  reservation_no: string
  status: string
  pickup_date: string | null
  pickup_time: string
  pickup_branch: string
  vehicle: string
  customer_name: string
  details?: any
}

function displayNumber(row: NewBookingRow) {
  const unallocated = String(row.details?.unallocatedReservationNo || '')
  if (row.status.toLowerCase().startsWith('unallocated') && unallocated && unallocated !== '0') return unallocated
  return row.reservation_no && row.reservation_no !== '0' ? row.reservation_no : row.reservation_ref
}

function pickupLabel(row: NewBookingRow) {
  if (!row.pickup_date) return ''
  const [y, m, d] = row.pickup_date.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-NZ', { month: 'short', timeZone: 'UTC' })
  return `${d} ${month} ${row.pickup_time}`.trim()
}

/** Staff → branches they may see (empty = all), for active accounts. */
async function staffBranches() {
  const map = new Map<string, string[]>()
  const { data } = await getSupabaseAdmin().from('staff_accounts').select('username, branches, active')
  for (const account of data || []) if (account.active) map.set(account.username, account.branches || [])
  return map
}

export async function notifyNewBookings(rows: NewBookingRow[]) {
  if (rows.length === 0) return { notified: 0, pushed: 0 }
  const supabase = getSupabaseAdmin()

  // Insert-or-skip: only rows actually inserted come back, so each booking notifies once.
  const candidates = rows.map(row => {
    const number = displayNumber(row)
    const branch = row.pickup_branch || ''
    return {
      kind: 'new_booking',
      booking_ref: row.reservation_ref,
      reservation_no: number,
      branch,
      title: `新订单 New booking #${number}`,
      body: [
        branch ? `${BRANCH_ZH[branch] || branch} ${branch}` : '',
        pickupLabel(row) ? `Pick up ${pickupLabel(row)}` : '',
        row.vehicle,
        row.customer_name,
      ].filter(Boolean).join(' · '),
      pickup_date: row.pickup_date,
    }
  })
  const { data: inserted, error } = await supabase
    .from('staff_notifications')
    .upsert(candidates, { onConflict: 'kind,booking_ref', ignoreDuplicates: true })
    .select('*')
  if (error) throw error
  if (!inserted?.length || !isApnsConfigured()) return { notified: inserted?.length || 0, pushed: 0 }

  const [{ data: devices }, branches] = await Promise.all([
    supabase.from('staff_devices').select('device_token, staff_id, environment'),
    staffBranches(),
  ])

  let pushed = 0
  const dead: string[] = []
  for (const note of inserted) {
    const recipients = (devices || []).filter(device => {
      const allowed = branches.get(device.staff_id)
      if (!allowed) return false // unknown or disabled account
      return allowed.length === 0 || !note.branch || allowed.includes(note.branch)
    })
    for (const environment of ['production', 'sandbox'] as ApnsEnvironment[]) {
      const tokens = recipients.filter(device => device.environment === environment).map(device => device.device_token)
      const results = await sendApns(environment, tokens, {
        title: note.title,
        body: note.body,
        threadId: 'new-bookings',
        data: { bookingRef: note.booking_ref, pickupDate: note.pickup_date || '', type: 'pickup' },
      })
      for (const result of results) {
        if (result.ok) pushed++
        else if (isDeadToken(result)) dead.push(result.token)
        else console.warn('[staff-notify] APNs failed:', result.status, result.reason)
      }
    }
  }
  if (dead.length) await supabase.from('staff_devices').delete().in('device_token', dead)
  return { notified: inserted.length, pushed }
}
