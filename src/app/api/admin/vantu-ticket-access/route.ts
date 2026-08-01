import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

function verifyAdmin(req: Request) {
  return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

function buildSignedTicketsUrl() {
  const secret = process.env.YITU_DISTRIBUTOR_SIGNING_SECRET?.trim()
  if (!secret) throw new Error('Missing YITU_DISTRIBUTOR_SIGNING_SECRET.')

  const base = process.env.VANTU_DISTRIBUTOR_TICKETS_URL || 'https://vantugroup.com/en/tickets'
  const code = 'YITU'
  const exp = String(Math.floor(Date.now() / 1000) + 15 * 60)
  const sig = createHmac('sha256', secret).update(`${code}.${exp}`).digest('hex')
  const url = new URL(base)
  url.searchParams.set('distributor', code)
  url.searchParams.set('exp', exp)
  url.searchParams.set('sig', sig)
  return url.toString()
}

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json({ ok: true, url: buildSignedTicketsUrl() })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to create Vantu ticket access URL.' },
      { status: 500 },
    )
  }
}
