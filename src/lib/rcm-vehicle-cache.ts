import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    return createClient(url, key)
}

function normalizeVehicle(vehicle: any) {
    const imageurl = vehicle.imageurl || vehicle.image_url || ''
    return {
        ...vehicle,
        imageurl: imageurl.startsWith('//') ? `https:${imageurl}` : imageurl,
    }
}

async function cacheVehicleImage(supabase: any, vehicle: any) {
    const remoteUrl = vehicle.imageurl || vehicle.image_url || ''
    if (!remoteUrl || remoteUrl.startsWith('/') || remoteUrl.includes('supabase.co/storage')) return remoteUrl

    try {
        const response = await fetch(remoteUrl)
        if (!response.ok) return remoteUrl
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
        const path = `rcm-cache/${Number(vehicle.vehiclecategoryid)}.${extension}`
        const buffer = await response.arrayBuffer()
        const { error } = await supabase.storage
            .from('vehicle-images')
            .upload(path, buffer, { contentType, upsert: true, cacheControl: '86400' })
        if (error) return remoteUrl
        return supabase.storage.from('vehicle-images').getPublicUrl(path).data.publicUrl
    } catch {
        return remoteUrl
    }
}

export async function getCachedRcmVehicles() {
    const supabase = getSupabase()
    if (!supabase) return { vehicles: [], syncedAt: null }

    const { data, error } = await supabase
        .from('rcm_vehicle_cache')
        .select('vehiclecategoryid, vehicle_json, synced_at')
        .eq('active', true)
        .order('vehiclecategoryid')

    if (error) {
        console.warn('[rcm vehicle cache] read failed:', error.message)
        return { vehicles: [], syncedAt: null }
    }

    return {
        vehicles: (data ?? []).map(row => normalizeVehicle({
            ...row.vehicle_json,
            vehiclecategoryid: row.vehiclecategoryid,
        })),
        syncedAt: data?.reduce<string | null>((latest, row) => (!latest || row.synced_at > latest ? row.synced_at : latest), null) ?? null,
    }
}

export async function saveRcmVehicles(vehicles: any[], options: { cacheImages?: boolean } = {}) {
    const supabase = getSupabase()
    if (!supabase || vehicles.length === 0) return false

    const syncedAt = new Date().toISOString()
    const rows = await Promise.all(vehicles
        .filter(vehicle => Number(vehicle.vehiclecategoryid))
        .map(async vehicle => ({
            vehiclecategoryid: Number(vehicle.vehiclecategoryid),
            vehicle_json: normalizeVehicle({
                ...vehicle,
                imageurl: options.cacheImages ? await cacheVehicleImage(supabase, vehicle) : vehicle.imageurl,
            }),
            active: true,
            synced_at: syncedAt,
            updated_at: syncedAt,
        })))

    const { error } = await supabase
        .from('rcm_vehicle_cache')
        .upsert(rows, { onConflict: 'vehiclecategoryid' })

    if (error) {
        console.warn('[rcm vehicle cache] write failed:', error.message)
        return false
    }
    return true
}

export async function mergeRcmVehiclesWithCache(vehicles: any[]) {
    const cached = await getCachedRcmVehicles()
    if (cached.vehicles.length === 0) return vehicles

    const byId = new Map(cached.vehicles.map(vehicle => [Number(vehicle.vehiclecategoryid), vehicle]))
    return vehicles.map(vehicle => {
        const local = byId.get(Number(vehicle.vehiclecategoryid))
        if (!local) return vehicle
        return {
            ...local,
            ...vehicle,
            avgrate: vehicle.avgrate ?? local.avgrate,
            totalrate: vehicle.totalrate ?? local.totalrate,
            totalrateafterdiscount: vehicle.totalrateafterdiscount ?? local.totalrateafterdiscount,
            imageurl: local.imageurl || vehicle.imageurl,
            categoryfriendlydescription: vehicle.categoryfriendlydescription || local.categoryfriendlydescription,
            vehiclecategory: vehicle.vehiclecategory || local.vehiclecategory,
            numberofadults: vehicle.numberofadults || local.numberofadults,
            numberoflargecases: vehicle.numberoflargecases ?? local.numberoflargecases,
            numberofsmallcases: vehicle.numberofsmallcases ?? local.numberofsmallcases,
        }
    })
}

export async function getCachedRcmSearch(cacheKey: string, maxAgeMs: number) {
    const supabase = getSupabase()
    if (!supabase) return null

    const { data, error } = await supabase
        .from('rcm_search_cache')
        .select('search_json, fetched_at')
        .eq('cache_key', cacheKey)
        .maybeSingle()

    if (error || !data) return null
    const fetchedAt = new Date(data.fetched_at).getTime()
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > maxAgeMs) return null
    return data.search_json
}

export async function getStaleRcmSearch(cacheKey: string) {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data } = await supabase
        .from('rcm_search_cache')
        .select('search_json')
        .eq('cache_key', cacheKey)
        .maybeSingle()
    return data?.search_json ?? null
}

export async function saveRcmSearch(cacheKey: string, search: any) {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase
        .from('rcm_search_cache')
        .upsert({ cache_key: cacheKey, search_json: search, fetched_at: new Date().toISOString() }, { onConflict: 'cache_key' })
}
