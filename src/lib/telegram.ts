import { getStaffBookingDetail, getStaffBookings, pickString } from '@/lib/staff-api'
import { toRCMDate } from '@/lib/rcm'

const NZ_TIME_ZONE = 'Pacific/Auckland'

type TelegramParseMode = 'HTML' | 'MarkdownV2'

type TelegramReplyMarkup = {
  inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>
}

function telegramToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.')
  return token
}

function defaultChatId() {
  return process.env.TELEGRAM_CHAT_ID || ''
}

export function escapeTelegramHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeChatId(value: string | number | null | undefined) {
  return String(value ?? '').trim()
}

export function isAllowedTelegramChat(chatId: string | number) {
  const allowed = String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (!allowed.length) return true
  return allowed.includes(normalizeChatId(chatId))
}

export async function sendTelegramMessage(params: {
  text: string
  chatId?: string | number
  parseMode?: TelegramParseMode
  replyToMessageId?: number
  disableWebPagePreview?: boolean
  replyMarkup?: TelegramReplyMarkup
}) {
  const chatId = normalizeChatId(params.chatId || defaultChatId())
  if (!chatId) throw new Error('Telegram chat ID is not configured.')

  const response = await fetch(`https://api.telegram.org/bot${telegramToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: params.text,
      parse_mode: params.parseMode || 'HTML',
      reply_to_message_id: params.replyToMessageId,
      disable_web_page_preview: params.disableWebPagePreview ?? true,
      reply_markup: params.replyMarkup,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.description || `Telegram sendMessage failed: ${response.status}`)
  }

  return data
}

export async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string) {
  const response = await fetch(`https://api.telegram.org/bot${telegramToken()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.description || `Telegram answerCallbackQuery failed: ${response.status}`)
  }

  return data
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NZ_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getRelativeDateLabel(offsetDays = 0) {
  const base = new Date()
  base.setDate(base.getDate() + offsetDays)
  return formatDate(base)
}

function parseCommand(text: string) {
  const [rawCommand = '', ...rest] = String(text || '').trim().split(/\s+/)
  const command = rawCommand.split('@')[0].toLowerCase()
  return { command, args: rest }
}

function formatMoney(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

function summarizeBookings(title: string, bookings: any[]) {
  if (!bookings.length) return `${title}\nNo bookings found.`

  const lines = bookings.slice(0, 12).map((booking) => {
    const ref = escapeTelegramHtml(booking.bookingRef || booking.reservationNo || booking.id)
    const customer = escapeTelegramHtml(booking.customerName)
    const time = escapeTelegramHtml(booking.time || booking.pickupTime || booking.dropoffTime || 'TBC')
    const vehicle = escapeTelegramHtml(booking.vehicleModel)
    return `• <b>${ref}</b> · ${customer} · ${time} · ${vehicle}`
  })

  const suffix = bookings.length > 12 ? `\n…and ${bookings.length - 12} more.` : ''
  return `${title}\n${lines.join('\n')}${suffix}`
}

function buildBookingDetailMessage(booking: any) {
  const ref = escapeTelegramHtml(booking.bookingRef || booking.reservationNo || booking.id)
  const reservationNo = escapeTelegramHtml(booking.reservationNo || '—')
  const customer = escapeTelegramHtml(booking.customerName)
  const pickup = escapeTelegramHtml(`${booking.pickupDate || '—'} ${booking.pickupTime || ''}`.trim())
  const dropoff = escapeTelegramHtml(`${booking.dropoffDate || '—'} ${booking.dropoffTime || ''}`.trim())
  const vehicle = escapeTelegramHtml(booking.vehicleModel)
  const pickupLocation = escapeTelegramHtml(booking.pickupLocation)
  const dropoffLocation = escapeTelegramHtml(booking.dropoffLocation)
  const status = escapeTelegramHtml(booking.status || 'unknown')
  const total = formatMoney(booking.total)
  const paid = formatMoney(booking.paid)
  const balance = formatMoney(booking.balanceDue)
  const source = escapeTelegramHtml(pickString(booking.raw || {}, ['bookedby', 'source', 'bookingchannel', 'bookingChannel', 'travelagent', 'companyname'], 'RCM'))

  return [
    '<b>RCM Booking Detail</b>',
    `Ref: <b>${ref}</b>`,
    `Reservation No: ${reservationNo}`,
    `Customer: ${customer}`,
    `Status: ${status}`,
    `Pickup: ${pickup} · ${pickupLocation}`,
    `Dropoff: ${dropoff} · ${dropoffLocation}`,
    `Vehicle: ${vehicle}`,
    `Total: NZD ${total} · Paid: NZD ${paid} · Balance: NZD ${balance}`,
    `Source: ${source}`,
  ].join('\n')
}

export function buildTelegramMenuMarkup(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '今日订单', callback_data: 'rcm:today' },
        { text: '明日订单', callback_data: 'rcm:tomorrow' },
      ],
      [
        { text: '今日取车', callback_data: 'rcm:pickup:today' },
        { text: '今日还车', callback_data: 'rcm:dropoff:today' },
      ],
    ],
  }
}

export function buildTelegramMenuMessage() {
  return [
    '<b>YITU RCM Bot</b>',
    '可以直接点下面按钮查询订单。',
    '查单号时，直接发送：订单 ABC123',
  ].join('\n')
}

async function buildDaySummary(date: string) {
  const [pickups, dropoffs] = await Promise.all([
    getStaffBookings({ date: toRCMDate(date), type: 'pickup' }),
    getStaffBookings({ date: toRCMDate(date), type: 'dropoff' }),
  ])

  return [
    summarizeBookings(`<b>${escapeTelegramHtml(date)} Pickups</b>`, pickups),
    '',
    summarizeBookings(`<b>${escapeTelegramHtml(date)} Dropoffs</b>`, dropoffs),
  ].join('\n')
}

export async function buildTelegramCallbackReply(data: string) {
  if (data === 'rcm:today') {
    return buildDaySummary(getRelativeDateLabel(0))
  }

  if (data === 'rcm:tomorrow') {
    return buildDaySummary(getRelativeDateLabel(1))
  }

  if (data === 'rcm:pickup:today' || data === 'rcm:dropoff:today') {
    const type = data === 'rcm:pickup:today' ? 'pickup' : 'dropoff'
    const date = getRelativeDateLabel(0)
    const bookings = await getStaffBookings({ date: toRCMDate(date), type })
    return summarizeBookings(`<b>${escapeTelegramHtml(date)} ${type}</b>`, bookings)
  }

  return ''
}

export async function buildTelegramCommandReply(text: string) {
  const { command, args } = parseCommand(text)
  const normalizedText = String(text || '').trim()

  if (/^(菜单|menu|功能|查单)$/i.test(normalizedText)) {
    return buildTelegramMenuMessage()
  }

  const bookingMatch = normalizedText.match(/^(订单|查单|booking)\s+(.+)$/i)
  if (bookingMatch?.[2]) {
    const booking = await getStaffBookingDetail(bookingMatch[2].trim())
    if (!booking?.bookingRef && !booking?.reservationNo) {
      return `No booking found for ${escapeTelegramHtml(bookingMatch[2].trim())}.`
    }
    return buildBookingDetailMessage(booking)
  }

  if (command === '/start' || command === '/help') {
    return buildTelegramMenuMessage()
  }

  if (command === '/today' || command === '/tomorrow') {
    const offset = command === '/tomorrow' ? 1 : 0
    const date = getRelativeDateLabel(offset)
    return buildDaySummary(date)
  }

  if ((command === '/pickup' || command === '/dropoff') && args[0]) {
    const type = command === '/pickup' ? 'pickup' : 'dropoff'
    const date = args[0]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return 'Please use YYYY-MM-DD, for example /pickup 2026-06-16'
    }

    const bookings = await getStaffBookings({ date: toRCMDate(date), type })
    return summarizeBookings(`<b>${escapeTelegramHtml(date)} ${type}</b>`, bookings)
  }

  if (command === '/booking' && args[0]) {
    const booking = await getStaffBookingDetail(args[0])
    if (!booking?.bookingRef && !booking?.reservationNo) {
      return `No booking found for ${escapeTelegramHtml(args[0])}.`
    }
    return buildBookingDetailMessage(booking)
  }

  return ''
}
