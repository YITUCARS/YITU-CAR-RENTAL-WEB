import { NextResponse } from 'next/server'
import { vehicleRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const vehicles = await vehicleRepo.getActive()
    return NextResponse.json({ vehicles }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
  } catch (error) {
    console.error('[public/fleet] failed to load vehicles:', error)
    return NextResponse.json({ vehicles: [], error: 'Unable to load fleet' }, { status: 500 })
  }
}
