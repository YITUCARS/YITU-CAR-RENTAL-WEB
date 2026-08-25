import { NextRequest, NextResponse } from 'next/server'

export function partnerAuth(req: NextRequest) {
  const configured = (process.env.PARTNER_API_KEYS || '').split(',').map(value => value.trim()).filter(Boolean)
  const header = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!configured.length) return NextResponse.json({ success: false, error: 'Partner API is not configured.' }, { status: 503 })
  if (!header || !configured.includes(header)) return NextResponse.json({ success: false, error: 'Invalid API key.' }, { status: 401 })
  return null
}

export function partnerError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Partner API request failed.'
  return NextResponse.json({ success: false, error: message }, { status })
}
