export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Read-only window onto the competitor price dataset collected by the
 * market-intel service (see /market-intel).
 *
 * The data lives in its own `market_intel` schema, which is not exposed to
 * PostgREST. This route reads the `public.mi_*` bridge views instead, which are
 * granted to service_role only — created by market-intel/sql/005_admin_views.sql.
 *
 * Nothing here writes. Collection is run by the market-intel CLI, not by the
 * website, so a bug in the admin UI can never corrupt the dataset.
 */

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

function auth(req: NextRequest) {
    return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

const NOT_INSTALLED = /relation .*mi_.* does not exist|could not find the table/i

function isNotInstalled(message: string | undefined) {
    return !!message && NOT_INSTALLED.test(message)
}

export async function GET(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'overview'

    try {
        if (view === 'curve') {
            const location = searchParams.get('location') ?? 'CHC_APT'
            const pickupDate = searchParams.get('pickup')
            const vehicleClass = searchParams.get('class')
            const duration = Number(searchParams.get('duration') ?? 5)
            if (!pickupDate || !vehicleClass) {
                return NextResponse.json({ error: 'pickup and class are required' }, { status: 400 })
            }

            const { data, error } = await supabase
                .from('mi_lead_time_curve')
                .select('*')
                .eq('pickup_location_code', location)
                .eq('pickup_date', pickupDate)
                .eq('vehicle_class', vehicleClass)
                .eq('duration_days', duration)
                .order('observed_date')
            if (error) throw new Error(error.message)
            return NextResponse.json({ curve: data ?? [] })
        }

        if (view === 'unresolved') {
            const { data, error } = await supabase
                .from('mi_unresolved_vehicles')
                .select('*')
                .limit(100)
            if (error) throw new Error(error.message)
            return NextResponse.json({ unresolved: data ?? [] })
        }

        // ---- overview ------------------------------------------------------
        const location = searchParams.get('location') ?? 'CHC_APT'
        const duration = Number(searchParams.get('duration') ?? 5)

        const [summary, health, runs, pickupDates, errors] = await Promise.all([
            supabase.from('mi_dataset_summary').select('*').single(),
            supabase.from('mi_source_health').select('*').order('source_code'),
            supabase.from('mi_recent_runs').select('*').limit(5),
            supabase
                .from('mi_pickup_dates')
                .select('*')
                .eq('pickup_location_code', location)
                .eq('duration_days', duration)
                .order('pickup_date'),
            supabase.from('mi_recent_errors').select('*').limit(8),
        ])

        const firstError = [summary, health, runs, pickupDates, errors].find((r) => r.error)?.error
        if (firstError) throw new Error(firstError.message)

        // Latest market snapshot: the most recent observation day we hold.
        const { data: latestDay } = await supabase
            .from('mi_market_daily')
            .select('observed_date')
            .eq('pickup_location_code', location)
            .order('observed_date', { ascending: false })
            .limit(1)
            .maybeSingle()

        let market: unknown[] = []
        if (latestDay?.observed_date) {
            const { data, error } = await supabase
                .from('mi_market_daily')
                .select('*')
                .eq('pickup_location_code', location)
                .eq('observed_date', latestDay.observed_date)
                .eq('duration_days', duration)
                .order('vehicle_class')
            if (error) throw new Error(error.message)
            market = data ?? []
        }

        return NextResponse.json({
            installed: true,
            summary: summary.data ?? null,
            sources: health.data ?? [],
            runs: runs.data ?? [],
            pickupDates: pickupDates.data ?? [],
            errors: errors.data ?? [],
            market,
            marketObservedDate: latestDay?.observed_date ?? null,
        })
    } catch (e: any) {
        // A brand-new install has no market_intel schema yet; say so plainly
        // instead of showing a broken page.
        if (isNotInstalled(e?.message)) {
            return NextResponse.json({
                installed: false,
                error: '竞品价格数据库还没建。请在 market-intel 目录运行 npm run mi -- migrate',
            })
        }
        return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
    }
}
