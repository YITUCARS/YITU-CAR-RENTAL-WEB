import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { vehicleRepo } from '@/lib/db'
import { getCachedRcmVehicles } from '@/lib/rcm-vehicle-cache'

export const dynamic = 'force-dynamic'

function authorised(req: NextRequest) {
  return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

function ymd(value: string | null, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : fallback
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function rcmDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

async function fetchAgentBookings(from: string, to: string) {
  const key = process.env.RCM_AGENT_API_KEY
  const secret = process.env.RCM_AGENT_SHARED_SECRET || process.env.RCM_SHARED_SECRET
  if (!key || !secret) return []

  const request = JSON.stringify({
    method: 'agentbookings',
    startdate: rcmDate(from),
    enddate: rcmDate(to),
    reservationno: 0,
  })
  const signature = crypto.createHmac('sha256', secret).update(request).digest('hex').toUpperCase()
  const domain = process.env.RCM_AGENT_API_DOMAIN || 'api.rentalcarmanager.com'
  const url = `https://apis.rentalcarmanager.com/agent/booking/v3.2/${key}?apikey=${key}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', signature, 'x-rcm-api-domain': domain },
    body: request,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Agent API returned ${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload) ? payload : payload?.results?.bookings || payload?.results?.agentbookings || payload?.bookings || payload?.agentbookings || []
  return Array.isArray(rows) ? rows : []
}

function normalizeBooking(raw: any, source: string) {
  const value = (keys: string[], fallback = '') => {
    for (const key of keys) {
      if (raw?.[key] !== undefined && raw?.[key] !== null && String(raw[key]).trim()) return String(raw[key])
    }
    return fallback
  }
  return {
    id: value(['reservation_ref', 'reservationref', 'reservationno', 'reservation_no', 'bookingref'], crypto.randomUUID()),
    pickupDate: value(['pickup_date', 'pickupdate', 'pickupDate']),
    dropoffDate: value(['dropoff_date', 'dropoffdate', 'dropoffDate', 'returndate']),
    pickupTime: value(['pickup_time', 'pickuptime', 'pickupTime'], '10:00'),
    dropoffTime: value(['dropoff_time', 'dropofftime', 'dropoffTime'], '10:00'),
    pickupLocation: value(['pickup_location', 'pickuplocation', 'pickupLocation']),
    dropoffLocation: value(['dropoff_location', 'dropofflocation', 'dropoffLocation']),
    vehicle: value(['vehicle_name', 'vehiclecategory', 'vehicleCategory', 'vehicle', 'model'], '车型预订'),
    plate: value(['registrationno', 'registration', 'rego', 'vehicleplate', 'plate']),
    customer: value(['customer_name', 'customername', 'customerName', 'firstname'], '未填写客户'),
    status: value(['status', 'bookingstatus', 'booking_status'], 'confirmed').toLowerCase(),
    source,
    total: value(['total_price', 'total', 'totalcost', 'grandtotal']),
  }
}

async function fetchLocalBookings(from: string, to: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  const { data, error } = await createClient(url, key)
    .from('wx_user_bookings')
    .select('reservation_ref,reservation_no,vehicle_name,vehicle_type,pickup_location,dropoff_location,pickup_date,dropoff_date,pickup_time,dropoff_time,firstname,lastname,total_price,status')
    .lte('pickup_date', to)
    .gte('dropoff_date', from)
    .limit(500)
  if (error) {
    console.warn('[admin/availability] local booking query skipped:', error.message)
    return []
  }
  return (data || []).map(row => normalizeBooking({ ...row, customer_name: [row.firstname, row.lastname].filter(Boolean).join(' ') }, 'Website / 小程序'))
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const today = new Date().toISOString().slice(0, 10)
  const search = new URL(req.url).searchParams
  const from = ymd(search.get('from'), today)
  const to = ymd(search.get('to'), addDays(from, 13))

  try {
    const [localVehicles, localBookings, cached] = await Promise.all([vehicleRepo.getAll(), fetchLocalBookings(from, to), getCachedRcmVehicles()])
    const vehicles = localVehicles.length > 0 ? localVehicles : cached.vehicles.map((vehicle: any) => ({
      id: `rcm-${vehicle.vehiclecategoryid}`,
      brand: String(vehicle.vehiclecategory || vehicle.categoryfriendlydescription || 'RCM').split(' ')[0],
      model: vehicle.categoryfriendlydescription || vehicle.vehiclecategory || `车型 ${vehicle.vehiclecategoryid}`,
      category: String(vehicle.vehiclecategory || '').toLowerCase().includes('van') ? 'van' : String(vehicle.vehiclecategory || '').toLowerCase().includes('suv') ? 'suv' : '其他',
      seats: Number(vehicle.numberofadults) || undefined,
      bags: Number(vehicle.numberoflargecases) || 0,
      active: true,
      image: vehicle.imageurl || '',
      rcm_category_id: vehicle.vehiclecategoryid,
    }))
    let agentBookings: any[] = []
    let agentError = ''
    try {
      agentBookings = (await fetchAgentBookings(from, to)).map(row => normalizeBooking(row, 'Agent API'))
    } catch (error: any) {
      agentError = error?.message || 'Agent API unavailable'
    }
    return NextResponse.json({
      success: true,
      from,
      to,
      vehicles,
      bookings: [...localBookings, ...agentBookings],
      sources: { local: localBookings.length, agent: agentBookings.length, agentError },
    })
  } catch (error: any) {
    console.error('[admin/availability] error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
