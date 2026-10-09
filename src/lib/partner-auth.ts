import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const COOKIE = 'yitu-partner-session'
const DEFAULT_TTL = 1000 * 60 * 60 * 12

function secret() { return process.env.PARTNER_SESSION_SECRET || process.env.STAFF_TOKEN_SECRET || process.env.RCM_SHARED_SECRET || 'yitu-partner-dev-secret' }
function encode(value: string) { return Buffer.from(value).toString('base64url') }
function decode(value: string) { return Buffer.from(value, 'base64url').toString('utf8') }
function sign(value: string) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url') }

export function hashPartnerPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPartnerPassword(password: string, stored: string) {
  const [, salt, expected] = String(stored || '').split(':')
  if (!salt || !expected) return false
  const actual = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

export function issuePartnerSession(account: { id: string; username: string; display_name: string; discount_percent?: number }, remember: boolean) {
  const payload = encode(JSON.stringify({ id: account.id, username: account.username, displayName: account.display_name, discountPercent: Number(account.discount_percent || 0), exp: Date.now() + (remember ? 1000 * 60 * 60 * 24 * 30 : DEFAULT_TTL) }))
  return `${payload}.${sign(payload)}`
}

export function readPartnerSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value || ''
  const [payload, signature] = token.split('.')
  if (!payload || signature !== sign(payload)) return null
  try {
    const value = JSON.parse(decode(payload))
    return value.exp > Date.now() ? value : null
  } catch { return null }
}

export function setPartnerCookie(response: NextResponse, token: string, remember: boolean) {
  response.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: remember ? 60 * 60 * 24 * 30 : undefined })
}

export function clearPartnerCookie(response: NextResponse) { response.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 }) }

export async function getPartnerAccounts() {
  const { data, error } = await getSupabaseAdmin().from('partner_accounts').select('id,username,display_name,active,remember_days,notes,last_login_at,created_at,updated_at').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
