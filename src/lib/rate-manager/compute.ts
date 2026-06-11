// Net-revenue / margin maths for the Rate Manager.
//
// Core principle (same for every channel): the customer-facing price equals the
// master retail price. Commission is an internal deduction only — it never
// changes the exported / displayed price.
//
//   customerPrice    = masterRetailPrice
//   commissionAmount = masterRetailPrice * commissionRate
//   netRevenue       = masterRetailPrice * (1 - commissionRate)

import type {
    ComputedRate, ComputedTier, MasterRate, OtaChannel, RateStatus, Tier, VehicleCategory,
} from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeTier(
    retailPrice: number | null,
    commissionRate: number,
    minimumNetRevenuePerDay: number | null,
    tier: Tier,
): ComputedTier {
    if (retailPrice == null || Number.isNaN(retailPrice)) {
        return { tier, customerPrice: null, commissionAmount: null, netRevenue: null, belowMinimum: false }
    }
    const commissionAmount = round2(retailPrice * commissionRate)
    const netRevenue = round2(retailPrice - commissionAmount)
    const belowMinimum = minimumNetRevenuePerDay != null && netRevenue < minimumNetRevenuePerDay
    return { tier, customerPrice: round2(retailPrice), commissionAmount, netRevenue, belowMinimum }
}

export function computeRate(
    category: Pick<VehicleCategory, 'id' | 'minimum_net_revenue_per_day'>,
    channel: Pick<OtaChannel, 'id' | 'commission_rate'>,
    rate: MasterRate | null,
): ComputedRate {
    const min = category.minimum_net_revenue_per_day
    const cr = channel.commission_rate
    const tiers = {
        '1_3': computeTier(rate?.price_1_3 ?? null, cr, min, '1_3'),
        '4_6': computeTier(rate?.price_4_6 ?? null, cr, min, '4_6'),
        '7_plus': computeTier(rate?.price_7_plus ?? null, cr, min, '7_plus'),
    } as Record<Tier, ComputedTier>

    const hasAnyPrice = Object.values(tiers).some(t => t.customerPrice != null)
    const anyBelow = Object.values(tiers).some(t => t.belowMinimum)
    const status: RateStatus = !hasAnyPrice ? 'NO_PRICE' : anyBelow ? 'WARNING' : 'OK'

    return {
        categoryId: category.id,
        channelId: channel.id,
        seasonId: rate?.season_id ?? '',
        commissionRate: cr,
        minimumNetRevenuePerDay: min,
        tiers,
        status,
    }
}
