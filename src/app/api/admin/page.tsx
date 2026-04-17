'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Upload, X, Check, LogOut, FileText } from 'lucide-react'
import type { VehicleRecord } from '@/lib/db/repository'
import Papa from 'papaparse'

const CATEGORIES = ['sedan', 'suv', 'mpv', 'van']
const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'Electric']
const DRIVES = ['FWD', 'AWD', 'RWD']

const EMPTY: Omit<VehicleRecord, 'id' | 'created_at'> = {
    brand: '', model: '', category: 'suv', seats: 5, bags: 3,
    fuel: 'Petrol', drive: 'AWD', price_per_day: 89,
    tags: [], image: '', active: true,
}

export default function AdminPage() {
    const [token, setToken] = useState('')
    const [authed, setAuthed] = useState(false)
    const [pw, setPw] = useState('')
    const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
    const [editing, setEditing] = useState<Partial<VehicleRecord> | null>(null)
    const [isNew, setIsNew] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)
    const csvRef = useRef<HTMLInputElement>(null)

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(''), 3000)
    }

    const headers = { 'x-admin-token': token, 'Content-Type': 'application/json' }

    async function login() {
        const res = await fetch('/api/admin/vehicles', {
            headers: { 'x-admin-token': pw }
        })
        if (res.ok) { setToken(pw); setAuthed(true) }
        else showToast('密码错误')
    }

    async function load() {
        const res = await fetch('/api/admin/vehicles', { headers })
        const data = await res.json()
        setVehicles(data)
    }

    useEffect(() => { if (authed) load() }, [authed])

    async function save() {
        setSaving(true)
        try {
            if (isNew) {
                await fetch('/api/admin/vehicles', {
                    method: 'POST', headers,
                    body: JSON.stringify(editing),
                })
                showToast('✅ 车辆已添加')
            } else {
                await fetch(`/api/admin/vehicles/${editing!.id}`, {
                    method: 'PUT', headers,
                    body: JSON.stringify(editing),
                })
                showToast('✅ 已保存')
            }
            setEditing(null)
            load()
        } finally { setSaving(false) }
    }

    async function remove(id: string) {
        if (!confirm('确认删除这辆车？')) return
        await fetch(`/api/admin/vehicles/${id}`, { method: 'DELETE', headers })
        showToast('🗑️ 已删除')
        load()
    }

    async function uploadImage(file: File) {
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'x-admin-token': token },
                body: fd,
            })
            const { url } = await res.json()
            setEditing(e => ({ ...e, image: url }))
            showToast('✅ 图片已上传')
        } finally { setUploading(false) }
    }

    function importCsv(file: File) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[]
                let count = 0
                for (const row of rows) {
                    const payload = {
                        brand: row.brand || '',
                        model: row.model || '',
                        category: row.category || 'suv',
                        seats: parseInt(row.seats) || 5,
                        bags: parseInt(row.bags) || 3,
                        fuel: row.fuel || 'Petrol',
                        drive: row.drive || 'AWD',
                        price_per_day: parseInt(row.price_per_day) || 89,
                        tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
                        image: row.image || '',
                        active: row.active !== 'false',
                    }
                    await fetch('/api/admin/vehicles', {
                        method: 'POST', headers,
                        body: JSON.stringify(payload),
                    })
                    count++
                }
                showToast(`✅ 已导入 ${count} 辆车`)
                load()
            }
        })
    }

    // Login screen
    if (!authed) return (
        <div className="min-h-screen bg-navy flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                <div className="font-syne font-extrabold text-2xl text-navy mb-1">YITU Admin</div>
                <div className="text-muted text-sm mb-6">管理员后台</div>
                <input
                    type="password"
                    placeholder="输入管理员密码"
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && login()}
                    className="w-full border border-black/10 rounded-lg px-4 py-3 text-sm mb-3 outline-none focus:border-orange"
                />
                <button
                    onClick={login}
                    className="w-full bg-orange hover:bg-orange-dark text-white font-syne font-bold py-3 rounded-lg transition-colors"
                >
                    登录
                </button>
                {toast && <div className="mt-3 text-red-500 text-sm text-center">{toast}</div>}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-off-white">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-navy text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="bg-navy text-white px-8 py-4 flex items-center justify-between">
                <div className="font-syne font-extrabold text-lg">YITU Admin <span className="text-orange">·</span> 车队管理</div>
                <div className="flex items-center gap-3">
                    {/* CSV 导入 */}
                    <input ref={csvRef} type="file" accept=".csv" className="hidden"
                           onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />
                    <button
                        onClick={() => csvRef.current?.click()}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        <FileText size={14} /> 导入 CSV
                    </button>
                    {/* 新增车辆 */}
                    <button
                        onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}
                        className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={14} /> 新增车辆
                    </button>
                    <button onClick={() => setAuthed(false)} className="text-white/50 hover:text-white">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* CSV 格式提示 */}
            <div className="px-8 py-3 bg-navy/5 border-b border-black/10 text-[12px] text-muted">
                CSV 格式：<code className="bg-black/5 px-1 rounded">brand, model, category, seats, bags, fuel, drive, price_per_day, tags, image, active</code>
                &nbsp;· tags 用逗号分隔 · active 填 true/false
            </div>

            {/* Vehicle table */}
            <div className="px-8 py-6">
                <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-black/10 bg-off-white">
                            <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">车辆</th>
                            <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">类别</th>
                            <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">价格/天</th>
                            <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">状态</th>
                            <th className="text-right px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">操作</th>
                        </tr>
                        </thead>
                        <tbody>
                        {vehicles.map((v, i) => (
                            <tr key={v.id} className={`border-b border-black/[0.06] hover:bg-off-white transition-colors ${i % 2 === 0 ? '' : 'bg-black/[0.01]'}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {v.image && (
                                            <img src={v.image} alt={v.model} className="w-16 h-10 object-cover rounded-lg flex-shrink-0" />
                                        )}
                                        <div>
                                            <div className="font-semibold text-navy">{v.brand} {v.model}</div>
                                            <div className="text-[11px] text-muted">{v.seats} seats · {v.fuel} · {v.drive}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                    <span className="bg-navy/[0.06] text-navy text-[11px] font-medium px-2.5 py-1 rounded-full uppercase">
                      {v.category}
                    </span>
                                </td>
                                <td className="px-4 py-3 font-syne font-bold text-navy">${v.price_per_day}</td>
                                <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${v.active ? 'bg-green-50 text-green-700' : 'bg-black/5 text-muted'}`}>
                      {v.active ? '上架' : '下架'}
                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                        <button
                                            onClick={() => { setEditing({ ...v }); setIsNew(false) }}
                                            className="p-1.5 text-muted hover:text-navy hover:bg-black/5 rounded-lg transition-colors"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => remove(v.id)}
                                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {vehicles.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-muted text-sm">
                                    暂无车辆数据，点击「新增车辆」或「导入 CSV」开始添加
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit modal */}
            {editing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
                            <h2 className="font-syne font-bold text-navy text-lg">
                                {isNew ? '新增车辆' : '编辑车辆'}
                            </h2>
                            <button onClick={() => setEditing(null)} className="text-muted hover:text-navy">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="px-6 py-5 space-y-4">
                            {/* Image upload */}
                            <div>
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">车辆图片</label>
                                <div className="flex gap-3 items-start">
                                    {editing.image && (
                                        <img src={editing.image} alt="" className="w-28 h-16 object-cover rounded-lg border border-black/10" />
                                    )}
                                    <div>
                                        <input ref={fileRef} type="file" accept="image/*" className="hidden"
                                               onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                                        <button
                                            onClick={() => fileRef.current?.click()}
                                            disabled={uploading}
                                            className="flex items-center gap-1.5 bg-off-white border border-black/10 hover:border-orange text-navy text-sm px-4 py-2 rounded-lg transition-colors"
                                        >
                                            <Upload size={13} />
                                            {uploading ? '上传中...' : '上传图片'}
                                        </button>
                                        <div className="mt-1.5">
                                            <input
                                                type="text"
                                                placeholder="或直接粘贴图片 URL"
                                                value={editing.image || ''}
                                                onChange={e => setEditing(v => ({ ...v, image: e.target.value }))}
                                                className="w-full text-[12px] border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-orange"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Brand + Model */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">品牌</label>
                                    <input
                                        value={editing.brand || ''}
                                        onChange={e => setEditing(v => ({ ...v, brand: e.target.value }))}
                                        className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                        placeholder="e.g. Toyota"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">车型</label>
                                    <input
                                        value={editing.model || ''}
                                        onChange={e => setEditing(v => ({ ...v, model: e.target.value }))}
                                        className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                        placeholder="e.g. RAV4 Hybrid"
                                    />
                                </div>
                            </div>

                            {/* Category + Fuel + Drive */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">类别</label>
                                    <select
                                        value={editing.category || 'suv'}
                                        onChange={e => setEditing(v => ({ ...v, category: e.target.value as any }))}
                                        className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange bg-white"
                                    >
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">燃料</label>
                                    <select
                                        value={editing.fuel || 'Petrol'}
                                        onChange={e => setEditing(v => ({ ...v, fuel: e.target.value as any }))}
                                        className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange bg-white"
                                    >
                                        {FUELS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">驱动</label>
                                    <select
                                        value={editing.drive || 'AWD'}
                                        onChange={e => setEditing(v => ({ ...v, drive: e.target.value as any }))}
                                        className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange bg-white"
                                    >
                                        {DRIVES.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Seats + Bags + Price */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">座位数</label>
                                    <input type="number"
                                           value={editing.seats || ''}
                                           onChange={e => setEditing(v => ({ ...v, seats: parseInt(e.target.value) }))}
                                           className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">行李数</label>
                                    <input type="number"
                                           value={editing.bags || ''}
                                           onChange={e => setEditing(v => ({ ...v, bags: parseInt(e.target.value) }))}
                                           className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">价格/天 ($)</label>
                                    <input type="number"
                                           value={editing.price_per_day || ''}
                                           onChange={e => setEditing(v => ({ ...v, price_per_day: parseInt(e.target.value) }))}
                                           className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                    />
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">标签（逗号分隔）</label>
                                <input
                                    value={(editing.tags || []).join(', ')}
                                    onChange={e => setEditing(v => ({ ...v, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                                    className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                    placeholder="e.g. CarPlay, Cruise, A/C"
                                />
                            </div>

                            {/* Active toggle */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setEditing(v => ({ ...v, active: !v?.active }))}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${editing.active ? 'bg-orange' : 'bg-black/20'}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editing.active ? 'left-5' : 'left-1'}`} />
                                </button>
                                <span className="text-sm text-navy font-medium">{editing.active ? '上架显示' : '下架隐藏'}</span>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3">
                            <button
                                onClick={() => setEditing(null)}
                                className="px-5 py-2.5 text-sm text-muted hover:text-navy border border-black/10 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={save}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm rounded-lg transition-colors disabled:opacity-60"
                            >
                                <Check size={14} />
                                {saving ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}