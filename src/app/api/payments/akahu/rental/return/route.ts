import { NextRequest, NextResponse } from 'next/server'

/** Closes the app web view after Akahu finishes authorisation. The app then polls status. */
export async function GET(req: NextRequest) {
  const url = new URL('vantu://akahu-rental-return')
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))
  return NextResponse.redirect(url)
}
