import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type StripeMode = 'live' | 'test'
export type PaymentChannel = 'yitu_web' | 'vantu_app'

export function normalizeStripeMode(value: unknown): StripeMode {
  const mode = String(value || '').toLowerCase()
  return mode === 'live' || mode === 'production' ? 'live' : 'test'
}

export function normalizePaymentChannel(value: unknown): PaymentChannel {
  return String(value || '').toLowerCase() === 'vantu_app'
    ? 'vantu_app'
    : 'yitu_web'
}

export function getStripeSecretKey(mode: StripeMode, channel: PaymentChannel) {
  if (channel === 'vantu_app') {
    const key =
      mode === 'live'
        ? process.env.VANTU_STRIPE_LIVE_SECRET_KEY
        : process.env.VANTU_STRIPE_TEST_SECRET_KEY
    if (!key) {
      throw new Error(
        mode === 'live'
          ? 'Missing VANTU_STRIPE_LIVE_SECRET_KEY.'
          : 'Missing VANTU_STRIPE_TEST_SECRET_KEY.',
      )
    }
    return key
  }

  const key =
    mode === 'live'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      mode === 'live'
        ? 'Missing STRIPE_LIVE_SECRET_KEY.'
        : 'Missing STRIPE_TEST_SECRET_KEY.',
    )
  }
  return key
}

export function cents(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payment amount.')
  }
  return Math.round(amount)
}

export function asMoneyFromCents(value: unknown) {
  const cents = Number(value)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.round(cents) / 100
}

export function formatRcmDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export async function stripeRequest(
  path: string,
  params: URLSearchParams,
  mode: StripeMode,
  channel: PaymentChannel,
) {
  const stripeRes = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey(mode, channel)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const data = await stripeRes.json()
  if (!stripeRes.ok) {
    const error = new Error(data?.error?.message || 'Stripe request failed.') as Error & {
      status?: number
      stripeError?: any
    }
    error.status = stripeRes.status
    error.stripeError = data?.error || data
    throw error
  }
  return data
}

export async function retrievePaymentIntent(
  paymentIntentId: string,
  stripeMode: StripeMode,
  paymentChannel: PaymentChannel,
) {
  const params = new URLSearchParams()
  params.append('expand[]', 'latest_charge')
  params.append('expand[]', 'payment_method')
  const stripeRes = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${getStripeSecretKey(stripeMode, paymentChannel)}`,
      },
    },
  )
  const data = await stripeRes.json()
  if (!stripeRes.ok) {
    throw new Error(data?.error?.message || 'Unable to retrieve Stripe payment.')
  }
  return data
}

export async function createStripeCustomer(params: {
  stripeMode: StripeMode
  paymentChannel: PaymentChannel
  reservationRef: string
  email?: string
  name?: string
  phone?: string
}) {
  const form = new URLSearchParams()
  if (params.email) form.set('email', params.email)
  if (params.name) form.set('name', params.name)
  if (params.phone) form.set('phone', params.phone)
  form.set('metadata[reservation_ref]', params.reservationRef)
  form.set('metadata[source]', params.paymentChannel)
  return stripeRequest('customers', form, params.stripeMode, params.paymentChannel)
}

export async function upsertSavedPaymentMethod(row: Record<string, any>) {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('stripe_saved_payment_methods').upsert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  } catch (error) {
    console.error(
      '[stripe saved payment method] store failed:',
      error instanceof Error ? error.message : error,
    )
  }
}

export async function getSavedPaymentMethod(reservationRef: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stripe_saved_payment_methods')
    .select('*')
    .eq('reservation_ref', reservationRef)
    .maybeSingle()
  if (error) throw error
  return data
}
