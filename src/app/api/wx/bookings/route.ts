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
            totalPrice, deposit, firstname, lastname
        } = body

        if (!openid || !reservationRef) {
            return NextResponse.json({ error: 'Missing openid or reservationRef' }, { status: 400 })
        }

        // Upsert — avoid duplicate entries if user retries
        const { error } = await getSupabase()
            .from('wx_user_bookings')
            .upsert({
                openid,
                reservation_ref: reservationRef,
                vehicle_name:    vehicleName,
                vehicle_type:    vehicleType,
                pickup_location:  pickupLocation,
                dropoff_location: dropoffLocation,
                pickup_date:  pickupDate,
                dropoff_date: dropoffDate,
                pickup_time:  pickupTime,
                dropoff_time: dropoffTime,
                total_price: totalPrice,
                deposit,
                firstname,
                lastname,
            }, { onConflict: 'openid,reservation_ref' })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[wx/bookings POST] error:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
