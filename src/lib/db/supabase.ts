import { createClient } from '@supabase/supabase-js'
import type { VehicleRecord, VehicleRepository } from './repository'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase environment variables')
  return createClient(url, key)
}

export const vehicleRepo: VehicleRepository = {
    async getAll() {
        const { data, error } = await getSupabase()
            .from('vehicles')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getActive() {
        const { data, error } = await getSupabase()
            .from('vehicles')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(id) {
        const { data, error } = await getSupabase()
            .from('vehicles')
            .select('*')
            .eq('id', id)
            .single()
        if (error) throw error
        return data
    },

    async create(data) {
        const { data: created, error } = await getSupabase()
            .from('vehicles')
            .insert(data)
            .select()
            .single()
        if (error) throw error
        return created
    },

    async update(id, data) {
        const { data: updated, error } = await getSupabase()
            .from('vehicles')
            .update(data)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return updated
    },

    async delete(id) {
        const { error } = await getSupabase()
            .from('vehicles')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    async uploadImage(file) {
        const supabase = getSupabase()
        const ext = file.name.split('.').pop()
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage
            .from('vehicle-images')
            .upload(filename, file)
        if (error) throw error
        const { data } = supabase.storage
            .from('vehicle-images')
            .getPublicUrl(filename)
        return data.publicUrl
    },
}