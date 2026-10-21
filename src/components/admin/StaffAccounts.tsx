'use client'

import { useEffect, useState } from 'react'
import {
  STAFF_PERMISSIONS,
  defaultPermissionsForRole,
  type StaffPermission,
  type StaffRole,
} from '@/lib/staff-permissions'

type Role = StaffRole

type Account = {
  id: string
  username: string
  display_name: string
  role: Role
  permissions: StaffPermission[]
  branches: string[]
  active: boolean
  notes?: string | null
  last_login_at?: string | null
}

// "manager" is shown as 管理员: admins can tick off the RCM status checklist in YITU Lite.
const ROLE_LABEL: Record<Role, string> = { staff: '员工', manager: '管理员' }

const PERMISSION_LABEL: Record<StaffPermission, { title: string; detail: string }> = {
  'bookings.read': { title: '查看订单', detail: '查看订单、日历、通知和门店列表' },
  'bookings.refresh': { title: '刷新 RCM 数据', detail: '手动从 RCM 拉取最新订单' },
  'pickup.manage': { title: '办理取车', detail: '填写驾驶员资料并完成取车' },
  'dropoff.manage': { title: '办理还车', detail: '记录里程、油量、损伤并完成还车' },
  'photos.upload': { title: '上传照片', detail: '把车辆和证件照片上传到 RCM' },
  'agreements.manage': { title: '合同与签名', detail: '查看合同、保存签名及发送文件' },
  'completions.confirm': { title: '确认 RCM 已更新', detail: '勾选完成记录里的 RCM 状态待办' },
}

const EMPTY_FORM = {
  username: '', displayName: '', password: '', role: 'staff' as Role,
  permissions: defaultPermissionsForRole('staff'), branches: [] as string[], notes: '',
}

function BranchPicker({ all, value, onChange }: { all: string[]; value: string[]; onChange: (next: string[]) => void }) {
  if (all.length === 0) return <p className="text-[11px] text-muted">暂时读取不到 RCM 门店，账号可先创建，默认可见全部门店。</p>
  const toggle = (branch: string) => onChange(value.includes(branch) ? value.filter(item => item !== branch) : [...value, branch])
  return (
    <div className="flex flex-wrap gap-2">
      {all.map(branch => (
        <button key={branch} type="button" onClick={() => toggle(branch)}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${value.includes(branch) ? 'border-navy bg-navy text-white' : 'border-black/10 text-muted hover:border-navy/40'}`}>
          {branch}
        </button>
      ))}
      <span className="self-center text-[11px] text-muted">{value.length === 0 ? '未勾选 = 全部门店' : `仅可见 ${value.length} 个门店`}</span>
    </div>
  )
}

function RolePicker({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['staff', 'manager'] as Role[]).map(role => (
        <button key={role} type="button" onClick={() => onChange(role)}
          className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${value === role ? 'border-orange bg-orange text-white' : 'border-black/10 text-muted hover:border-orange/40'}`}>
          {ROLE_LABEL[role]}
        </button>
      ))}
      <span className="text-[11px] text-muted">选择角色会套用一组默认权限，之后仍可逐项调整。</span>
    </div>
  )
}

function PermissionPicker({ value, onChange }: { value: StaffPermission[]; onChange: (next: StaffPermission[]) => void }) {
  const toggle = (permission: StaffPermission) => onChange(
    value.includes(permission) ? value.filter(item => item !== permission) : [...value, permission]
  )
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {STAFF_PERMISSIONS.map(permission => {
        const enabled = value.includes(permission)
        const label = PERMISSION_LABEL[permission]
        return (
          <button key={permission} type="button" onClick={() => toggle(permission)} aria-pressed={enabled}
            className={`rounded-xl border p-3 text-left transition ${enabled ? 'border-orange bg-orange/5' : 'border-black/10 bg-white hover:border-orange/35'}`}>
            <span className="flex items-center gap-2 text-xs font-bold text-navy">
              <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${enabled ? 'border-orange bg-orange text-white' : 'border-black/20'}`}>{enabled ? '✓' : ''}</span>
              {label.title}
            </span>
            <span className="mt-1 block pl-6 text-[11px] font-normal leading-relaxed text-muted">{label.detail}</span>
          </button>
        )
      })}
    </div>
  )
}

function AccountEditor({ account, branches, onSave, onCancel }: {
  account: Account
  branches: string[]
  onSave: (update: { displayName: string; role: Role; permissions: StaffPermission[]; branches: string[]; password: string }) => void
  onCancel: () => void
}) {
  const [displayName, setDisplayName] = useState(account.display_name)
  const [role, setRole] = useState<Role>(account.role)
  const [permissions, setPermissions] = useState<StaffPermission[]>(account.permissions || defaultPermissionsForRole(account.role))
  const [picked, setPicked] = useState<string[]>(account.branches || [])
  const [password, setPassword] = useState('')

  return (
    <div className="mt-4 w-full space-y-3 border-t border-black/10 pt-4">
      <label className="block text-xs font-bold text-muted">显示名称
        <input value={displayName} onChange={event => setDisplayName(event.target.value)} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange" />
      </label>
      <div className="text-xs font-bold text-muted">角色<div className="mt-1"><RolePicker value={role} onChange={next => { setRole(next); setPermissions(defaultPermissionsForRole(next)) }} /></div></div>
      <div className="text-xs font-bold text-muted">功能权限<div className="mt-1"><PermissionPicker value={permissions} onChange={setPermissions} /></div></div>
      <div className="text-xs font-bold text-muted">可见门店<div className="mt-1"><BranchPicker all={branches} value={picked} onChange={setPicked} /></div></div>
      <label className="block text-xs font-bold text-muted">重置密码（留空不修改）
        <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少8位" className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange" />
      </label>
      <div className="flex gap-2">
        <button onClick={() => onSave({ displayName, role, permissions, branches: picked, password })} className="rounded-xl bg-orange px-4 py-2.5 text-xs font-bold text-white">保存</button>
        <button onClick={onCancel} className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-bold text-muted">取消</button>
      </div>
    </div>
  )
}

export default function StaffAccounts({ token, showToast }: { token: string; showToast: (message: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [permissionsReady, setPermissionsReady] = useState(true)
  const headers = { 'x-admin-token': token, 'Content-Type': 'application/json' }

  async function load() {
    const response = await fetch('/api/admin/staff-accounts', { headers })
    const data = await response.json()
    if (data.success) {
      setAccounts(data.accounts)
      setBranches(data.branches || [])
      setPermissionsReady(data.permissionsReady !== false)
      setLoadError('')
    } else {
      setLoadError(data.error || '加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    const response = await fetch('/api/admin/staff-accounts', { method: 'POST', headers, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) return showToast(data.error || '创建失败')
    setForm(EMPTY_FORM)
    setCreateOpen(false)
    showToast('员工账号已创建')
    load()
  }

  async function update(account: Account, body: Record<string, unknown>, message: string) {
    const response = await fetch(`/api/admin/staff-accounts/${account.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) return showToast(data.error || '保存失败')
    showToast(message)
    setEditingId('')
    load()
  }

  async function remove(account: Account) {
    if (!confirm(`删除员工账号 ${account.username}？`)) return
    await fetch(`/api/admin/staff-accounts/${account.id}`, { method: 'DELETE', headers })
    showToast('账号已删除')
    load()
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 lg:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-navy px-6 py-6 text-white shadow-[0_18px_45px_rgba(10,25,55,0.12)] sm:px-8">
        <div><div className="text-[11px] font-bold uppercase tracking-[2px] text-orange">YITU Lite</div><h2 className="mt-1 font-syne text-2xl font-extrabold">员工账号与权限</h2><p className="mt-2 max-w-xl text-sm text-white/65">管理员工 App 的登录账号、可见门店和每一项操作权限。权限同时在服务端强制执行。</p></div>
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right"><div className="text-2xl font-extrabold">{accounts.length}</div><div className="text-[11px] text-white/60">员工账号</div></div>
      </div>

      {loadError && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">读取员工账号失败：{loadError}。如果是第一次使用，请先在 Supabase SQL Editor 执行 <code>supabase/staff-accounts.sql</code>。</div>}
      {!loadError && !permissionsReady && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">现有账号仍可正常登录，但细分权限尚未写入数据库。请先在 Supabase SQL Editor 执行 <code>supabase/staff-accounts.sql</code>，再新增或修改权限。</div>}

      <div className="space-y-6">
        <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-6">
          <button type="button" onClick={() => setCreateOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left"><div><div className="text-[10px] font-bold uppercase tracking-[1.5px] text-orange">New staff</div><h3 className="mt-1 font-syne text-lg font-extrabold text-navy">创建员工账号</h3><p className="mt-1 text-xs text-muted">员工用这个账号和密码登录 YITU Lite。</p></div><span className="rounded-xl bg-orange/10 px-3 py-2 text-xs font-bold text-orange">{createOpen ? '收起' : '+ 展开创建'}</span></button>
          {createOpen && <div className="mt-4 space-y-3">
            {([['username', '登录账号'], ['displayName', '显示名称'], ['password', '初始密码'], ['notes', '备注']] as const).map(([key, label]) => (
              <label key={key} className="block text-xs font-bold text-muted">
                {label}
                <input type={key === 'password' ? 'password' : 'text'} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange" />
              </label>
            ))}
            <div className="text-xs font-bold text-muted">角色<div className="mt-1"><RolePicker value={form.role} onChange={role => setForm({ ...form, role, permissions: defaultPermissionsForRole(role) })} /></div></div>
            <div className="text-xs font-bold text-muted">功能权限<div className="mt-1"><PermissionPicker value={form.permissions} onChange={permissions => setForm({ ...form, permissions })} /></div></div>
            <div className="text-xs font-bold text-muted">可见门店<div className="mt-1"><BranchPicker all={branches} value={form.branches} onChange={next => setForm({ ...form, branches: next })} /></div></div>
            <button onClick={create} className="w-full rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(234,117,48,0.2)] transition hover:-translate-y-0.5">创建账号</button>
          </div>}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1"><div><h3 className="font-syne text-lg font-extrabold text-navy">账号列表</h3><p className="mt-0.5 text-xs text-muted">分配角色、门店，停用或重置密码</p></div><span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-bold text-muted">{accounts.filter(account => account.active).length} 个启用</span></div>
          {loading ? <div className="rounded-2xl bg-white p-5 text-sm text-muted">加载中…</div> : accounts.length === 0 ? <div className="rounded-2xl bg-white p-5 text-sm text-muted">还没有员工账号。</div> : accounts.map(account => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm transition hover:border-orange/30">
              <div className="flex min-w-[220px] items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy font-syne font-extrabold text-white">{account.display_name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div className="font-bold text-navy">{account.display_name} <span className="ml-1 text-xs font-normal text-muted">@{account.username}</span><span className="ml-2 rounded-full bg-orange/10 px-2 py-0.5 text-[10px] font-bold text-orange">{ROLE_LABEL[account.role] || account.role}</span></div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${account.active ? 'bg-green-500' : 'bg-black/25'}`} />
                    {account.active ? '启用中' : '已停用'}
                    <span>· {account.branches?.length ? account.branches.join(' / ') : '全部门店'}</span>
                    <span>· {account.permissions?.length ?? 0} 项权限</span>
                    {account.last_login_at ? <span>· 上次登录 {new Date(account.last_login_at).toLocaleString()}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingId(editingId === account.id ? '' : account.id)} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black/[0.03]">{editingId === account.id ? '收起' : '编辑'}</button>
                <button onClick={() => update(account, { active: !account.active }, account.active ? '账号已停用' : '账号已启用')} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black/[0.03]">{account.active ? '停用' : '启用'}</button>
                <button onClick={() => remove(account)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">删除</button>
              </div>
              {editingId === account.id && (
                <AccountEditor account={account} branches={branches} onCancel={() => setEditingId('')}
                  onSave={({ displayName, role, permissions, branches: picked, password }) => update(account, { displayName, role, permissions, branches: picked, ...(password ? { password } : {}) }, '已保存')} />
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
