import { createClient } from '@supabase/supabase-js'
import type { VehicleRecord, VehicleRepository } from './repository'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const vehicleRepo: VehicleRepository = {
    async getAll() {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getActive() {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(id) {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', id)
            .single()
        if (error) throw error
        return data
    },

    async create(data) {
        const { data: created, error } = await supabase
            .from('vehicles')
            .insert(data)
            .select()
            .single()
        if (error) throw error
        return created
    },

    async update(id, data) {
        const { data: updated, error } = await supabase
            .from('vehicles')
            .update(data)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return updated
    },

    async delete(id) {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    async uploadImage(file) {
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