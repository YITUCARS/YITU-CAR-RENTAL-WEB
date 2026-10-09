import { NextRequest, NextResponse } from 'next/server'
import { readPartnerSession } from '@/lib/partner-auth'
export async function GET(req: NextRequest) { const session = readPartnerSession(req); return session ? NextResponse.json({ success: true, account: { username: session.username, displayName: session.displayName } }) : NextResponse.json({ success: false }, { status: 401 }) }
