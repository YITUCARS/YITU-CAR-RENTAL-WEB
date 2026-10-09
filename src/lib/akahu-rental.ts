import crypto from 'crypto'

import { rcmCall } from '@/lib/rcm'
import { notifyWebsitePaymentReceived } from '@/lib/rcm-telegram'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const apiBase = () => (process.env.AKAHU_API_URL || 'https://api.payments.akahu.io/v1').replace(/\/$/, '')

function credentials() {
  const token = process.env.AKAHU_API_TOKEN
  const secret = process.env.AKAHU_API_SECRET
  if (!token || !secret) throw new Error('Akahu payment credentials are not configured.')
  return `Basic ${Buffer.from(`${token}:${secret}`).toString('base64')}`
}

export type AkahuPayment = {
  _id: string
  status: 'READY' | 'AUTHORISED' | 'SUBMITTED' | 'SENT' | 'CANCELLED' | 'FAILED' | string
  status_code?: string
  amount: number
  payee?: { name?: string; account_number?: string; reference?: string }
  payer?: { name?: string; account_number?: string }
}

export async function createAkahuRentalPayment(input: {
  reservationRef: string
  amount: number
  origin: string
}) {
  const payeeName = process.env.AKAHU_PAYEE_NAME
  const payeeAccount = process.env.AKAHU_PAYEE_ACCOUNT_NUMBER
  if (!payeeName || !payeeAccount) {
    throw new Error('Akahu payee account is not configured.')
  }

  const reference = input.reservationRef.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 12)
  const response = await fetch(`${apiBase()}/one-off-payments`, {
    method: 'POST',
    headers: { Authorization: credentials(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payee: { name: payeeName, account_number: payeeAccount, reference },
      amount: input.amount,
      redirect_uri: `${input.origin}/api/payments/akahu/rental/return`,
      webhook_uri: `${input.origin}/api/payments/akahu/rental/webhook`,
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message || 'Akahu could not create the bank payment.')
  }
  if (!data?._id || !data?.authorisation_url) {
    throw new Error('Akahu returned an incomplete payment request.')
  }
  return data as { _id: string; authorisation_url: string; expires_at?: string }
}

export async function getAkahuRentalPayment(paymentId: string) {
  if (!/^one_off_payment_[a-z0-9]{25,27}$/.test(paymentId)) {
    throw new Error('Invalid Akahu payment id.')
  }
  const response = await fetch(`${apiBase()}/one-off-payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: credentials() },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.message || 'Unable to read Akahu payment status.')
  return data as AkahuPayment
}

export function isAkahuPaymentSent(payment: AkahuPayment) {
  return String(payment.status).toUpperCase() === 'SENT'
}

export function isAkahuPaymentTerminal(payment: AkahuPayment) {
  return ['SENT', 'CANCELLED', 'FAILED'].includes(String(payment.status).toUpperCase())
}

function equalMoney(left: unknown, right: number) {
  const value = Number(left)
  return Number.isFinite(value) && Math.abs(value - right) < 0.005
}

async function claimConfirmation(paymentId: string, reservationRef: string, amount: number, source: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('rental_payment_confirmation').insert({
      payment_intent_id: `akahu:${paymentId}`,
      reservation_ref: reservationRef,
      amount,
      payment_channel: 'vantu_app',
      stripe_mode: 'akahu',
      confirmed_by: source,
    })
    if (!error) return 'claimed' as const
    if ((error as any)?.code === '23505') return 'already' as const
    console.warn('[akahu rental] confirmation ledger unavailable:', error.message)
  } catch (error) {
    console.warn('[akahu rental] confirmation ledger unavailable:', error)
  }
  return 'unavailable' as const
}

async function releaseConfirmation(paymentId: string) {
  try {
    await getSupabaseAdmin()
      .from('rental_payment_confirmation')
      .delete()
      .eq('payment_intent_id', `akahu:${paymentId}`)
  } catch (error) {
    console.warn('[akahu rental] confirmation claim release failed:', error)
  }
}

/** Confirms an Akahu payment only after Akahu reports that it was SENT. */
export async function confirmAkahuRentalPayment(input: {
  payment: AkahuPayment
  reservationRef: string
  expectedAmount: number
  source: 'poll' | 'webhook'
}) {
  const { payment, reservationRef, expectedAmount, source } = input
  if (!isAkahuPaymentSent(payment)) return { ok: false as const, pending: true, status: payment.status }
  if (!equalMoney(payment.amount, expectedAmount)) {
    return { ok: false as const, pending: false, error: 'Akahu payment amount does not match the booking.' }
  }
  const expectedAccount = String(process.env.AKAHU_PAYEE_ACCOUNT_NUMBER || '').replace(/\s/g, '')
  if (!expectedAccount || String(payment.payee?.account_number || '').replace(/\s/g, '') !== expectedAccount) {
    return { ok: false as const, pending: false, error: 'Akahu payment payee does not match this rental account.' }
  }
  const paymentReference = String(payment.payee?.reference || '').trim()
  if (paymentReference && paymentReference !== reservationRef.slice(0, 12)) {
    return { ok: false as const, pending: false, error: 'Akahu payment reference does not match the booking.' }
  }

  const claim = await claimConfirmation(payment._id, reservationRef, expectedAmount, source)
  if (claim === 'already') return { ok: true as const, alreadyConfirmed: true }

  try {
    const supplierId = Number(process.env.RCM_AKAHU_SUPPLIER_ID || 1)
    const rcm = await rcmCall('confirmpayment', {
      reservationref: reservationRef,
      amount: expectedAmount,
      success: true,
      paytype: 'Akahu',
      paydate: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Pacific/Auckland', day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(new Date()),
      supplierid: supplierId,
      transactid: payment._id,
      dpstxnref: payment._id,
      cardholder: payment.payer?.name || '',
      paysource: 'Akahu via Vantu App',
      payscenario: 1,
      emailoption: 1,
    })
    if (rcm?.paymentsaved !== true) {
      if (claim === 'claimed') await releaseConfirmation(payment._id)
      return { ok: false as const, pending: false, error: 'RCM did not confirm the Akahu payment.' }
    }

    try {
      await notifyWebsitePaymentReceived({
        reservationRef,
        amount: expectedAmount,
        paymentIntentId: payment._id,
        chargeId: payment._id,
        paymentMethod: 'Akahu bank payment',
        paymentChannel: 'vantu_app',
      })
    } catch (error) {
      console.error('[akahu rental] payment notification failed:', error)
    }
    return { ok: true as const, alreadyConfirmed: false }
  } catch (error) {
    if (claim === 'claimed') await releaseConfirmation(payment._id)
    throw error
  }
}

/** Verifies Akahu's RSA-SHA256 signature against its current public key. */
export async function verifyAkahuWebhook(rawBody: string, headers: Headers) {
  const signature = headers.get('x-akahu-payments-signature')
  const keyId = headers.get('x-akahu-payments-signing-key')
  if (!signature || !keyId) return false
  const response = await fetch(`${apiBase()}/keys/${encodeURIComponent(keyId)}`, {
    headers: { Authorization: credentials() },
  })
  if (!response.ok) return false
  const data = await response.json()
  const publicKey = data?.public_key || data?.key || data
  if (typeof publicKey !== 'string') return false
  return crypto.verify('RSA-SHA256', Buffer.from(rawBody), publicKey, Buffer.from(signature, 'base64'))
}
