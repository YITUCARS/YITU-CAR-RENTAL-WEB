import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { hashPartnerPassword } from '@/lib/partner-auth'
import { getLocationNames } from '@/lib/staff-api'
import { accountPermissions, cleanStaffPermissions, defaultPermissionsForRole, type StaffRole } from '@/lib/staff-permissions'

// YITU Lite staff accounts (员工账号). Passwords use the same scrypt hashing as partner accounts.

const FIELDS = 'id,username,display_name,role,permissions,branches,active,notes,last_login_at,created_at,updated_at'
const LEGACY_FIELDS = 'id,username,display_name,role,branches,active,notes,last_login_at,created_at,updated_at'

function authorized(req: NextRequest) { return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD }

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const supabase = getSupabaseAdmin()
    const result = await supabase.from('staff_accounts').select(FIELDS).order('created_at', { ascending: false })
    let data: any[] = result.data || []
    let permissionsReady = true
    if (result.error?.code === '42703') {
      const legacy = await supabase.from('staff_accounts').select(LEGACY_FIELDS).order('created_at', { ascending: false })
      if (legacy.error) throw legacy.error
      permissionsReady = false
      data = (legacy.data || []).map(account => {
        const role: StaffRole = account.role === 'manager' ? 'manager' : 'staff'
        return { ...account, permissions: accountPermissions(undefined, role) }
      })
    } else if (result.error) {
      throw result.error
    }
    // RCM branch names for the access checkboxes; the list still loads if RCM is unreachable.
    const branches = await getLocationNames().then(names => Array.from(names.values()).filter(Boolean)).catch(() => [])
    return NextResponse.json({ success: true, accounts: data, branches, permissionsReady })
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const username = String(body.username || '').trim().toLowerCase()
    const displayName = String(body.displayName || '').trim()
    const password = String(body.password || '')
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || !displayName || password.length < 8) {
      return NextResponse.json({ success: false, error: '账号至少3位，只能使用英文、数字、点、下划线或短横线；密码至少8位。' }, { status: 400 })
    }
    const role: StaffRole = body.role === 'manager' ? 'manager' : 'staff'
    const permissions = body.permissions === undefined
      ? defaultPermissionsForRole(role)
      : cleanStaffPermissions(body.permissions)
    const { data, error } = await getSupabaseAdmin().from('staff_accounts').insert({
      username,
      display_name: displayName,
      password_hash: hashPartnerPassword(password),
      role,
      permissions,
      branches: Array.isArray(body.branches) ? body.branches.map(String) : [],
      active: body.active !== false,
      notes: String(body.notes || '').trim() || null,
    }).select(FIELDS).single()
    if (error?.code === '42703') {
      return NextResponse.json({ success: false, error: '请先在 Supabase 执行 supabase/staff-accounts.sql，再创建带权限的账号。' }, { status: 409 })
    }
    if (error) throw error.code === '23505' ? new Error('这个账号已经存在。') : error
    return NextResponse.json({ success: true, account: data })
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
}
