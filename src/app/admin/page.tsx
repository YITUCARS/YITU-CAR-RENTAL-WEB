'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Upload, X, Check, LogOut, FileText, RefreshCw, Star, Save, Tag, Copy, Image, ChevronUp, ChevronDown } from 'lucide-react'
import type { VehicleRecord } from '@/lib/db/repository'
import Papa from 'papaparse'

const CATEGORIES = ['sedan', 'suv', 'mpv', 'van']
const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'Electric']
const DRIVES = ['FWD', 'AWD', 'RWD']

interface GalleryImage {
    name: string
    path: string
    url: string
    created_at?: string | null
}

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

    // ── RCM tab ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'fleet' | 'rcm' | 'promo' | 'banners' | 'deals' | 'gallery' | 'blog'>('fleet')
    const [rcmVehicles, setRcmVehicles] = useState<any[]>([])
    const [rcmLoading, setRcmLoading] = useState(false)
    const [featured, setFeatured] = useState<Map<number, any>>(new Map())
    const [savingFeatured, setSavingFeatured] = useState(false)

    // ── Promo codes tab ──────────────────────────────────────────────────────
    const [promoCodes, setPromoCodes] = useState<any[]>([])
    const [promoLoading, setPromoLoading] = useState(false)
    const [newPromo, setNewPromo] = useState({ discount_type: 'percent', discount_value: '', expires_at: '', code: '' })

    // ── Banners tab ───────────────────────────────────────────────────────────
    const [banners, setBanners] = useState<any[]>([])
    const [bannersLoading, setBannersLoading] = useState(false)
    const [editingBanner, setEditingBanner] = useState<any | null>(null)
    const [bannerUploading, setBannerUploading] = useState(false)
    const bannerFileRef = useRef<HTMLInputElement>(null)

    // ── Deals tab ─────────────────────────────────────────────────────────────
    const [deals, setDeals] = useState<any[]>([])
    const [dealsLoading, setDealsLoading] = useState(false)
    const [editingDeal, setEditingDeal] = useState<any | null>(null)
    const [dealImgUploading, setDealImgUploading] = useState(false)
    const dealFileRef = useRef<HTMLInputElement>(null)

    // ── Gallery tab ───────────────────────────────────────────────────────────
    const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
    const [galleryLoading, setGalleryLoading] = useState(false)
    const [galleryUploading, setGalleryUploading] = useState(false)
    const galleryFileRef = useRef<HTMLInputElement>(null)

    // ── Blog tab ──────────────────────────────────────────────────────────────
    const [blogPosts, setBlogPosts] = useState<any[]>([])
    const [blogLoading, setBlogLoading] = useState(false)
    const [editingBlog, setEditingBlog] = useState<any | null>(null)
    const [blogImgUploading, setBlogImgUploading] = useState(false)
    const blogFileRef = useRef<HTMLInputElement>(null)

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

    // ── RCM helpers ──────────────────────────────────────────────────────────

    async function loadRCMVehicles() {
        setRcmLoading(true)
        try {
            const res = await fetch('/api/admin/rcm-vehicles', { headers: { 'x-admin-token': token } })
            const data = await res.json()
            if (data.success) setRcmVehicles(data.vehicles)
            else showToast('⚠️ ' + data.error)
        } finally { setRcmLoading(false) }
    }

    async function loadFeatured() {
        try {
            const res = await fetch('/api/admin/featured', { headers: { 'x-admin-token': token } })
            const data = await res.json()
            const map = new Map<number, any>()
            if (Array.isArray(data)) {
                data.forEach((row: { slot: number; vehicle_json: any }) => map.set(row.slot, row.vehicle_json))
            }
            setFeatured(map)
        } catch {
            // silently ignore — featured stays empty
        }
    }

    async function saveFeatured() {
        setSavingFeatured(true)
        try {
            const slots = Array.from(featured.entries()).map(([slot, vehicle_json]) => ({ slot, vehicle_json }))
            const res = await fetch('/api/admin/featured', {
                method: 'POST',
                headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify(slots),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                showToast('✅ 首页展示已保存')
            } else {
                showToast('❌ ' + (data.error || `HTTP ${res.status}`))
            }
        } catch (err: any) {
            showToast('❌ 网络错误: ' + err.message)
        } finally { setSavingFeatured(false) }
    }

    function inferRCMCategory(v: any): string {
        const text = `${v.vehiclecategory} ${v.categoryfriendlydescription}`.toLowerCase()
        if (text.includes('van') || v.numberofadults >= 10) return 'van'
        if (text.includes('alphard') || text.includes('staria') || text.includes('people mover') || v.numberofadults >= 7) return 'mpv'
        if (text.includes('suv') || text.includes('rav4') || text.includes('forester')) return 'suv'
        return 'sedan'
    }

    function mapRCMVehicle(v: any) {
        const imageurl = v.imageurl || ''
        return {
            rcm_category_id: v.vehiclecategoryid,
            name: v.categoryfriendlydescription || v.vehiclecategory,
            image_url: imageurl.startsWith('//') ? `https:${imageurl}` : imageurl,
            price_per_day: v.avgrate,
            seats: v.numberofadults,
            large_bags: v.numberoflargecases,
            small_bags: v.numberofsmallcases,
            category: inferRCMCategory(v),
        }
    }

    function getVehicleSlot(v: any): number | null {
        for (const [slot, fv] of Array.from(featured.entries())) {
            if (fv.rcm_category_id === v.vehiclecategoryid) return slot
        }
        return null
    }

    function setVehicleSlot(v: any, slot: number | null) {
        setFeatured(prev => {
            const next = new Map(prev)
            // Remove this vehicle from any existing slot
            for (const [s, fv] of Array.from(next.entries())) {
                if (fv.rcm_category_id === v.vehiclecategoryid) next.delete(s)
            }
            if (slot !== null) next.set(slot, mapRCMVehicle(v))
            return next
        })
    }

    function switchToRCMTab() {
        setActiveTab('rcm')
        loadFeatured()
    }

    // ── Promo code helpers ────────────────────────────────────────────────────

    async function loadPromoCodes() {
        setPromoLoading(true)
        try {
            const res = await fetch('/api/admin/promo-codes', { headers: { 'x-admin-token': token } })
            const data = await res.json()
            if (Array.isArray(data)) setPromoCodes(data)
            else showToast('❌ ' + (data.error || 'Load failed'))
        } finally { setPromoLoading(false) }
    }

    async function generatePromoCode() {
        const code = newPromo.code.trim().toUpperCase()
        if (!code) { showToast('❌ 请输入优惠码名称'); return }
        const res = await fetch('/api/admin/promo-codes', {
            method: 'POST',
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                discount_type: 'percent',
                discount_value: 0,
                notes: newPromo.discount_value || '',
                expires_at: newPromo.expires_at || null,
            }),
        })
        const data = await res.json()
        if (res.ok) {
            showToast('✅ 已保存备注: ' + data.code)
            setNewPromo({ discount_type: 'percent', discount_value: '', expires_at: '', code: '' })
            loadPromoCodes()
        } else {
            showToast('❌ ' + (data.error || 'Save failed'))
        }
    }

    async function togglePromoActive(id: string, active: boolean) {
        const res = await fetch(`/api/admin/promo-codes/${id}`, {
            method: 'PATCH',
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ active }),
        })
        if (res.ok) loadPromoCodes()
        else showToast('❌ 操作失败')
    }

    async function deletePromoCode(id: string) {
        if (!confirm('确认删除此优惠码？')) return
        const res = await fetch(`/api/admin/promo-codes/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': token },
        })
        if (res.ok) { showToast('🗑️ 已删除'); loadPromoCodes() }
        else showToast('❌ 删除失败')
    }

    // ── Banner helpers ────────────────────────────────────────────────────────

    async function loadBanners() {
        setBannersLoading(true)
        try {
            const res = await fetch('/api/admin/banners', { headers: { 'x-admin-token': token } })
            const data = await res.json()
            if (Array.isArray(data)) setBanners(data)
            else showToast('❌ ' + (data.error || 'Load failed'))
        } finally { setBannersLoading(false) }
    }

    async function saveBanner(banner: any) {
        const isNew = !banner.id
        const url = isNew ? '/api/admin/banners' : `/api/admin/banners/${banner.id}`
        const method = isNew ? 'POST' : 'PUT'
        const res = await fetch(url, {
            method,
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify(banner),
        })
        const data = await res.json()
        if (res.ok) {
            showToast('✅ 轮播图已保存')
            setEditingBanner(null)
            loadBanners()
        } else {
            showToast('❌ ' + (data.error || 'Save failed'))
        }
    }

    async function deleteBanner(id: string) {
        if (!confirm('确认删除此轮播图？')) return
        const res = await fetch(`/api/admin/banners/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': token },
        })
        if (res.ok) { showToast('🗑️ 已删除'); loadBanners() }
        else showToast('❌ 删除失败')
    }

    async function toggleBannerActive(id: string, active: boolean) {
        const res = await fetch(`/api/admin/banners/${id}`, {
            method: 'PUT',
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ active }),
        })
        if (res.ok) loadBanners()
        else showToast('❌ 操作失败')
    }

    async function moveBanner(id: string, direction: 'up' | 'down') {
        const idx = banners.findIndex(b => b.id === id)
        if (idx < 0) return
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= banners.length) return
        const a = banners[idx]
        const b = banners[swapIdx]
        await Promise.all([
            fetch(`/api/admin/banners/${a.id}`, {
                method: 'PUT',
                headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_order: b.display_order }),
            }),
            fetch(`/api/admin/banners/${b.id}`, {
                method: 'PUT',
                headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_order: a.display_order }),
            }),
        ])
        loadBanners()
    }

    // ── Deals helpers ─────────────────────────────────────────────────────────

    async function loadDeals() {
        setDealsLoading(true)
        try {
            const res = await fetch('/api/admin/deals', { headers: { 'x-admin-token': token } })
            const data = await res.json()
            if (Array.isArray(data)) setDeals(data)
            else showToast('❌ ' + (data.error || 'Load failed'))
        } finally { setDealsLoading(false) }
    }

    async function saveDeal(deal: any) {
        if (!deal.title?.trim()) { showToast('❌ 请填写活动标题'); return }

        // Auto-generate slug from title if empty
        const slugBase = (deal.title as string)
            .toLowerCase().trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'deal'
        const dealToSave = {
            ...deal,
            slug: deal.slug?.trim() || `${slugBase}-${Date.now().toString(36)}`,
        }

        const isNew = !dealToSave.id
        const url = isNew ? '/api/admin/deals' : `/api/admin/deals/${dealToSave.id}`
        const method = isNew ? 'POST' : 'PUT'
        const res = await fetch(url, {
            method,
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify(dealToSave),
        })
        const data = await res.json()
        if (res.ok) {
            showToast('✅ 活动已保存')
            setEditingDeal(null)
            loadDeals()
        } else {
            showToast('❌ ' + (data.error || 'Save failed'))
        }
    }

    async function deleteDeal(id: string) {
        if (!confirm('确认删除此活动？')) return
        const res = await fetch(`/api/admin/deals/${id}`, { method: 'DELETE', headers: { 'x-admin-token': token } })
        if (res.ok) { showToast('🗑️ 已删除'); loadDeals() }
        else showToast('❌ 删除失败')
    }

    async function toggleDealActive(id: string, active: boolean) {
        const res = await fetch(`/api/admin/deals/${id}`, {
            method: 'PUT',
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ active }),
        })
        if (res.ok) loadDeals()
        else showToast('❌ 操作失败')
    }

    async function moveDeal(id: string, direction: 'up' | 'down') {
        const idx = deals.findIndex((d: any) => d.id === id)
        if (idx < 0) return
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= deals.length) return
        const a = deals[idx], b = deals[swapIdx]
        await Promise.all([
            fetch(`/api/admin/deals/${a.id}`, { method: 'PUT', headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_order: b.display_order }) }),
            fetch(`/api/admin/deals/${b.id}`, { method: 'PUT', headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_order: a.display_order }) }),
        ])
        loadDeals()
    }

    async function uploadDealImage(file: File) {
        setDealImgUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'x-admin-token': token }, body: fd })
            const data = await res.json()
            if (!res.ok || data.error) { showToast('❌ 上传失败: ' + (data.error || `HTTP ${res.status}`)); return }
            setEditingDeal((d: any) => ({ ...d, image_url: data.url }))
            showToast('✅ 图片已上传')
        } catch (err: any) {
            showToast('❌ 上传失败: ' + err.message)
        } finally { setDealImgUploading(false) }
    }

    async function uploadBannerImage(file: File) {
        setBannerUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'x-admin-token': token },
                body: fd,
            })
            const data = await res.json()
            if (!res.ok || data.error) {
                showToast('❌ 上传失败: ' + (data.error || `HTTP ${res.status}`))
                return
            }
            setEditingBanner((b: any) => ({ ...b, image_url: data.url }))
            showToast('✅ 图片已上传')
        } catch (err: any) {
            showToast('❌ 上传失败: ' + err.message)
        } finally { setBannerUploading(false) }
    }

    // ── Gallery helpers ───────────────────────────────────────────────────────

    async function loadGalleryImages() {
        setGalleryLoading(true)
        try {
            const res = await fetch('/api/admin/gallery', { headers: { 'x-admin-token': token } })
            const data = await res.json()
            if (Array.isArray(data)) setGalleryImages(data)
            else showToast('❌ ' + (data.error || 'Load failed'))
        } finally { setGalleryLoading(false) }
    }

    async function uploadGalleryImage(file: File) {
        setGalleryUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('folder', 'gallery')
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'x-admin-token': token },
                body: fd,
            })
            const data = await res.json()
            if (!res.ok || data.error) {
                showToast('❌ 上传失败: ' + (data.error || `HTTP ${res.status}`))
                return
            }
            showToast('✅ Gallery 图片已上传')
            loadGalleryImages()
        } catch (err: any) {
            showToast('❌ 上传失败: ' + err.message)
        } finally { setGalleryUploading(false) }
    }

    async function deleteGalleryImage(path: string) {
        if (!confirm('确认删除这张图库图片？')) return
        const res = await fetch('/api/admin/gallery', {
            method: 'DELETE',
            headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
        })
        const data = await res.json()
        if (res.ok) {
            showToast('🗑️ 图片已删除')
            loadGalleryImages()
        } else {
            showToast('❌ ' + (data.error || '删除失败'))
        }
    }

    async function loadBlogPosts() {
        setBlogLoading(true)
        const res = await fetch('/api/admin/blog', { headers })
        const data = await res.json()
        setBlogPosts(Array.isArray(data) ? data : [])
        setBlogLoading(false)
    }

    async function saveBlogPost(post: any) {
        const isNew = !post.id
        const url = isNew ? '/api/admin/blog' : `/api/admin/blog/${post.id}`
        const method = isNew ? 'POST' : 'PUT'
        const res = await fetch(url, { method, headers, body: JSON.stringify(post) })
        const data = await res.json()
        if (!res.ok) { showToast('❌ ' + (data.error || '保存失败')); return }
        showToast('✅ 已保存')
        setEditingBlog(null)
        loadBlogPosts()
    }

    async function deleteBlogPost(id: string) {
        if (!confirm('确定删除这篇文章？')) return
        const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE', headers })
        if (res.ok) { showToast('✅ 已删除'); loadBlogPosts() }
        else showToast('❌ 删除失败')
    }

    async function uploadBlogImage(file: File) {
        setBlogImgUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('folder', 'blog')
            const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'x-admin-token': token }, body: fd })
            const data = await res.json()
            if (!res.ok || data.error) { showToast('❌ 上传失败: ' + (data.error || `HTTP ${res.status}`)); return }
            setEditingBlog((p: any) => ({ ...p, image_url: data.url }))
            showToast('✅ 图片已上传')
        } finally { setBlogImgUploading(false) }
    }

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
                    {activeTab === 'fleet' && (
                        <>
                            <input ref={csvRef} type="file" accept=".csv" className="hidden"
                                   onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />
                            <button
                                onClick={() => csvRef.current?.click()}
                                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                            >
                                <FileText size={14} /> 导入 CSV
                            </button>
                            <button
                                onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}
                                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                            >
                                <Plus size={14} /> 新增车辆
                            </button>
                        </>
                    )}
                    {activeTab === 'rcm' && (
                        <>
                            <button
                                onClick={loadRCMVehicles}
                                disabled={rcmLoading}
                                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={rcmLoading ? 'animate-spin' : ''} />
                                {rcmLoading ? '同步中...' : '从 RCM 同步'}
                            </button>
                            <button
                                onClick={saveFeatured}
                                disabled={savingFeatured || featured.size === 0}
                                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Save size={14} />
                                {savingFeatured ? '保存中...' : `保存首页展示 (${featured.size}/6)`}
                            </button>
                        </>
                    )}
                    {activeTab === 'promo' && (
                        <button
                            onClick={loadPromoCodes}
                            disabled={promoLoading}
                            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={promoLoading ? 'animate-spin' : ''} />
                            刷新
                        </button>
                    )}
                    {activeTab === 'banners' && (
                        <button
                            onClick={() => setEditingBanner({ image_url: '', title: '', label: '', active: true })}
                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                            <Plus size={14} /> 新增轮播图
                        </button>
                    )}
                    {activeTab === 'deals' && (
                        <button
                            onClick={() => setEditingDeal({ slug: '', title: '', description: '', value: '', unit: '', badge: 'Get Offer', image_url: '', content: '', active: true })}
                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                            <Plus size={14} /> 新增活动
                        </button>
                    )}
                    {activeTab === 'gallery' && (
                        <>
                            <input
                                ref={galleryFileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && uploadGalleryImage(e.target.files[0])}
                            />
                            <button
                                onClick={() => galleryFileRef.current?.click()}
                                disabled={galleryUploading}
                                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Upload size={14} /> {galleryUploading ? '上传中...' : '上传 Gallery 图片'}
                            </button>
                        </>
                    )}
                    <button onClick={() => setAuthed(false)} className="text-white/50 hover:text-white">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="bg-white border-b border-black/10 px-8 flex gap-0">
                <button
                    onClick={() => setActiveTab('fleet')}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'fleet' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    车队管理
                </button>
                <button
                    onClick={switchToRCMTab}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'rcm' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    RCM 库存 & 首页配置
                </button>
                <button
                    onClick={() => { setActiveTab('promo'); loadPromoCodes() }}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'promo' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    优惠码管理
                </button>
                <button
                    onClick={() => { setActiveTab('banners'); loadBanners() }}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'banners' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    广告轮播
                </button>
                <button
                    onClick={() => { setActiveTab('deals'); loadDeals() }}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'deals' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    优惠活动
                </button>
                <button
                    onClick={() => { setActiveTab('gallery'); loadGalleryImages() }}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'gallery' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    Gallery 图库
                </button>
                <button
                    onClick={() => { setActiveTab('blog'); loadBlogPosts() }}
                    className={`px-5 py-3.5 text-[13px] font-syne font-bold border-b-2 transition-colors ${activeTab === 'blog' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}
                >
                    Blog 管理
                </button>
            </div>

            {/* ── Fleet tab ── */}
            {activeTab === 'fleet' && <>
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
            </>}

            {/* ── RCM tab ── */}
            {activeTab === 'rcm' && (
                <div className="px-8 py-6 space-y-6">

                    {/* Featured preview strip */}
                    {featured.size > 0 && (
                        <div className="bg-orange/5 border border-orange/20 rounded-2xl p-5">
                            <div className="text-[12px] font-bold text-navy uppercase tracking-wide mb-3">
                                当前首页展示配置 ({featured.size}/6)
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {[1, 2, 3, 4, 5, 6].map(slot => {
                                    const v = featured.get(slot)
                                    return (
                                        <div key={slot} className={`rounded-xl border text-center p-2.5 text-[11px] ${v ? 'bg-white border-orange/30' : 'bg-black/5 border-black/10 border-dashed'}`}>
                                            <div className="font-bold text-orange mb-0.5">位置 {slot}</div>
                                            {v ? (
                                                <>
                                                    {v.image_url && <img src={v.image_url} alt={v.name} className="w-full h-10 object-contain mb-1" />}
                                                    <div className="text-navy font-medium leading-tight truncate">{v.name}</div>
                                                    <div className="text-muted">${v.price_per_day}/天</div>
                                                </>
                                            ) : (
                                                <div className="text-muted/50 py-2">空</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* RCM vehicle list */}
                    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                        {rcmVehicles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted">
                                <RefreshCw size={32} className="mb-3 opacity-30" />
                                <p className="text-[14px] font-medium">点击右上角「从 RCM 同步」获取实时车型数据</p>
                                <p className="text-[12px] mt-1">将从 RCM 拉取 Christchurch 下周可用车型</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-black/10 bg-off-white">
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">车辆</th>
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">规格</th>
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">价格/天</th>
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">首页位置</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rcmVehicles.map((v, i) => {
                                        const currentSlot = getVehicleSlot(v)
                                        const imageUrl = v.imageurl ? (v.imageurl.startsWith('//') ? `https:${v.imageurl}` : v.imageurl) : ''
                                        return (
                                            <tr key={v.vehiclecategoryid} className={`border-b border-black/[0.06] hover:bg-off-white transition-colors ${i % 2 === 0 ? '' : 'bg-black/[0.01]'}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {imageUrl ? (
                                                            <img src={imageUrl} alt={v.vehiclecategory} className="w-20 h-12 object-contain rounded-lg bg-off-white flex-shrink-0 p-1" />
                                                        ) : (
                                                            <div className="w-20 h-12 rounded-lg bg-off-white flex-shrink-0" />
                                                        )}
                                                        <div>
                                                            <div className="font-semibold text-navy">{v.categoryfriendlydescription || v.vehiclecategory}</div>
                                                            <div className="text-[11px] text-muted">{v.vehiclecategory}</div>
                                                        </div>
                                                        {currentSlot && (
                                                            <span className="ml-1 bg-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                位置 {currentSlot}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-muted text-[13px]">
                                                    {v.numberofadults} 人 · {v.numberoflargecases} 大 {v.numberofsmallcases} 小
                                                </td>
                                                <td className="px-4 py-3 font-syne font-bold text-navy">
                                                    ${v.avgrate}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={currentSlot ?? ''}
                                                        onChange={e => setVehicleSlot(v, e.target.value ? Number(e.target.value) : null)}
                                                        className="border border-black/10 rounded-lg px-3 py-2 text-[13px] text-navy bg-white outline-none focus:border-orange"
                                                    >
                                                        <option value="">— 不显示 —</option>
                                                        {[1, 2, 3, 4, 5, 6].map(slot => {
                                                            const occupant = featured.get(slot)
                                                            const isMine = occupant?.rcm_category_id === v.vehiclecategoryid
                                                            const isOccupied = occupant && !isMine
                                                            return (
                                                                <option key={slot} value={slot}>
                                                                    位置 {slot}{isMine ? ' ✓' : isOccupied ? ` (${occupant.name.split(' ')[0]})` : ''}
                                                                </option>
                                                            )
                                                        })}
                                                    </select>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Promo codes tab ── */}
            {activeTab === 'promo' && (
                <div className="px-8 py-6 space-y-6">
                    {/* Info panel */}
                    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Tag size={16} className="text-sky-600" />
                            </div>
                            <div>
                                <div className="font-syne font-bold text-navy text-[14px] mb-1">优惠码由 RCM 后台统一管理</div>
                                <p className="text-muted text-[13px] leading-[1.7]">
                                    优惠码需在 <strong>RCM 后台（rentalcarmanager.com）</strong> 中创建和配置。用户在预订流程的选车页面输入优惠码后，
                                    系统会通过 <code className="bg-sky-100 px-1.5 py-0.5 rounded text-sky-700 text-[12px]">campaigncode</code> 字段
                                    实时传递给 RCM API，RCM 会直接在搜索结果中返回折扣后的价格（<code className="bg-sky-100 px-1.5 py-0.5 rounded text-sky-700 text-[12px]">totalrateafterdiscount</code>）。
                                    折扣金额自动计算并显示在订单汇总中，无需在本后台手动配置折扣逻辑。
                                </p>
                                <p className="text-muted text-[12px] mt-2">
                                    以下列表为备注参考，记录您在 RCM 后台创建的优惠码名称，方便查阅。
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Add reference code form */}
                    <div className="bg-white rounded-2xl border border-black/10 p-6">
                        <div className="text-[13px] font-syne font-bold text-navy mb-4">添加优惠码备注</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <div>
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">优惠码（RCM 中的 Campaign Code）</label>
                                <input
                                    type="text"
                                    value={newPromo.code}
                                    onChange={e => setNewPromo(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                    className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                    placeholder="如 SUMMER10"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">备注说明（可选）</label>
                                <input
                                    type="text"
                                    value={newPromo.discount_value}
                                    onChange={e => setNewPromo(p => ({ ...p, discount_value: e.target.value }))}
                                    className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                    placeholder="如 夏季折扣10%"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">过期日期（可选）</label>
                                <input
                                    type="date"
                                    value={newPromo.expires_at}
                                    onChange={e => setNewPromo(p => ({ ...p, expires_at: e.target.value }))}
                                    className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                />
                            </div>
                        </div>
                        <button
                            onClick={generatePromoCode}
                            className="mt-4 flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
                        >
                            <Tag size={14} /> 保存备注
                        </button>
                    </div>

                    {/* Promo code reference list */}
                    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                        {promoLoading ? (
                            <div className="py-12 text-center text-muted text-sm">加载中...</div>
                        ) : promoCodes.length === 0 ? (
                            <div className="py-12 text-center text-muted text-sm">暂无备注码，在上方添加您在 RCM 后台创建的优惠码</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-black/10 bg-off-white">
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">优惠码</th>
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">备注说明</th>
                                        <th className="text-left px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">过期日期</th>
                                        <th className="text-right px-4 py-3 font-syne font-bold text-navy text-[12px] uppercase tracking-wide">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {promoCodes.map((pc, i) => (
                                        <tr key={pc.id} className={`border-b border-black/[0.06] hover:bg-off-white transition-colors ${i % 2 === 0 ? '' : 'bg-black/[0.01]'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-navy text-[15px] tracking-wider">{pc.code}</span>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(pc.code); showToast('✅ 已复制') }}
                                                        className="p-1 text-muted hover:text-orange transition-colors"
                                                        title="复制"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted text-[13px]">
                                                {pc.discount_value || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-muted text-[13px]">
                                                {pc.expires_at ? new Date(pc.expires_at).toLocaleDateString('zh-CN') : '永不过期'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => deletePromoCode(pc.id)}
                                                    className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Banners tab ── */}
            {activeTab === 'banners' && (
                <div className="px-8 py-6 space-y-4">
                    <div className="text-[12px] text-muted bg-navy/5 border border-black/10 rounded-xl px-4 py-3">
                        管理主页顶部轮播广告图。修改后主页将实时更新（无需刷新）。建议图片比例 16:9，宽度 ≥ 1200px。
                    </div>

                    {bannersLoading ? (
                        <div className="py-12 text-center text-muted text-sm">加载中...</div>
                    ) : banners.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-black/10 py-16 text-center text-muted text-sm">
                            暂无轮播图，点击右上角「新增轮播图」开始添加
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {banners.map((banner, idx) => (
                                <div key={banner.id} className={`bg-white rounded-2xl border overflow-hidden flex gap-0 ${banner.active ? 'border-black/10' : 'border-black/10 opacity-60'}`}>
                                    {/* Thumbnail */}
                                    <div className="w-40 h-28 flex-shrink-0 bg-off-white overflow-hidden">
                                        {banner.image_url ? (
                                            <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted/30">
                                                <Image size={24} />
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 px-5 py-4">
                                        <div className="text-[11px] text-muted uppercase tracking-wide mb-0.5">{banner.label || '—'}</div>
                                        <div className="font-syne font-bold text-navy text-[15px] leading-tight whitespace-pre-line">{banner.title || '（无标题）'}</div>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex flex-col items-center justify-center gap-1 px-4 border-l border-black/10">
                                        <button onClick={() => moveBanner(banner.id, 'up')} disabled={idx === 0} className="p-1.5 text-muted hover:text-navy disabled:opacity-30 transition-colors">
                                            <ChevronUp size={16} />
                                        </button>
                                        <button onClick={() => moveBanner(banner.id, 'down')} disabled={idx === banners.length - 1} className="p-1.5 text-muted hover:text-navy disabled:opacity-30 transition-colors">
                                            <ChevronDown size={16} />
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center justify-center gap-2 px-4 border-l border-black/10">
                                        <button
                                            onClick={() => toggleBannerActive(banner.id, !banner.active)}
                                            className={`w-10 h-6 rounded-full transition-colors relative ${banner.active ? 'bg-orange' : 'bg-black/20'}`}
                                        >
                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${banner.active ? 'left-5' : 'left-1'}`} />
                                        </button>
                                        <button onClick={() => setEditingBanner({ ...banner })} className="p-1.5 text-muted hover:text-navy hover:bg-black/5 rounded-lg transition-colors">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => deleteBanner(banner.id)} className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Banner edit modal */}
                    {editingBanner && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
                                    <h2 className="font-syne font-bold text-navy text-lg">{editingBanner.id ? '编辑轮播图' : '新增轮播图'}</h2>
                                    <button onClick={() => setEditingBanner(null)} className="text-muted hover:text-navy"><X size={20} /></button>
                                </div>
                                <div className="px-6 py-5 space-y-4">
                                    {/* Image upload */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">广告图片</label>
                                        {editingBanner.image_url && (
                                            <img src={editingBanner.image_url} alt="" className="w-full h-36 object-cover rounded-xl mb-3 border border-black/10" />
                                        )}
                                        <div className="flex gap-2">
                                            <input ref={bannerFileRef} type="file" accept="image/*" className="hidden"
                                                   onChange={e => e.target.files?.[0] && uploadBannerImage(e.target.files[0])} />
                                            <button
                                                onClick={() => bannerFileRef.current?.click()}
                                                disabled={bannerUploading}
                                                className="flex items-center gap-1.5 bg-off-white border border-black/10 hover:border-orange text-navy text-sm px-4 py-2 rounded-lg transition-colors"
                                            >
                                                <Upload size={13} />
                                                {bannerUploading ? '上传中...' : '上传图片'}
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="或粘贴图片 URL"
                                            value={editingBanner.image_url || ''}
                                            onChange={e => setEditingBanner((b: any) => ({ ...b, image_url: e.target.value }))}
                                            className="mt-2 w-full text-[12px] border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-orange"
                                        />
                                    </div>
                                    {/* Label */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">标签文字（小标题）</label>
                                        <input
                                            type="text"
                                            value={editingBanner.label || ''}
                                            onChange={e => setEditingBanner((b: any) => ({ ...b, label: e.target.value }))}
                                            className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange"
                                            placeholder="e.g. Summer Special"
                                        />
                                    </div>
                                    {/* Title */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">主标题（支持换行 \n）</label>
                                        <textarea
                                            value={editingBanner.title || ''}
                                            onChange={e => setEditingBanner((b: any) => ({ ...b, title: e.target.value }))}
                                            rows={3}
                                            className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange resize-none"
                                            placeholder={"e.g. Explore New Zealand\nYour Way"}
                                        />
                                    </div>
                                    {/* Active */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setEditingBanner((b: any) => ({ ...b, active: !b.active }))}
                                            className={`w-10 h-6 rounded-full transition-colors relative ${editingBanner.active ? 'bg-orange' : 'bg-black/20'}`}
                                        >
                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editingBanner.active ? 'left-5' : 'left-1'}`} />
                                        </button>
                                        <span className="text-sm text-navy font-medium">{editingBanner.active ? '显示' : '隐藏'}</span>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3">
                                    <button onClick={() => setEditingBanner(null)} className="px-5 py-2.5 text-sm text-muted hover:text-navy border border-black/10 rounded-lg transition-colors">
                                        取消
                                    </button>
                                    <button
                                        onClick={() => saveBanner(editingBanner)}
                                        className="flex items-center gap-1.5 px-5 py-2.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm rounded-lg transition-colors"
                                    >
                                        <Check size={14} /> 保存
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Deals tab ── */}
            {activeTab === 'deals' && (
                <div className="px-8 py-6 space-y-4">
                    <div className="text-[12px] text-muted bg-navy/5 border border-black/10 rounded-xl px-4 py-3">
                        管理主页 Hot Deals 活动卡片。每个活动对应一个独立文章页面（/deals/[slug]）。Slug 用于 URL，请使用英文字母和连字符，如 <code className="bg-black/5 px-1 rounded">easter-2025</code>。
                    </div>

                    {dealsLoading ? (
                        <div className="py-12 text-center text-muted text-sm">加载中...</div>
                    ) : deals.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-black/10 py-16 text-center text-muted text-sm">
                            暂无活动，点击右上角「新增活动」开始添加
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {deals.map((deal: any, idx: number) => (
                                <div key={deal.id} className={`bg-white rounded-2xl border overflow-hidden flex ${deal.active ? 'border-black/10' : 'border-black/10 opacity-60'}`}>
                                    <div className="w-40 h-28 flex-shrink-0 bg-off-white overflow-hidden">
                                        {deal.image_url ? (
                                            <img src={deal.image_url} alt={deal.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted/30"><Image size={24} /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 px-5 py-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-orange/10 text-orange font-bold text-[12px] px-2.5 py-0.5 rounded-full">{deal.value}{deal.unit}</span>
                                            <span className="text-[11px] text-muted">/{deal.slug}</span>
                                        </div>
                                        <div className="font-syne font-bold text-navy text-[15px]">{deal.title}</div>
                                        <div className="text-muted text-[12px] mt-0.5 truncate">{deal.description}</div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center gap-1 px-4 border-l border-black/10">
                                        <button onClick={() => moveDeal(deal.id, 'up')} disabled={idx === 0} className="p-1.5 text-muted hover:text-navy disabled:opacity-30 transition-colors"><ChevronUp size={16} /></button>
                                        <button onClick={() => moveDeal(deal.id, 'down')} disabled={idx === deals.length - 1} className="p-1.5 text-muted hover:text-navy disabled:opacity-30 transition-colors"><ChevronDown size={16} /></button>
                                    </div>
                                    <div className="flex flex-col items-center justify-center gap-2 px-4 border-l border-black/10">
                                        <button onClick={() => toggleDealActive(deal.id, !deal.active)} className={`w-10 h-6 rounded-full transition-colors relative ${deal.active ? 'bg-orange' : 'bg-black/20'}`}>
                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${deal.active ? 'left-5' : 'left-1'}`} />
                                        </button>
                                        <button onClick={() => setEditingDeal({ ...deal })} className="p-1.5 text-muted hover:text-navy hover:bg-black/5 rounded-lg transition-colors"><Pencil size={14} /></button>
                                        <button onClick={() => deleteDeal(deal.id)} className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Deal edit modal */}
                    {editingDeal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
                                    <h2 className="font-syne font-bold text-navy text-lg">{editingDeal.id ? '编辑活动' : '新增活动'}</h2>
                                    <button onClick={() => setEditingDeal(null)} className="text-muted hover:text-navy"><X size={20} /></button>
                                </div>
                                <div className="px-6 py-5 space-y-4">
                                    {/* Image */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">活动图片</label>
                                        {editingDeal.image_url && <img src={editingDeal.image_url} alt="" className="w-full h-36 object-cover rounded-xl mb-3 border border-black/10" />}
                                        <div className="flex gap-2">
                                            <input ref={dealFileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadDealImage(e.target.files[0])} />
                                            <button onClick={() => dealFileRef.current?.click()} disabled={dealImgUploading} className="flex items-center gap-1.5 bg-off-white border border-black/10 hover:border-orange text-navy text-sm px-4 py-2 rounded-lg transition-colors">
                                                <Upload size={13} />{dealImgUploading ? '上传中...' : '上传图片'}
                                            </button>
                                        </div>
                                        <input type="text" placeholder="或粘贴图片 URL" value={editingDeal.image_url || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, image_url: e.target.value }))} className="mt-2 w-full text-[12px] border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-orange" />
                                    </div>
                                    {/* Slug */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">URL Slug（英文，用于页面地址）</label>
                                        <input type="text" value={editingDeal.slug || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange font-mono" placeholder="e.g. easter-2025" />
                                    </div>
                                    {/* Title + Description */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">标题</label>
                                            <input type="text" value={editingDeal.title || ''} onChange={e => {
                                                const title = e.target.value
                                                const autoSlug = title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
                                                setEditingDeal((d: any) => ({ ...d, title, slug: d.slug?.trim() ? d.slug : autoSlug }))
                                            }} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange" placeholder="Easter Sale" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">副标题</label>
                                            <input type="text" value={editingDeal.description || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, description: e.target.value }))} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange" placeholder="Fuel subsidy on every rental" />
                                        </div>
                                    </div>
                                    {/* Value + Unit + Badge */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">折扣值</label>
                                            <input type="text" value={editingDeal.value || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, value: e.target.value }))} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange" placeholder="10%" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">单位（可选）</label>
                                            <input type="text" value={editingDeal.unit || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, unit: e.target.value }))} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange" placeholder="/day" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">标签文字</label>
                                            <input type="text" value={editingDeal.badge || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, badge: e.target.value }))} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange" placeholder="Get Offer" />
                                        </div>
                                    </div>
                                    {/* Article content */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">活动详情（文章正文，换行分段）</label>
                                        <textarea value={editingDeal.content || ''} onChange={e => setEditingDeal((d: any) => ({ ...d, content: e.target.value }))} rows={5} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange resize-none" placeholder="填写活动详情、条款等内容..." />
                                    </div>
                                    {/* Active */}
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setEditingDeal((d: any) => ({ ...d, active: !d.active }))} className={`w-10 h-6 rounded-full transition-colors relative ${editingDeal.active ? 'bg-orange' : 'bg-black/20'}`}>
                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editingDeal.active ? 'left-5' : 'left-1'}`} />
                                        </button>
                                        <span className="text-sm text-navy font-medium">{editingDeal.active ? '显示' : '隐藏'}</span>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3">
                                    <button onClick={() => setEditingDeal(null)} className="px-5 py-2.5 text-sm text-muted hover:text-navy border border-black/10 rounded-lg transition-colors">取消</button>
                                    <button onClick={() => saveDeal(editingDeal)} className="flex items-center gap-1.5 px-5 py-2.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm rounded-lg transition-colors">
                                        <Check size={14} /> 保存
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'gallery' && (
                <div className="px-8 py-6 space-y-4">
                    <div className="text-[12px] text-muted bg-navy/5 border border-black/10 rounded-xl px-4 py-3">
                        管理主页 Gallery 展示的真实车辆照片。上传后首页 <code className="bg-black/5 px-1 rounded">Gallery</code> 区块会自动显示，支持删除，不需要手动填写链接。
                    </div>

                    {galleryLoading ? (
                        <div className="py-12 text-center text-muted text-sm">加载中...</div>
                    ) : galleryImages.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-black/10 py-16 text-center text-muted text-sm">
                            暂无图库图片，点击右上角「上传 Gallery 图片」开始添加
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {galleryImages.map((image) => (
                                <div key={image.path} className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                                    <div className="aspect-[4/3] bg-off-white">
                                        <img src={image.url} alt={image.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-4">
                                        <div className="font-semibold text-navy text-[13px] truncate">{image.name}</div>
                                        <div className="text-[11px] text-muted mt-1">
                                            {image.created_at ? new Date(image.created_at).toLocaleString('zh-CN') : '已上传'}
                                        </div>
                                        <div className="mt-4 flex items-center gap-2">
                                            <a
                                                href={image.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 text-center text-[12px] font-medium text-navy border border-black/10 hover:border-orange rounded-lg px-3 py-2 transition-colors"
                                            >
                                                查看原图
                                            </a>
                                            <button
                                                onClick={() => deleteGalleryImage(image.path)}
                                                className="flex items-center gap-1.5 text-[12px] font-medium text-red-500 border border-red-100 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
                                            >
                                                <Trash2 size={13} /> 删除
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Blog tab ── */}
            {activeTab === 'blog' && (
                <div className="px-8 py-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-[12px] text-muted bg-navy/5 border border-black/10 rounded-xl px-4 py-3 flex-1 mr-4">
                            管理前台 Blog 页面的文章内容。发布后前台 <code className="bg-black/5 px-1 rounded">/blog</code> 页面自动更新，支持封面图上传、分类、精选设置。
                        </div>
                        <button
                            onClick={() => setEditingBlog({ title: '', slug: '', excerpt: '', category: 'Travel Guide', date: new Date().toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' }), read_time: '5 min read', image_url: '', content: '', featured: false, active: true })}
                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                        >
                            <Plus size={14} /> 新增文章
                        </button>
                    </div>

                    {/* Hidden file input */}
                    <input ref={blogFileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBlogImage(e.target.files[0])} />

                    {blogLoading ? (
                        <div className="py-12 text-center text-muted text-sm">加载中...</div>
                    ) : blogPosts.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-black/10 py-16 text-center text-muted text-sm">
                            暂无文章，点击右上角「新增文章」开始创作
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {blogPosts.map(post => (
                                <div key={post.id} className="bg-white border border-black/10 rounded-2xl p-4 flex items-center gap-4">
                                    <div className="w-20 h-14 rounded-xl overflow-hidden bg-off-white flex-shrink-0">
                                        {post.image_url
                                            ? <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-muted/40 text-xs">No img</div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-syne font-bold text-navy text-[14px] truncate">{post.title}</span>
                                            {post.featured && <span className="text-[10px] font-bold bg-orange text-white px-2 py-0.5 rounded-full">精选</span>}
                                            {!post.active && <span className="text-[10px] font-bold bg-black/10 text-muted px-2 py-0.5 rounded-full">隐藏</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-[12px] text-muted">
                                            <span className="bg-black/5 px-2 py-0.5 rounded-full">{post.category}</span>
                                            <span>{post.date}</span>
                                            <span>{post.read_time}</span>
                                            <span className="text-orange font-mono text-[11px]">/blog/{post.slug}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => { saveBlogPost({ ...post, active: !post.active }) }}
                                            className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${post.active ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-black/10 text-muted hover:border-navy'}`}
                                        >
                                            {post.active ? '已发布' : '已隐藏'}
                                        </button>
                                        <button onClick={() => setEditingBlog({ ...post })} className="p-2 text-muted hover:text-navy border border-black/10 rounded-lg transition-colors">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => deleteBlogPost(post.id)} className="p-2 text-red-400 hover:text-red-600 border border-red-100 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Blog edit modal */}
            {editingBlog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 sticky top-0 bg-white z-10">
                            <h2 className="font-syne font-bold text-navy text-lg">{editingBlog.id ? '编辑文章' : '新增文章'}</h2>
                            <button onClick={() => setEditingBlog(null)} className="text-muted hover:text-navy"><X size={20} /></button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {/* Cover image */}
                            <div>
                                <label className="block text-[12px] font-semibold text-navy mb-1.5">封面图片</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="图片 URL"
                                        value={editingBlog.image_url || ''}
                                        onChange={e => setEditingBlog((p: any) => ({ ...p, image_url: e.target.value }))}
                                        className="flex-1 border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange"
                                    />
                                    <button
                                        onClick={() => blogFileRef.current?.click()}
                                        disabled={blogImgUploading}
                                        className="flex items-center gap-1.5 px-4 py-2.5 border border-black/15 rounded-xl text-[12px] text-muted hover:border-orange hover:text-orange transition-colors whitespace-nowrap"
                                    >
                                        <Upload size={13} /> {blogImgUploading ? '上传中...' : '上传图片'}
                                    </button>
                                </div>
                                {editingBlog.image_url && (
                                    <img src={editingBlog.image_url} alt="preview" className="mt-2 h-32 w-full object-cover rounded-xl" />
                                )}
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-[12px] font-semibold text-navy mb-1.5">标题</label>
                                <input
                                    type="text"
                                    placeholder="文章标题"
                                    value={editingBlog.title || ''}
                                    onChange={e => {
                                        const title = e.target.value
                                        const autoSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                                        setEditingBlog((p: any) => ({ ...p, title, ...(!p.id ? { slug: autoSlug } : {}) }))
                                    }}
                                    className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange"
                                />
                            </div>

                            {/* Slug */}
                            <div>
                                <label className="block text-[12px] font-semibold text-navy mb-1.5">URL Slug</label>
                                <input
                                    type="text"
                                    placeholder="url-slug"
                                    value={editingBlog.slug || ''}
                                    onChange={e => setEditingBlog((p: any) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                                    className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-orange"
                                />
                                <p className="text-[11px] text-muted mt-1">前台访问地址：/blog/{editingBlog.slug || '...'}</p>
                            </div>

                            {/* Excerpt */}
                            <div>
                                <label className="block text-[12px] font-semibold text-navy mb-1.5">摘要</label>
                                <textarea
                                    rows={2}
                                    placeholder="简短描述，显示在卡片列表"
                                    value={editingBlog.excerpt || ''}
                                    onChange={e => setEditingBlog((p: any) => ({ ...p, excerpt: e.target.value }))}
                                    className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange resize-none"
                                />
                            </div>

                            {/* Category + Date + Read time */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[12px] font-semibold text-navy mb-1.5">分类</label>
                                    <select
                                        value={editingBlog.category || 'Travel Guide'}
                                        onChange={e => setEditingBlog((p: any) => ({ ...p, category: e.target.value }))}
                                        className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange"
                                    >
                                        <option>Travel Guide</option>
                                        <option>Driving Tips</option>
                                        <option>Car Tips</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-navy mb-1.5">发布日期</label>
                                    <input
                                        type="text"
                                        placeholder="April 15, 2026"
                                        value={editingBlog.date || ''}
                                        onChange={e => setEditingBlog((p: any) => ({ ...p, date: e.target.value }))}
                                        className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-navy mb-1.5">阅读时间</label>
                                    <input
                                        type="text"
                                        placeholder="5 min read"
                                        value={editingBlog.read_time || ''}
                                        onChange={e => setEditingBlog((p: any) => ({ ...p, read_time: e.target.value }))}
                                        className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-[12px] font-semibold text-navy mb-1.5">正文内容 <span className="font-normal text-muted">(支持 HTML)</span></label>
                                <textarea
                                    rows={12}
                                    placeholder="<p>文章正文，支持 HTML 标签...</p>"
                                    value={editingBlog.content || ''}
                                    onChange={e => setEditingBlog((p: any) => ({ ...p, content: e.target.value }))}
                                    className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-orange resize-y"
                                />
                            </div>

                            {/* Featured + Active toggles */}
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setEditingBlog((p: any) => ({ ...p, featured: !p.featured }))}
                                        className={`w-10 h-6 rounded-full transition-colors relative ${editingBlog.featured ? 'bg-orange' : 'bg-black/20'}`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editingBlog.featured ? 'left-5' : 'left-1'}`} />
                                    </button>
                                    <span className="text-sm text-navy font-medium">精选文章</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setEditingBlog((p: any) => ({ ...p, active: !p.active }))}
                                        className={`w-10 h-6 rounded-full transition-colors relative ${editingBlog.active ? 'bg-orange' : 'bg-black/20'}`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editingBlog.active ? 'left-5' : 'left-1'}`} />
                                    </button>
                                    <span className="text-sm text-navy font-medium">{editingBlog.active ? '已发布' : '草稿'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3 sticky bottom-0 bg-white">
                            <button onClick={() => setEditingBlog(null)} className="px-5 py-2.5 text-sm text-muted hover:text-navy border border-black/10 rounded-lg transition-colors">取消</button>
                            <button
                                onClick={() => saveBlogPost(editingBlog)}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm rounded-lg transition-colors"
                            >
                                <Check size={14} /> 保存发布
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
