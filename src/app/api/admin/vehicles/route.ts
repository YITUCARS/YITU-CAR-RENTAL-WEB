import { NextRequest, NextResponse } from 'next/server'
import { vehicleRepo } from '@/lib/db'

function checkAuth(req: NextRequest) {
    const token = req.headers.get('x-admin-token')
    return token === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
    if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const vehicles = await vehicleRepo.getAll()
    return NextResponse.json(vehicles)
}

export async function POST(req: NextRequest) {
    if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const vehicle = await vehicleRepo.create(body)
    return NextResponse.json(vehicle)
}