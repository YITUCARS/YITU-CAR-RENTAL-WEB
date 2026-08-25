export const dynamic = 'force-dynamic'

import {NextRequest, NextResponse} from 'next/server'
import {LOCATION_IDS, rcmSearch, toRCMDate} from '@/lib/rcm'
import {
  AiFinderSearch,
  AiFinderVehicle,
  buildFinderQuery,
  deterministicReason,
  isChineseLanguage,
  normalizeFinderSearch,
  nzTodayYmd,
  scoreVehicle,
} from '@/lib/ai-car-finder'
import {saveAiBookingMemory} from '@/lib/ai-booking-memory'
import {resolveRcmPromoCode} from '@/lib/promo-code'
import {applyLocalPrices, calculateRentalDays} from '@/lib/local-pricing'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

type FinderRequiredField =
  | 'pickupLocation'
  | 'dropoffLocation'
  | 'pickupDate'
  | 'pickupTime'
  | 'dropoffDate'
  | 'dropoffTime'
  | 'passengers'
  | 'children'
  | 'largeBags'
  | 'driverAge'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ConversationExtraction = {
  pickupLocation: '' | 'Christchurch' | 'Queenstown'
  dropoffLocation: '' | 'Christchurch' | 'Queenstown'
  pickupDate: string
  pickupTime: string
  dropoffDate: string
  dropoffTime: string
  driverAge: '' | 'over26' | 'under26'
  passengers: number
  children: number
  largeBags: number
  smallBags: number
  vehiclePreference: 'any' | 'compact' | 'sedan' | 'suv' | 'mpv' | 'van' | 'premium'
  budgetLevel: 'any' | 'budget' | 'mid' | 'premium'
  promoCode: string
  promoCodeAsked: boolean
  notes: string
  responseLanguage: string
  knownFields: FinderRequiredField[]
  nextQuestion: string
}

const supportedFinderLanguages = ['English', 'Simplified Chinese', 'Japanese', 'Korean', 'Spanish'] as const
type SupportedFinderLanguage = typeof supportedFinderLanguages[number]

const requiredFields: FinderRequiredField[] = [
  'pickupLocation',
  'dropoffLocation',
  'pickupDate',
  'pickupTime',
  'dropoffDate',
  'dropoffTime',
  'passengers',
  'children',
  'largeBags',
  'driverAge',
]

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pickupLocation: {type: 'string', enum: ['', 'Christchurch', 'Queenstown']},
    dropoffLocation: {type: 'string', enum: ['', 'Christchurch', 'Queenstown']},
    pickupDate: {type: 'string', description: 'YYYY-MM-DD, empty if not known'},
    pickupTime: {type: 'string', description: 'HH:mm 24-hour time, empty if not known'},
    dropoffDate: {type: 'string', description: 'YYYY-MM-DD, empty if not known'},
    dropoffTime: {type: 'string', description: 'HH:mm 24-hour time, empty if not known'},
    driverAge: {type: 'string', enum: ['', 'over26', 'under26']},
    passengers: {type: 'integer', minimum: 0, maximum: 12, description: 'Adult passengers only. Use 0 if unknown.'},
    children: {type: 'integer', minimum: 0, maximum: 8, description: 'Child passengers. 0 is valid only if the customer has confirmed no children.'},
    largeBags: {type: 'integer', minimum: 0, maximum: 8, description: 'Large suitcases. 0 is valid only if confirmed.'},
    smallBags: {type: 'integer', minimum: 0, maximum: 8},
    vehiclePreference: {type: 'string', enum: ['any', 'compact', 'sedan', 'suv', 'mpv', 'van', 'premium']},
    budgetLevel: {type: 'string', enum: ['any', 'budget', 'mid', 'premium']},
    promoCode: {type: 'string'},
    promoCodeAsked: {type: 'boolean', description: 'True when the customer has answered the promo code question, including saying they do not have one.'},
    notes: {type: 'string'},
    responseLanguage: {
      type: 'string',
      description: 'The natural language used by the customer, e.g. English, Simplified Chinese, Japanese, Korean, French, Spanish.',
    },
    knownFields: {
      type: 'array',
      items: {type: 'string', enum: requiredFields},
      description: 'Required fields the customer has explicitly provided or clearly confirmed.',
    },
    nextQuestion: {
      type: 'string',
      description: 'If any required field is missing, ask a warm concise follow-up question in responseLanguage. Ask at most two missing topics.',
    },
  },
  required: [
    'pickupLocation',
    'dropoffLocation',
    'pickupDate',
    'pickupTime',
    'dropoffDate',
    'dropoffTime',
    'driverAge',
    'passengers',
    'children',
    'largeBags',
    'smallBags',
    'vehiclePreference',
    'budgetLevel',
    'promoCode',
    'promoCodeAsked',
    'notes',
    'responseLanguage',
    'knownFields',
    'nextQuestion',
  ],
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({success: false, error: 'Invalid request body'}, {status: 400})
  }

  const locale = body?.locale === 'zh' ? 'zh' : 'en'
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
  const requestedLanguage = normalizeRequestedLanguage(body?.responseLanguage)
  const conversationMode = body?.conversationMode === 'guided' ? 'guided' : 'natural'
  const messages = normalizeMessages(body?.messages, body?.message)
  const latestUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content || ''
  if (latestUserMessage.trim().length < 2) {
    return NextResponse.json({success: false, error: locale === 'zh' ? '请先告诉我你的行程需求。' : 'Please tell me about your trip first.'}, {status: 400})
  }

  const extracted = await extractConversationWithOpenAI(messages, locale, requestedLanguage, conversationMode)
  const aiAvailable = Boolean(extracted)
  const extraction = extracted || fallbackConversationExtraction(messages, locale, requestedLanguage)
  const responseLanguage = requestedLanguage || extraction.responseLanguage || detectFallbackLanguage(messagesToText(messages), locale)
  const localizedExtraction = {...extraction, responseLanguage}
  const conversationText = messagesToText(messages)
  const unsupportedLocationReply = buildUnsupportedLocationReply(latestUserMessage, responseLanguage)
  if (unsupportedLocationReply) {
    const response = {
      success: true,
      status: 'needs_info',
      aiAvailable,
      responseLanguage,
      assistantMessage: unsupportedLocationReply,
      missingFields: ['dropoffLocation'],
      partialSearch: toPartialSearch(localizedExtraction),
    } as const
    const memorySaved = await saveAiBookingMemoryIfPossible(sessionId, {
      locale,
      responseLanguage,
      status: response.status,
      messages: [...messages, {role: 'assistant', content: response.assistantMessage}],
      structuredSearch: response.partialSearch,
      missingFields: response.missingFields,
    })
    return NextResponse.json({...response, memorySaved})
  }
  const missingFields = getMissingFields(localizedExtraction, conversationText)

  if (missingFields.length > 0) {
    const assistantMessage = localizedExtraction.nextQuestion.trim()
      || buildFallbackQuestion(missingFields, responseLanguage)

    const response = {
      success: true,
      status: 'needs_info',
      aiAvailable,
      responseLanguage,
      assistantMessage,
      missingFields,
      partialSearch: toPartialSearch(localizedExtraction),
    } as const
    const memorySaved = await saveAiBookingMemoryIfPossible(sessionId, {
      locale,
      responseLanguage,
      status: response.status,
      messages: [...messages, {role: 'assistant', content: response.assistantMessage}],
      structuredSearch: response.partialSearch,
      missingFields: response.missingFields,
    })
    return NextResponse.json({...response, memorySaved})
  }

  // Give the customer one chance to apply a promotion before searching.
  // They can enter a code or explicitly skip this step with "No".
  const promoAnswered = Boolean(localizedExtraction.promoCode)
    || localizedExtraction.promoCodeAsked
    || isPromoAnswer(latestUserMessage)
  if (!promoAnswered) {
    const response = {
      success: true,
      status: 'needs_info',
      aiAvailable,
      responseLanguage,
      assistantMessage: buildPromoQuestion(responseLanguage),
      missingFields: ['promoCode'],
      partialSearch: toPartialSearch(localizedExtraction),
    } as const
    const memorySaved = await saveAiBookingMemoryIfPossible(sessionId, {
      locale,
      responseLanguage,
      status: response.status,
      messages: [...messages, {role: 'assistant', content: response.assistantMessage}],
      structuredSearch: response.partialSearch,
      missingFields: response.missingFields,
    })
    return NextResponse.json({...response, memorySaved})
  }

  const localizedSearch = normalizeFinderSearch({
    pickupLocation: localizedExtraction.pickupLocation || 'Christchurch',
    dropoffLocation: localizedExtraction.dropoffLocation || localizedExtraction.pickupLocation || 'Christchurch',
    pickupDate: localizedExtraction.pickupDate,
    pickupTime: localizedExtraction.pickupTime,
    dropoffDate: localizedExtraction.dropoffDate,
    dropoffTime: localizedExtraction.dropoffTime,
    driverAge: localizedExtraction.driverAge || 'over26',
    passengers: localizedExtraction.passengers,
    children: localizedExtraction.children,
    largeBags: localizedExtraction.largeBags,
    smallBags: localizedExtraction.smallBags,
    vehiclePreference: localizedExtraction.vehiclePreference,
    budgetLevel: localizedExtraction.budgetLevel,
    promoCode: localizedExtraction.promoCode || (isPromoAnswer(latestUserMessage) && /\bWEEKLYT\b/i.test(latestUserMessage) ? 'WEEKLYT' : ''),
    notes: localizedExtraction.notes,
    responseLanguage,
  })

  try {
    const rcmResults = await rcmSearch({
      pickupLocationId: LOCATION_IDS[localizedSearch.pickupLocation] || 1,
      dropoffLocationId: LOCATION_IDS[localizedSearch.dropoffLocation] || 1,
      pickupDate: toRCMDate(localizedSearch.pickupDate),
      pickupTime: localizedSearch.pickupTime,
      dropoffDate: toRCMDate(localizedSearch.dropoffDate),
      dropoffTime: localizedSearch.dropoffTime,
      campaignCode: resolveRcmPromoCode(localizedSearch.promoCode),
      ageId: localizedSearch.driverAge === 'under26' ? 4 : 9,
    })

    const rawLiveVehicles = Array.isArray(rcmResults?.availablecars)
      ? rcmResults.availablecars as AiFinderVehicle[]
      : []
    const localPricing = await applyLocalPrices(rawLiveVehicles, {
      pickupDate: localizedSearch.pickupDate,
      rentalDays: calculateRentalDays(localizedSearch.pickupDate, localizedSearch.pickupTime, localizedSearch.dropoffDate, localizedSearch.dropoffTime),
    })
    const liveVehicles = localPricing.vehicles as AiFinderVehicle[]
    const availableVehicles = liveVehicles
      .filter(vehicle => (vehicle.availablemessage || '').toLowerCase() === 'available' || vehicle.available === 1)
      .sort((a, b) => scoreVehicle(b, localizedSearch) - scoreVehicle(a, localizedSearch))
      .slice(0, 3)

    const vehicles = await addAiReasons(availableVehicles, localizedSearch, conversationText, aiAvailable)
    const summary = await buildSummaryWithOpenAI(localizedSearch, conversationText, aiAvailable)

    const response = {
      success: true,
      status: 'ready',
      aiAvailable,
      search: localizedSearch,
      responseLanguage,
      bookingUrl: `/booking/vehicles?${buildFinderQuery(localizedSearch)}`,
      vehicles,
      totalLiveVehicles: liveVehicles.length,
      summary,
      assistantMessage: summary,
    } as const
    const memorySaved = await saveAiBookingMemoryIfPossible(sessionId, {
      locale,
      responseLanguage,
      status: response.status,
      messages: [...messages, {role: 'assistant', content: response.assistantMessage}],
      structuredSearch: response.search,
      missingFields: [],
      recommendedVehicles: response.vehicles,
      bookingUrl: response.bookingUrl,
    })
    return NextResponse.json({...response, memorySaved})
  } catch (error: any) {
    console.error('[ai/car-finder] RCM search failed:', error?.message || error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unable to search live vehicle availability.',
      aiAvailable,
      search: localizedSearch,
    }, {status: 500})
  }
}

async function saveAiBookingMemoryIfPossible(
  sessionId: string,
  input: Omit<Parameters<typeof saveAiBookingMemory>[0], 'sessionId'>,
) {
  if (!sessionId) return false
  return saveAiBookingMemory({sessionId, ...input})
}

async function extractConversationWithOpenAI(
  messages: ChatMessage[],
  locale: 'en' | 'zh',
  requestedLanguage: string,
  conversationMode: 'natural' | 'guided',
): Promise<ConversationExtraction | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const today = nzTodayYmd()
  const system = [
    'You are a multilingual rental car advisor for YITU Car Rental in New Zealand.',
    'Your job is to guide the customer conversationally, not to force a one-shot form.',
    'If the customer asks a question, answer it first, then ask for the next missing detail.',
    `Today in New Zealand is ${today}. Convert relative dates into YYYY-MM-DD.`,
    'Supported pickup/dropoff locations are Christchurch and Queenstown only.',
    'If the customer asks about Wellington, Auckland, Dunedin, Nelson, Picton, or another unsupported city, politely explain that online booking currently supports only Christchurch and Queenstown, then ask them to choose one of those supported locations.',
    'Do not mark a required field as known unless the customer explicitly provided it or clearly confirmed it.',
    'Required before live search: pickupLocation, dropoffLocation, pickupDate, pickupTime, dropoffDate, dropoffTime, passengers, children, largeBags, driverAge.',
    'Before live search, ask whether the customer has a promo code. They may enter it or say they do not have one. Do not search until this has been answered.',
    'Ask at most two missing topics in nextQuestion. Keep it warm, concise, and in responseLanguage.',
    'If the customer says no children or no large bags, set the number to 0 and mark that field as known.',
    requestedLanguage
      ? `The customer selected ${requestedLanguage}. Keep every follow-up question and answer in ${requestedLanguage}; do not switch languages based on the text they type.`
      : 'Detect the customer language from their latest user message and set responseLanguage to that language name.',
    conversationMode === 'guided'
      ? 'The customer chose guided questions. Ask one short missing topic at a time and make the question easy to answer with a short value or a suggested option.'
      : 'The customer chose natural language. Let them describe multiple details at once, then ask only for the essential details still missing.',
    'Return only the structured JSON object.',
  ].join('\n')

  const data = await callOpenAI({
    model: OPENAI_MODEL,
    input: [
      {role: 'system', content: system},
      {role: 'user', content: `Website locale: ${locale}\nSelected language: ${requestedLanguage || 'not selected'}\nConversation mode: ${conversationMode}\nConversation:\n${formatConversation(messages)}`},
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'car_finder_conversation',
        strict: true,
        schema: extractionSchema,
      },
    },
  })

  const text = getResponseText(data)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('[ai/car-finder] Failed to parse OpenAI conversation extraction:', text)
    return null
  }
}

async function addAiReasons(
  vehicles: AiFinderVehicle[],
  search: AiFinderSearch,
  conversationText: string,
  aiAvailable: boolean,
) {
  const fallbackVehicles = vehicles.map(vehicle => ({
    ...vehicle,
    aiReason: deterministicReason(vehicle, search),
  }))
  if (!aiAvailable || vehicles.length === 0 || !process.env.OPENAI_API_KEY) return fallbackVehicles

  try {
    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content:
            `You explain why each live rental vehicle is recommended. Write every reason in ${search.responseLanguage}. Be concise, honest, and mention only facts in the vehicle data. Return JSON {"reasons":["..."]}.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            responseLanguage: search.responseLanguage,
            conversationText,
            search,
            vehicles: vehicles.map(vehicle => ({
              name: vehicle.categoryfriendlydescription || vehicle.vehiclecategory,
              seats: vehicle.numberofadults,
              largeBags: vehicle.numberoflargecases,
              smallBags: vehicle.numberofsmallcases,
              averageRate: vehicle.avgrate,
              totalAfterDiscount: vehicle.totalrateafterdiscount,
            })),
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'car_finder_reasons',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              reasons: {
                type: 'array',
                minItems: vehicles.length,
                maxItems: vehicles.length,
                items: {type: 'string'},
              },
            },
            required: ['reasons'],
          },
        },
      },
    })
    const parsed = JSON.parse(getResponseText(data) || '{}')
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : []
    return fallbackVehicles.map((vehicle, index) => ({
      ...vehicle,
      aiReason: String(reasons[index] || vehicle.aiReason).slice(0, 280),
    }))
  } catch (error: any) {
    console.error('[ai/car-finder] OpenAI reasons failed:', error?.message || error)
    return fallbackVehicles
  }
}

async function buildSummaryWithOpenAI(search: AiFinderSearch, conversationText: string, aiAvailable: boolean) {
  const fallback = buildSummary(search, aiAvailable)
  if (!aiAvailable || !process.env.OPENAI_API_KEY) return fallback

  try {
    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: `Summarize the finalized rental car search in ${search.responseLanguage}. Tell the customer you found live available vehicles. Be concise and natural. Return JSON {"summary":"..."}.`,
        },
        {
          role: 'user',
          content: JSON.stringify({conversationText, search}),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'car_finder_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: {type: 'string'},
            },
            required: ['summary'],
          },
        },
      },
    })
    const parsed = JSON.parse(getResponseText(data) || '{}')
    return String(parsed.summary || fallback).slice(0, 420)
  } catch (error: any) {
    console.error('[ai/car-finder] OpenAI summary failed:', error?.message || error)
    return fallback
  }
}

async function callOpenAI(payload: Record<string, any>) {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI request failed: ${res.status}`)
  }
  return data
}

function normalizeMessages(value: unknown, fallbackMessage: unknown): ChatMessage[] {
  const fromArray: ChatMessage[] = Array.isArray(value)
    ? value
      .map((item: any): ChatMessage => ({
        role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: String(item?.content || '').trim(),
      }))
      .filter(item => item.content)
    : []

  if (fromArray.length > 0) return fromArray.slice(-12)

  const message = String(fallbackMessage || '').trim()
  return message ? [{role: 'user', content: message}] : []
}

function formatConversation(messages: ChatMessage[]) {
  return messages
    .map(message => `${message.role === 'assistant' ? 'Assistant' : 'Customer'}: ${message.content}`)
    .join('\n')
}

function messagesToText(messages: ChatMessage[]) {
  return messages.map(message => message.content).join('\n')
}

function getResponseText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text
  const chunks: string[] = []
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') chunks.push(content.text)
    }
  }
  return chunks.join('').trim()
}

function getMissingFields(extraction: ConversationExtraction, conversationText: string): FinderRequiredField[] {
  const known = new Set(extraction.knownFields || [])
  return requiredFields.filter(field => {
    if ((field === 'children' || field === 'largeBags') && !hasExplicitCountField(field, conversationText)) return true
    if (!known.has(field)) return true
    if (field === 'pickupLocation' || field === 'dropoffLocation' || field === 'driverAge') return !extraction[field]
    if (field === 'pickupDate' || field === 'pickupTime' || field === 'dropoffDate' || field === 'dropoffTime') return !extraction[field]
    if (field === 'passengers') return !Number(extraction.passengers)
    if (field === 'children') return !Number.isFinite(Number(extraction.children))
    if (field === 'largeBags') return !Number.isFinite(Number(extraction.largeBags))
    return false
  })
}

function hasExplicitCountField(field: 'children' | 'largeBags', text: string) {
  if (field === 'children') {
    return /(no\s+children|no\s+kids|without\s+children|0\s*(children|child|kids|kid)|\d+\s*(children|child|kids|kid)|没有小孩|没有儿童|无小孩|无儿童|0\s*(个)?\s*(小孩|儿童)|\d+\s*(个)?\s*(小孩|儿童))/i.test(text)
  }
  return /(no\s+large\s+(bags|suitcases|luggage)|no\s+big\s+(bags|suitcases|luggage)|0\s*(large|big)\s*(bags|bag|suitcases|suitcase|luggage)|\d+\s*(large|big)\s*(bags|bag|suitcases|suitcase|luggage)|没有大箱|没有大行李|无大箱|无大行李|0\s*(个)?\s*(大箱|大行李)|\d+\s*(个)?\s*(大箱|大行李))/i.test(text)
}

function toPartialSearch(extraction: ConversationExtraction) {
  return {
    pickupLocation: extraction.pickupLocation,
    dropoffLocation: extraction.dropoffLocation,
    pickupDate: extraction.pickupDate,
    pickupTime: extraction.pickupTime,
    dropoffDate: extraction.dropoffDate,
    dropoffTime: extraction.dropoffTime,
    driverAge: extraction.driverAge,
    passengers: extraction.passengers,
    children: extraction.children,
    largeBags: extraction.largeBags,
    smallBags: extraction.smallBags,
    vehiclePreference: extraction.vehiclePreference,
    budgetLevel: extraction.budgetLevel,
    promoCode: extraction.promoCode,
    notes: extraction.notes,
    responseLanguage: extraction.responseLanguage,
  }
}

function fallbackConversationExtraction(messages: ChatMessage[], locale: 'en' | 'zh', requestedLanguage: string): ConversationExtraction {
  const text = messagesToText(messages)
  const responseLanguage = requestedLanguage || detectFallbackLanguage(text, locale)
  const isZh = isChineseLanguage(responseLanguage)
  return {
    pickupLocation: /queenstown|皇后镇/i.test(text) && !/christchurch|基督城/i.test(text) ? 'Queenstown' : '',
    dropoffLocation: /to queenstown|drop.*queenstown|还.*皇后镇|到皇后镇/i.test(text)
      ? 'Queenstown'
      : /to christchurch|drop.*christchurch|还.*基督城|到基督城/i.test(text)
        ? 'Christchurch'
        : '',
    pickupDate: '',
    pickupTime: '',
    dropoffDate: '',
    dropoffTime: '',
    driverAge: /(under\s*26|under\s*25|25|24|23|22|21|young|年轻|26岁以下)/i.test(text) ? 'under26' : '',
    passengers: firstNumberBefore(text.toLowerCase(), ['adults', 'adult', 'people', 'person', 'passengers', '大人', '成人', '人', '位']) || 0,
    children: firstNumberBefore(text.toLowerCase(), ['children', 'child', 'kids', 'kid', '儿童', '小孩']) || 0,
    largeBags: firstNumberBefore(text.toLowerCase(), ['large bags', 'large bag', 'big suitcases', 'big suitcase', '大箱', '大行李']) || 0,
    smallBags: firstNumberBefore(text.toLowerCase(), ['small bags', 'small bag', 'carry on', '小箱', '小行李']) || 0,
    vehiclePreference: /van|hiace|12|people mover|mpv|vellfire|alphard|商务|保姆|多人/i.test(text)
      ? 'mpv'
      : /suv|awd|4wd|snow|mountain|山|雪/i.test(text)
        ? 'suv'
        : /cheap|budget|省钱|便宜/i.test(text)
          ? 'compact'
          : 'any',
    budgetLevel: /premium|luxury|高端|豪华/i.test(text) ? 'premium' : /cheap|budget|省钱|便宜/i.test(text) ? 'budget' : 'any',
    promoCode: /\bWEEKLYT\b/i.test(text) ? 'WEEKLYT' : '',
    promoCodeAsked: isPromoAnswer(text),
    notes: '',
    responseLanguage,
    knownFields: [],
    nextQuestion: buildLocalizedInitialQuestion(responseLanguage),
  }
}

function normalizeRequestedLanguage(value: unknown): string {
  const language = String(value || '').trim()
  if ((supportedFinderLanguages as readonly string[]).includes(language)) return language
  if (language.length >= 2 && language.length <= 40 && !/[<>]/.test(language)) return language
  return ''
}

function buildFallbackQuestion(missingFields: FinderRequiredField[], responseLanguage: string) {
  const isZh = isChineseLanguage(responseLanguage)
  const isRussian = /russian|русский|русск/i.test(responseLanguage)
  const firstTwo = missingFields.slice(0, 2)
  if (isZh) {
    const labels: Record<FinderRequiredField, string> = {
      pickupLocation: '取车地点',
      dropoffLocation: '还车地点',
      pickupDate: '取车日期',
      pickupTime: '取车时间',
      dropoffDate: '还车日期',
      dropoffTime: '还车时间',
      passengers: '成人数量',
      children: '儿童数量',
      largeBags: '大箱数量',
      driverAge: '驾驶员是否 26 岁以上',
    }
    return `还差一点信息我就能查真实车辆了：请告诉我${firstTwo.map(field => labels[field]).join('和')}。`
  }
  if (isRussian) {
    const labels: Record<FinderRequiredField, string> = {
      pickupLocation: 'место получения автомобиля',
      dropoffLocation: 'место возврата автомобиля',
      pickupDate: 'дату получения',
      pickupTime: 'время получения',
      dropoffDate: 'дату возврата',
      dropoffTime: 'время возврата',
      passengers: 'количество взрослых',
      children: 'количество детей',
      largeBags: 'количество больших чемоданов',
      driverAge: 'возраст водителя',
    }
    return `Чтобы найти доступные автомобили, сообщите, пожалуйста: ${firstTwo.map(field => labels[field]).join(' и ')}.`
  }
  const labels: Record<FinderRequiredField, string> = {
    pickupLocation: 'pickup location',
    dropoffLocation: 'dropoff location',
    pickupDate: 'pickup date',
    pickupTime: 'pickup time',
    dropoffDate: 'return date',
    dropoffTime: 'return time',
    passengers: 'number of adults',
    children: 'number of children',
    largeBags: 'number of large bags',
    driverAge: 'whether the driver is 26 or older',
  }
  return `I just need a little more before checking live cars: please share your ${firstTwo.map(field => labels[field]).join(' and ')}.`
}

function buildPromoQuestion(responseLanguage: string) {
  if (isChineseLanguage(responseLanguage)) return '行程信息已经齐了。请问你有优惠码吗？如果没有，可以回复“没有”，我就开始查询车辆。'
  if (/russian|русский|русск/i.test(responseLanguage)) return 'Данные поездки готовы. У вас есть промокод? Если нет, напишите «нет», и я начну поиск автомобилей.'
  return 'Your trip details are ready. Do you have a promo code? If not, reply "No" and I will search the available vehicles.'
}

function isPromoAnswer(message: string) {
  const text = message.trim()
  if (!text) return false
  if (/\bWEEKLYT\b/i.test(text)) return true
  return /^(no|none|no promo|no promo code|没有|没有优惠码|无|无优惠码|不需要)$/i.test(text)
}

function buildLocalizedInitialQuestion(responseLanguage: string) {
  if (isChineseLanguage(responseLanguage)) return '我来帮你一步一步找车。请先告诉我取车地点、还车地点，以及取还车日期和时间。'
  if (/russian|русский|русск/i.test(responseLanguage)) return 'Я помогу вам подобрать автомобиль шаг за шагом. Сначала укажите место получения и возврата, а также даты и время.'
  if (/japanese|日本語/i.test(responseLanguage)) return '旅行に合う車を順番にお探しします。まず、受取場所・返却場所・日時を教えてください。'
  if (/korean|한국어/i.test(responseLanguage)) return '여행에 맞는 차량을 단계별로 찾아드릴게요. 먼저 픽업 및 반납 장소와 날짜, 시간을 알려주세요.'
  if (/spanish|español|espanol/i.test(responseLanguage)) return 'Te ayudaré a encontrar el vehículo paso a paso. Primero, indícame los lugares y las fechas y horas de recogida y devolución.'
  return 'I can help you find the right car step by step. First, please share your pickup and return locations, dates and times.'
}

function buildUnsupportedLocationReply(latestUserMessage: string, responseLanguage: string) {
  const unsupportedCity = detectUnsupportedLocation(latestUserMessage)
  if (!unsupportedCity) return ''

  if (isChineseLanguage(responseLanguage)) {
    return `目前 YITU 在线预订只支持基督城和皇后镇取还车，暂时不能选择${unsupportedCity.zh}还车。你可以选择基督城或皇后镇还车，我再继续帮你查真实车辆。你想选哪一个？`
  }

  if (/russian|русский|русск/i.test(responseLanguage)) {
    return `Сейчас онлайн-бронирование YITU поддерживает только получение и возврат автомобиля в Крайстчерче и Квинстауне. ${unsupportedCity.en} недоступен. Пожалуйста, выберите один из этих двух городов.`
  }

  return `At the moment, YITU online booking only supports pickup and dropoff in Christchurch and Queenstown, so ${unsupportedCity.en} is not available for dropoff here. Please choose Christchurch or Queenstown as the dropoff location, and I will keep helping you search live vehicles.`
}

function detectUnsupportedLocation(text: string) {
  const locations = [
    ['惠灵顿', 'Wellington', '惠灵顿'],
    ['wellington', 'Wellington', '惠灵顿'],
    ['奥克兰', 'Auckland', '奥克兰'],
    ['auckland', 'Auckland', '奥克兰'],
    ['但尼丁', 'Dunedin', '但尼丁'],
    ['达尼丁', 'Dunedin', '但尼丁'],
    ['dunedin', 'Dunedin', '但尼丁'],
    ['尼尔森', 'Nelson', '尼尔森'],
    ['nelson', 'Nelson', '尼尔森'],
    ['皮克顿', 'Picton', '皮克顿'],
    ['picton', 'Picton', '皮克顿'],
  ] as const

  const lowerText = text.toLowerCase()
  for (const [needle, en, zh] of locations) {
    if (lowerText.includes(needle.toLowerCase())) return {en, zh}
  }
  return null
}

function buildSummary(search: AiFinderSearch, aiAvailable: boolean) {
  const aiLabel = aiAvailable ? 'AI' : 'Smart'
  if (isChineseLanguage(search.responseLanguage)) {
    return `${aiLabel} 已整理好你的行程，并找到真实可订车辆：${search.pickupLocation} 到 ${search.dropoffLocation}，${search.pickupDate} ${search.pickupTime} 取车，${search.dropoffDate} ${search.dropoffTime} 还车，${search.passengers + search.children} 位乘客，${search.largeBags} 个大箱。`
  }
  return `${aiLabel} found live available vehicles for your trip: ${search.pickupLocation} to ${search.dropoffLocation}, pick up ${search.pickupDate} ${search.pickupTime}, return ${search.dropoffDate} ${search.dropoffTime}, ${search.passengers + search.children} travellers, ${search.largeBags} large bags.`
}

function detectFallbackLanguage(message: string, locale: 'en' | 'zh') {
  if (/[\u4e00-\u9fff]/.test(message)) return 'Simplified Chinese'
  if (/[\u3040-\u30ff]/.test(message)) return 'Japanese'
  if (/[\uac00-\ud7af]/.test(message)) return 'Korean'
  if (/[\u0e00-\u0e7f]/.test(message)) return 'Thai'
  if (/[\u0400-\u04ff]/.test(message)) return 'Russian'
  if (/[\u0600-\u06ff]/.test(message)) return 'Arabic'
  return locale === 'zh' ? 'Simplified Chinese' : 'English'
}

function firstNumberBefore(text: string, words: string[]) {
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = text.match(new RegExp(`(\\d{1,2})\\s*(?:${escaped})`, 'i'))
    if (match) return Number(match[1])
  }
  return 0
}
