// Shared types for the Rate Manager (价格管理) module.
// Pricing is tiered by rental length to match the OTA upload template and the
// RCM export (1-3 / 4-6 / 7+ days).

export type Tier = '1_3' | '4_6' | '7_plus'

export const TIERS: { key: Tier; label: string; minDays: number; maxDays: number | null }[] = [
    { key: '1_3', label: '1-3 Days', minDays: 1, maxDays: 3 },
    { key: '4_6', label: '4-6 Days', minDays: 4, maxDays: 6 },
    { key: '7_plus', label: '7+ Days', minDays: 7, maxDays: null },
]

export interface RateStore {
    id: string
    ota_store_id: string
    name: string
    active: boolean
    created_at: string
}

export interface VehicleCategory {
    id: string
    name: string
    rcm_category_code: string | null
    rcm_export_name: string | null
    ota_group_id: string | null
    ota_group_name: string | null
    ota_codes: Record<string, string>
    minimum_net_revenue_per_day: number | null
    currency: string
    active: boolean
    created_at: string
    /** populated by the categories API: ota_store_ids this category is sold at */
    store_ids?: string[]
}

export interface Season {
    id: string
    name: string
    date_from: string
    date_to: string
    created_at: string
}

export interface MasterRate {
    id: string
    category_id: string
    season_id: string
    price_1_3: number | null
    price_4_6: number | null
    price_7_plus: number | null
    currency: string
    created_at: string
    updated_at: string
}

export interface OtaChannel {
    id: string
    name: string
    commission_rate: number
    pricing_policy: string
    excel_template_type: string
    active: boolean
    created_at: string
}

export interface ExportLog {
    id: string
    channel_id: string | null
    channel_name: string | null
    store_id: string | null
    store_name: string | null
    season_id: string | null
    date_from: string | null
    date_to: string | null
    category_ids: string[]
    row_count: number
    generated_by: string | null
    file_name: string | null
    generated_at: string
}

export type RateStatus = 'OK' | 'WARNING' | 'NO_PRICE'

// One tier's net-revenue maths for a given channel.
export interface ComputedTier {
    tier: Tier
    customerPrice: number | null   // == master retail price (never the net)
    commissionAmount: number | null
    netRevenue: number | null
    belowMinimum: boolean
}

export interface ComputedRate {
    categoryId: string
    channelId: string
    seasonId: string
    commissionRate: number
    minimumNetRevenuePerDay: number | null
    tiers: Record<Tier, ComputedTier>
    status: RateStatus              // worst of the tiers
}
