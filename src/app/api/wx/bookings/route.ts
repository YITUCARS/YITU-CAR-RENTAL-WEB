export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rcmCall } from '@/lib/rcm'

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    return createClient(url, key)
}

function normalizeStatus(info: any, fallback = 'created') {
    const bookingInfo = Array.isArray(info?.bookinginfo) ? info.bookinginfo[0] : info?.bookinginfo
    const raw = String(
        info?.status ??
        info?.bookingstatus ??
        info?.booking_status ??
        info?.reservationstatus ??
        bookingInfo?.status ??
        bookingInfo?.bookingstatus ??
        bookingInfo?.booking_status ??
        bookingInfo?.reservationstatus ??
        fallback
    ).toLowerCase()

    if (raw.includes('cancel')) return 'cancelled'
    if (raw.includes('complete') || raw.includes('closed')) return 'completed'
    if (raw.includes('hired') || raw.includes('hire')) return 'hired'
    if (raw.includes('reservation request')) return 'reservation_request'
    if (raw === 'reservation' || raw.includes('reservation')) return 'reservation'
    if (raw.includes('confirm')) return 'confirmed'
    if (raw.includes('pending') || raw.includes('quote')) return 'pending'
    return raw || fallback
}

function getDisplayReservationNo(info: any) {
    const bookingInfo = Array.isArray(info?.bookinginfo) ? info.bookinginfo[0] : info?.bookinginfo
    const value =
        info?.reservationno ??
        info?.reservationNo ??
        info?.reservation_no ??
        info?.reservationdocumentno ??
        info?.reservationDocumentNo ??
        info?.documentno ??
        info?.documentNo ??
        info?.refno ??
        bookingInfo?.reservationno ??
        bookingInfo?.reservationNo ??
        bookingInfo?.reservation_no ??
        bookingInfo?.reservationdocumentno ??
        bookingInfo?.reservationDocumentNo ??
        bookingInfo?.documentno ??
        bookingInfo?.documentNo ??
        bookingInfo?.refno ??
        ''
    return value ? String(value).replace(/^#/, '') : ''
}

function cleanRef(value: any) {
    return String(value || '').trim().replace(/^#/, '')
}

async function tryBookingInfo(params: Record<string, any>, label: string) {
    try {
        const info = await rcmCall('bookinginfo', params)
        console.log(`[wx/bookings] RCM snapshot ${label} succeeded`)
        return info
    } catch (err: any) {
        console.warn(`[wx/bookings] RCM snapshot ${label} failed:`, err.message)
        return null
    }
}

async function fetchRcmSnapshot(reservationRef: string, lastName: string, fallbackStatus: string, reservationNo = '') {
    if (!reservationRef || !lastName) return { status: fallbackStatus || 'created', reservationNo: '', found: false }

    const alphaRefs = Array.from(new Set([cleanRef(reservationRef), cleanRef(reservationNo)].filter(Boolean)))
    const numericRefs = alphaRefs.filter((value) => {
        const n = Number(value)
        return Number.isFinite(n) && n > 0
    })

    let info: any = null
    for (const value of alphaRefs) {
        info =
            (await tryBookingInfo({ reservationref: value, lastname: lastName }, 'reservationref+lastname')) ||
            (await tryBookingInfo({ bookingref: value, lastname: lastName }, 'bookingref+lastname')) ||
            (await tryBookingInfo({ refno: value, lastname: lastName }, 'refno+lastname'))
        if (info) break
    }

    if (!info) {
        for (const value of numericRefs) {
            info = await tryBookingInfo({ reservationno: Number(value), lastname: lastName }, 'reservationno+lastname')
            if (info) break
        }
    }

    if (!info) {
        return { status: fallbackStatus || 'created', reservationNo: '', found: false }
    }

    return {
        status: normalizeStatus(info, fallbackStatus),
        reservationNo: getDisplayReservationNo(info),
        found: true,
    }
}

// GET /api/wx/bookings?openid=xxx  — fetch all bookings for a user
export async function GET(req: NextRequest) {
    try {
        const openid = req.nextUrl.searchParams.get('openid')
        if (!openid) {
            return NextResponse.json({ error: 'Missing openid' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('wx_user_bookings')
            .select('*')
            .eq('openid', openid)
            .order('created_at', { ascending: false })

        if (error) throw error

        const bookings = await Promise.all((data || []).map(async (booking: any) => {
            const currentStatus = booking.status || 'created'
            const snapshot = await fetchRcmSnapshot(
                booking.reservation_ref,
                booking.lastname,
                currentStatus,
                booking.reservation_no || ''
            )
            const latestStatus = snapshot.status
            const latestReservationNo = snapshot.reservationNo || booking.reservation_no || ''

            if (latestStatus !== currentStatus || (snapshot.reservationNo && snapshot.reservationNo !== booking.reservation_no)) {
                const updatePayload: any = { status: latestStatus }
                if (snapshot.reservationNo) updatePayload.reservation_no = snapshot.reservationNo
                const { error: updateError } = await supabase
                    .from('wx_user_bookings')
                    .update(updatePayload)
                    .eq('openid', openid)
                    .eq('reservation_ref', booking.reservation_ref)
                if (updateError && updateError.message && updateError.message.includes('reservation_no')) {
                    await supabase
                        .from('wx_user_bookings')
                        .update({ status: latestStatus })
                        .eq('openid', openid)
                        .eq('reservation_ref', booking.reservation_ref)
                } else if (updateError) {
                    console.warn('[wx/bookings] status writeback failed:', booking.reservation_ref, updateError.message)
                }
            }

            return { ...booking, status: latestStatus, reservation_no: latestReservationNo }
        }))

        return NextResponse.json({ bookings })
    } catch (err: any) {
        console.error('[wx/bookings GET] error:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST /api/wx/bookings  — save a new booking for a user
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            openid, reservationRef, vehicleName, vehicleType,
            pickupLocation, dropoffLocation,
            pickupDate, dropoffDate, pickupTime, dropoffTime,
            totalPrice, deposit, firstname, lastname,
            cnyRate, cnyDeposit, rateDate, status, promoCode, reservationNo, priceBreakdown, action
        } = body

        if (!openid || !reservationRef) {
            return NextResponse.json({ error: 'Missing openid or reservationRef' }, { status: 400 })
        }

        if (action === 'updateStatus') {
            const updatePayload: any = { status: status || 'created' }
            if (reservationNo) updatePayload.reservation_no = String(reservationNo)
            const { error } = await getSupabase()
                .from('wx_user_bookings')
                .update(updatePayload)
                .eq('openid', openid)
                .eq('reservation_ref', reservationRef)

            if (error && error.message && /status|reservation_no/.test(error.message)) {
                return NextResponse.json({ success: true, statusIgnored: true })
            }
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        const basePayload = {
            openid,
            reservation_ref: reservationRef,
            vehicle_name: vehicleName,
            vehicle_type: vehicleType,
            pickup_location: pickupLocation,
            dropoff_location: dropoffLocation,
            pickup_date: pickupDate,
            dropoff_date: dropoffDate,
            pickup_time: pickupTime,
            dropoff_time: dropoffTime,
            total_price: totalPrice,
            deposit,
            firstname,
            lastname,
        }

        const extendedPayload = {
            ...basePayload,
            cny_rate: cnyRate || null,
            cny_deposit: cnyDeposit || null,
            rate_date: rateDate || null,
            status: status || 'created',
            promo_code: promoCode || null,
            reservation_no: reservationNo || null,
            price_breakdown: Array.isArray(priceBreakdown) ? priceBreakdown : null,
        }

        // Upsert — avoid duplicate entries if user retries
        let { error } = await getSupabase()
            .from('wx_user_bookings')
            .upsert(extendedPayload, { onConflict: 'openid,reservation_ref' })

        if (error && /cny_rate|cny_deposit|rate_date|status|promo_code|reservation_no|price_breakdown/.test(error.message || '')) {
            console.warn('[wx/bookings POST] extended columns unavailable, retrying base payload')
            const fallback = await getSupabase()
                .from('wx_user_bookings')
                .upsert(basePayload, { onConflict: 'openid,reservation_ref' })
            error = fallback.error
        }

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[wx/bookings POST] error:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
