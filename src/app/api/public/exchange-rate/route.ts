export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=NZD&to=CNY', {
      cache: 'no-store',
    })
    const data = await res.json()
    const rate = Number(data?.rates?.CNY || 0)

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Invalid exchange rate')
    }

    return NextResponse.json({
      from: 'NZD',
      to: 'CNY',
      rate,
      date: data.date || new Date().toISOString().slice(0, 10),
    })
  } catch (err: any) {
    console.error('[exchange-rate] error:', err.message)
    return NextResponse.json({
      from: 'NZD',
      to: 'CNY',
      rate: 4.3,
      fallback: true,
      error: err.message,
      date: new Date().toISOString().slice(0, 10),
    })
  }
}
