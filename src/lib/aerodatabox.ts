// Live flight status from AeroDataBox (RapidAPI), for YITU Lite's pick-up cards.
// Env: AERODATABOX_API_KEY (RapidAPI key).
//
// The plan's quota is small (Basic: 400 units/month, 2 units per lookup), so each flight is
// looked up only a few times: once when first shown, again about an hour before landing, then
// every 45 minutes until it lands; landed / cancelled flights aren't re-checked. On top of that
// the calls per day are budgeted from RapidAPI's remaining-units header, spread evenly over the
// days until the quota resets, so the month never runs dry.

const HOST = 'aerodatabox.p.rapidapi.com'
const UNITS_PER_CALL = 2
/** Units kept back so the quota is never fully used. */
const RESERVE_UNITS = 10

export type FlightStatus = {
  number: string
  date: string
  found: boolean
  /** AeroDataBox status, e.g. Expected, EnRoute, Delayed, Landed, Arrived, Canceled, Diverted. */
  status: string
  airline: string
  fromIata: string
  fromCity: string
  toIata: string
  /** Local times at the arrival airport, "HH:mm". */
  scheduledArrival: string
  expectedArrival: string
  actualArrival: string
  /** Positive = late. */
  delayMinutes: number
  terminal: string
  gate: string
  checkedAt: string
}

const cache = new Map<string, { until: number; value: FlightStatus }>()
const inflight = new Map<string, Promise<FlightStatus>>()
/** Lookups made today (NZ date) and how many today's budget allows. */
let usage = { day: '', calls: 0, budget: 0, fromQuota: false }
/** From the last response: units left this period and when the period resets. */
let quota: { remaining: number; resetAt: number } | null = null

export function isAeroDataBoxConfigured() {
  return Boolean(process.env.AERODATABOX_API_KEY)
}

/** "nz 677" → "NZ677". */
export function normalizeFlightNumber(value: string) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** "2026-10-23 14:20+13:00" → { hhmm: "14:20", ms } */
function parseLocal(value?: string) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(.*)$/)
  if (!match) return null
  const iso = `${match[1]}T${match[2]}:${match[3]}:00${match[4] || 'Z'}`
  return { hhmm: `${match[2]}:${match[3]}`, ms: Date.parse(iso) }
}

/** [value] ("2026-10-23 14:20+13:00") moved later by [ms], keeping its UTC offset. */
function shiftLocal(value: string | undefined, ms: number) {
  const base = parseLocal(value)
  const offset = String(value || '').match(/([+-])(\d{2}):(\d{2})$/)
  if (!base || !offset) return null
  const offsetMs = (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60000
  const local = new Date(base.ms + ms + offsetMs)
  const hhmm = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`
  return { hhmm, ms: base.ms + ms }
}

/** How long a result stays fresh. */
function freshFor(status: FlightStatus, arrivalMs: number | null) {
  const minute = 60 * 1000
  const state = status.status.toLowerCase()
  if (!status.found) return 6 * 60 * minute
  if (/landed|arrived|cancel|divert/.test(state) || status.actualArrival) return 24 * 60 * minute
  // Far off: next look about an hour before landing.
  if (arrivalMs && arrivalMs - Date.now() > 2 * 60 * minute) return arrivalMs - Date.now() - 60 * minute
  return 45 * minute
}

function empty(number: string, date: string): FlightStatus {
  return {
    number, date, found: false, status: '', airline: '', fromIata: '', fromCity: '', toIata: '',
    scheduledArrival: '', expectedArrival: '', actualArrival: '', delayMinutes: 0, terminal: '', gate: '',
    checkedAt: new Date().toISOString(),
  }
}

/** Picks the leg arriving at [airportIata] (multi-leg flight numbers), else the last leg. */
function toStatus(number: string, date: string, legs: any[], airportIata?: string): { value: FlightStatus; arrivalMs: number | null } {
  if (!legs.length) return { value: empty(number, date), arrivalMs: null }
  const leg = (airportIata && legs.find(l => l?.arrival?.airport?.iata === airportIata)) || legs[legs.length - 1]
  const arrival = leg.arrival || {}
  const scheduled = parseLocal(arrival.scheduledTime?.local)
  const actual = parseLocal(arrival.runwayTime?.local) || parseLocal(arrival.actualTime?.local)
  // Only live times count. predictedTime is AeroDataBox's statistical guess (often 15-25 min
  // late on schedule-only data), so it isn't used. Before the arrival has a revised time, a
  // late departure pushes the scheduled arrival back by the same amount.
  const departure = leg.departure || {}
  const depScheduled = parseLocal(departure.scheduledTime?.local)
  const depLive = parseLocal(departure.runwayTime?.local) || parseLocal(departure.revisedTime?.local)
  const depDelayMs = depScheduled && depLive ? depLive.ms - depScheduled.ms : 0
  const shifted = scheduled && depDelayMs > 0 ? shiftLocal(arrival.scheduledTime?.local, depDelayMs) : null
  const expected = parseLocal(arrival.revisedTime?.local) || shifted
  const best = actual || expected
  const value: FlightStatus = {
    number, date, found: true,
    status: String(leg.status || ''),
    airline: String(leg.airline?.name || ''),
    fromIata: String(leg.departure?.airport?.iata || ''),
    fromCity: String(leg.departure?.airport?.municipalityName || leg.departure?.airport?.name || ''),
    toIata: String(arrival.airport?.iata || ''),
    scheduledArrival: scheduled?.hhmm || '',
    expectedArrival: expected?.hhmm || '',
    actualArrival: actual?.hhmm || '',
    delayMinutes: scheduled && best ? Math.round((best.ms - scheduled.ms) / 60000) : 0,
    terminal: String(arrival.terminal || ''),
    gate: String(arrival.gate || ''),
    checkedAt: new Date().toISOString(),
  }
  return { value, arrivalMs: (best || scheduled)?.ms ?? null }
}

async function fetchLegs(number: string, date: string) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
  if (usage.day !== today) usage = { day: today, calls: 0, budget: dailyBudget(), fromQuota: quota !== null }
  if (usage.calls >= usage.budget) throw new Error('Flight lookups paused for today (quota budget reached).')
  usage.calls++

  const url = `https://${HOST}/flights/number/${encodeURIComponent(number)}/${date}?withAircraftImage=false&withLocation=false&dateLocalRole=Arrival`
  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': process.env.AERODATABOX_API_KEY || '', 'X-RapidAPI-Host': HOST },
    cache: 'no-store',
  })
  const remaining = Number(res.headers.get('x-ratelimit-api-units-remaining'))
  const resetSeconds = Number(res.headers.get('x-ratelimit-api-units-reset'))
  if (Number.isFinite(remaining) && Number.isFinite(resetSeconds)) {
    quota = { remaining, resetAt: Date.now() + resetSeconds * 1000 }
    // First response since start-up: set today's budget from the real quota.
    if (!usage.fromQuota) usage = { ...usage, budget: usage.calls + dailyBudget(), fromQuota: true }
  }
  if (res.status === 204 || res.status === 404) return []
  if (!res.ok) throw new Error(`AeroDataBox ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/** Lookups allowed per day: units left, spread over the days until the quota resets. */
function dailyBudget() {
  if (!quota) return 2 // until a response tells us the real quota
  if (Date.now() > quota.resetAt) return 10
  const days = Math.max(1, Math.ceil((quota.resetAt - Date.now()) / 86400000))
  const calls = Math.floor((quota.remaining - RESERVE_UNITS) / UNITS_PER_CALL)
  return Math.max(0, Math.floor(calls / days))
}

/** Status of [flightNumber] arriving on [date] (yyyy-MM-dd, local), at [airportIata] if given. */
export async function getFlightStatus(flightNumber: string, date: string, airportIata?: string): Promise<FlightStatus> {
  const number = normalizeFlightNumber(flightNumber)
  const key = `${number}|${date}|${airportIata || ''}`
  const hit = cache.get(key)
  if (hit && Date.now() < hit.until) return hit.value

  let pending = inflight.get(key)
  if (!pending) {
    pending = fetchLegs(number, date)
      .then(legs => {
        const { value, arrivalMs } = toStatus(number, date, legs, airportIata)
        cache.set(key, { until: Date.now() + freshFor(value, arrivalMs), value })
        return value
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  return pending
}
