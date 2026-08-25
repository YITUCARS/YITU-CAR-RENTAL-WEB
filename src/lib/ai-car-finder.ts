export type AiFinderLocation = 'Christchurch' | 'Queenstown'
export type AiFinderDriverAge = 'over26' | 'under26'

export interface AiFinderSearch {
  pickupLocation: AiFinderLocation
  dropoffLocation: AiFinderLocation
  pickupDate: string
  pickupTime: string
  dropoffDate: string
  dropoffTime: string
  driverAge: AiFinderDriverAge
  passengers: number
  children: number
  largeBags: number
  smallBags: number
  vehiclePreference: 'any' | 'compact' | 'sedan' | 'suv' | 'mpv' | 'van' | 'premium'
  budgetLevel: 'any' | 'budget' | 'mid' | 'premium'
  promoCode: string
  notes: string
  responseLanguage: string
}

export interface AiFinderVehicle {
  vehiclecategoryid: number
  vehiclecategorytypeid: number
  vehiclecategory: string
  categoryfriendlydescription: string
  avgrate: number
  totalrateafterdiscount: number
  totaldiscountamount: number
  numberofdays: number
  numberofadults: number
  numberoflargecases: number
  numberofsmallcases: number
  imageurl: string
  available: number
  availablemessage: string
  aiReason?: string
}

export function nzTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function defaultAiFinderSearch(): AiFinderSearch {
  const today = nzTodayYmd()
  const pickupDate = addDaysYmd(today, 2)
  return {
    pickupLocation: 'Christchurch',
    dropoffLocation: 'Christchurch',
    pickupDate,
    pickupTime: '10:00',
    dropoffDate: addDaysYmd(pickupDate, 7),
    dropoffTime: '10:00',
    driverAge: 'over26',
    passengers: 2,
    children: 0,
    largeBags: 1,
    smallBags: 1,
    vehiclePreference: 'any',
    budgetLevel: 'any',
    promoCode: '',
    notes: '',
    responseLanguage: 'English',
  }
}

export function normalizeFinderSearch(input: Partial<AiFinderSearch>): AiFinderSearch {
  const fallback = defaultAiFinderSearch()
  const pickupLocation = input.pickupLocation === 'Queenstown' ? 'Queenstown' : 'Christchurch'
  const requestedDropoff = input.dropoffLocation === 'Queenstown' ? 'Queenstown' : 'Christchurch'
  const dropoffLocation = pickupLocation === 'Christchurch'
    ? requestedDropoff
    : requestedDropoff === 'Christchurch' ? 'Christchurch' : 'Queenstown'
  const pickupDate = isYmd(input.pickupDate) ? input.pickupDate! : fallback.pickupDate
  let dropoffDate = isYmd(input.dropoffDate) ? input.dropoffDate! : addDaysYmd(pickupDate, 7)
  if (dropoffDate < pickupDate) dropoffDate = addDaysYmd(pickupDate, 7)

  return {
    pickupLocation,
    dropoffLocation,
    pickupDate,
    pickupTime: normalizeTime(input.pickupTime) || fallback.pickupTime,
    dropoffDate,
    dropoffTime: normalizeTime(input.dropoffTime) || fallback.dropoffTime,
    driverAge: input.driverAge === 'under26' ? 'under26' : 'over26',
    passengers: clampInt(input.passengers, 1, 12, fallback.passengers),
    children: clampInt(input.children, 0, 8, fallback.children),
    largeBags: clampInt(input.largeBags, 0, 8, fallback.largeBags),
    smallBags: clampInt(input.smallBags, 0, 8, fallback.smallBags),
    vehiclePreference: normalizePreference(input.vehiclePreference),
    budgetLevel: normalizeBudget(input.budgetLevel),
    promoCode: String(input.promoCode || '').trim().toUpperCase().slice(0, 24),
    notes: String(input.notes || '').trim().slice(0, 240),
    responseLanguage: normalizeResponseLanguage(input.responseLanguage),
  }
}

export function heuristicFinderSearch(message: string): AiFinderSearch {
  const text = message.toLowerCase()
  const fallback = defaultAiFinderSearch()
  const passengers = firstNumberBefore(text, ['people', 'person', 'passengers', 'adults', '人', '位']) || fallback.passengers
  const children = firstNumberBefore(text, ['child', 'children', 'kid', 'kids', '儿童', '小孩']) || (/(child|kid|儿童|小孩)/i.test(message) ? 1 : 0)
  const largeBags = firstNumberBefore(text, ['large bag', 'large luggage', 'big suitcase', '大箱', '大行李']) || fallback.largeBags
  const smallBags = firstNumberBefore(text, ['small bag', 'small luggage', 'carry on', '小箱', '小行李']) || fallback.smallBags
  const pickupLocation = /queenstown|皇后镇/i.test(message) && !/christchurch|基督城/i.test(message) ? 'Queenstown' : 'Christchurch'
  const dropoffLocation = /to queenstown|drop.*queenstown|还.*皇后镇|到皇后镇/i.test(message)
    ? 'Queenstown'
    : /to christchurch|drop.*christchurch|还.*基督城|到基督城/i.test(message)
      ? 'Christchurch'
      : pickupLocation

  return normalizeFinderSearch({
    ...fallback,
    pickupLocation,
    dropoffLocation,
    driverAge: /(under\s*26|under\s*25|25|24|23|22|21|young|年轻|26岁以下)/i.test(message) ? 'under26' : 'over26',
    passengers,
    children,
    largeBags,
    smallBags,
    vehiclePreference: /van|hiace|12|people mover|mpv|vellfire|alphard|商务|保姆|多人/i.test(message)
      ? 'mpv'
      : /suv|awd|4wd|snow|mountain|山|雪/i.test(message)
        ? 'suv'
        : /cheap|budget|省钱|便宜/i.test(message)
          ? 'compact'
          : 'any',
    budgetLevel: /premium|luxury|高端|豪华/i.test(message) ? 'premium' : /cheap|budget|省钱|便宜/i.test(message) ? 'budget' : 'any',
  })
}

export function scoreVehicle(vehicle: AiFinderVehicle, search: AiFinderSearch) {
  const seats = Number(vehicle.numberofadults || 0)
  const large = Number(vehicle.numberoflargecases || 0)
  const small = Number(vehicle.numberofsmallcases || 0)
  const name = `${vehicle.vehiclecategory || ''} ${vehicle.categoryfriendlydescription || ''}`.toLowerCase()
  const available = (vehicle.availablemessage || '').toLowerCase() === 'available' || vehicle.available === 1
  let score = available ? 100 : 0

  if (seats >= search.passengers + search.children) score += 28
  else score -= 45
  if (large >= search.largeBags) score += 16
  else score -= 20
  if (small >= search.smallBags) score += 8
  if (matchesPreference(name, search.vehiclePreference)) score += 22
  if (search.children > 0 && seats >= search.passengers + search.children) score += 8
  if (search.budgetLevel === 'budget') score -= Number(vehicle.avgrate || 0) / 8
  if (search.budgetLevel === 'premium' && /range|alphard|vellfire|premium|tesla|mercedes|bmw|audi/.test(name)) score += 16

  return score
}

export function buildFinderQuery(search: AiFinderSearch) {
  const query = new URLSearchParams({
    pickupLocation: search.pickupLocation,
    dropoffLocation: search.dropoffLocation,
    pickupDate: search.pickupDate,
    pickupTime: search.pickupTime,
    dropoffDate: search.dropoffDate,
    dropoffTime: search.dropoffTime,
    driverAge: search.driverAge,
  })
  if (search.promoCode) query.set('promoCode', search.promoCode)
  return query.toString()
}

export function deterministicReason(vehicle: AiFinderVehicle, search: AiFinderSearch) {
  const seats = Number(vehicle.numberofadults || 0)
  const large = Number(vehicle.numberoflargecases || 0)
  const small = Number(vehicle.numberofsmallcases || 0)
  const parts = [
    seats >= search.passengers + search.children
      ? `fits ${search.passengers + search.children} travellers`
      : `closest seat match for ${search.passengers + search.children} travellers`,
    large >= search.largeBags ? `handles ${search.largeBags} large bags` : `${large} large-bag capacity`,
    small >= search.smallBags ? `${small} small-bag space` : '',
  ].filter(Boolean)
  if (isChineseLanguage(search.responseLanguage)) {
    const zhParts = [
      seats >= search.passengers + search.children
        ? `座位可满足 ${search.passengers + search.children} 位乘客`
        : `座位是最接近 ${search.passengers + search.children} 位乘客需求的选择`,
      large >= search.largeBags ? `可放 ${search.largeBags} 个大箱` : `大箱容量为 ${large} 个`,
      small >= search.smallBags ? `还能放 ${small} 个小箱` : '',
    ].filter(Boolean)
    return `推荐这台车，因为它${zhParts.join('，')}，并且在你选择的行程日期真实可订。`
  }
  return `Recommended because it ${parts.join(', ')} and is available for your selected trip.`
}

function isYmd(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function normalizeTime(value?: string) {
  if (!value) return ''
  const match = String(value).match(/^(\d{1,2}):?(\d{2})?/)
  if (!match) return ''
  const hour = Math.min(23, Math.max(0, Number(match[1])))
  const minute = match[2] ? Math.min(59, Math.max(0, Number(match[2]))) : 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function normalizePreference(value: unknown): AiFinderSearch['vehiclePreference'] {
  const allowed = ['any', 'compact', 'sedan', 'suv', 'mpv', 'van', 'premium']
  return allowed.includes(String(value)) ? String(value) as AiFinderSearch['vehiclePreference'] : 'any'
}

function normalizeBudget(value: unknown): AiFinderSearch['budgetLevel'] {
  const allowed = ['any', 'budget', 'mid', 'premium']
  return allowed.includes(String(value)) ? String(value) as AiFinderSearch['budgetLevel'] : 'any'
}

function normalizeResponseLanguage(value: unknown) {
  const language = String(value || '').trim()
  return language ? language.slice(0, 40) : 'English'
}

export function isChineseLanguage(language: string) {
  return /^(zh|zh-|zh_)|chinese|mandarin|cantonese|中文|汉语|漢語/i.test(language)
}

function matchesPreference(name: string, preference: AiFinderSearch['vehiclePreference']) {
  if (preference === 'any') return true
  if (preference === 'compact') return /compact|corolla|aqua|swift|fit|mini|small|hatch/.test(name)
  if (preference === 'sedan') return /sedan|corolla|camry|accord/.test(name)
  if (preference === 'suv') return /suv|rav|crv|forester|outlander|xtrail|tank|range/.test(name)
  if (preference === 'mpv') return /mpv|vellfire|alphard|staria|people mover|7|8/.test(name)
  if (preference === 'van') return /van|hiace|sprinter|12/.test(name)
  if (preference === 'premium') return /premium|range|tesla|alphard|vellfire|mercedes|bmw|audi/.test(name)
  return false
}

function firstNumberBefore(text: string, words: string[]) {
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = text.match(new RegExp(`(\\d{1,2})\\s*(?:${escaped})`, 'i'))
    if (match) return Number(match[1])
  }
  return 0
}
