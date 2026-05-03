export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    return createClient(url, key)
}

// GET /api/wx/bookings?openid=xxx  — fetch all bookings for a user
export async function GET(req: NextRequest) {
    try {
        const openid = req.nextUrl.searchParams.get('openid')
        if (!openid) {
            return NextResponse.json({ error: 'Missing openid' }, { status: 400 })
        }

        const { data, error } = await getSupabase()
            .from('wx_user_bookings')
            .select('*')
            .eq('openid', openid)
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ bookings: data })
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
            cnyRate, cnyDeposit, rateDate, status, promoCode, action
        } = body

        if (!openid || !reservationRef) {
            return NextResponse.json({ error: 'Missing openid or reservationRef' }, { status: 400 })
        }

        if (action === 'updateStatus') {
            const { error } = await getSupabase()
                .from('wx_user_bookings')
                .update({ status: status || 'created' })
                .eq('openid', openid)
                .eq('reservation_ref', reservationRef)

            if (error && error.message && error.message.includes('status')) {
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
        }

        // Upsert — avoid duplicate entries if user retries
        let { error } = await getSupabase()
            .from('wx_user_bookings')
            .upsert(extendedPayload, { onConflict: 'openid,reservation_ref' })

        if (error && /cny_rate|cny_deposit|rate_date|status|promo_code/.test(error.message || '')) {
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
