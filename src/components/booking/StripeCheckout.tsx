'use client'

import React, { useState } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CreditCard, AlertCircle, Lock } from 'lucide-react'

interface StripeCheckoutProps {
    payAmount: number
    stripeMode: 'live' | 'test'
    reservationRef: string
    reservationNo?: string
}

/**
 * Renders the Stripe Payment Element and confirms the PaymentIntent that was
 * created server-side (clientSecret is passed to the parent <Elements>).
 *
 * Flow:
 *  1. stripe.confirmPayment({ redirect: 'if_required' }) — for plain cards this
 *     resolves inline; methods that need 3-D Secure are redirected to return_url
 *     (the /booking/payment/callback page, which finishes the same confirm step).
 *  2. On inline success we register the charge in RCM via the confirm route, then
 *     send the customer to the booking confirmation page.
 */
export default function StripeCheckout({
    payAmount,
    stripeMode,
    reservationRef,
    reservationNo,
}: StripeCheckoutProps) {
    const stripe = useStripe()
    const elements = useElements()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!stripe || !elements) return

        setLoading(true)
        setError('')

        const returnUrl = `${window.location.origin}/booking/payment/callback?reservationRef=${encodeURIComponent(
            reservationRef,
        )}&stripeMode=${stripeMode}`

        const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: 'if_required',
        })

        if (confirmError) {
            setError(confirmError.message || 'Payment failed. Please check your card details and try again.')
            setLoading(false)
            return
        }

        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            // Either a redirect-based method took over, or the intent is still
            // processing — let the callback page reconcile the final state.
            setError(
                paymentIntent
                    ? `Payment is ${paymentIntent.status}. Please wait while we confirm…`
                    : 'Payment could not be completed. Please try again.',
            )
            setLoading(false)
            return
        }

        try {
            const res = await fetch('/api/payments/stripe/rental/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentIntentId: paymentIntent.id,
                    reservationRef,
                    stripeMode,
                }),
            })
            const data = await res.json()
            if (!data.success) {
                throw new Error(
                    data.error ||
                        'Your card was charged but we could not confirm the booking. Please contact us with your booking number.',
                )
            }

            const query = new URLSearchParams()
            if (reservationRef) query.set('ref', reservationRef)
            if (reservationNo) query.set('no', reservationNo)

            // WeChat mini program web-view handoff (mirrors the old VostroPay flow).
            const inMiniProgram =
                typeof window !== 'undefined' && (window as any).__wxjs_environment === 'miniprogram'
            const inWeChat =
                typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent)
            if (inMiniProgram || inWeChat) {
                const wx = (window as any).wx
                if (wx && wx.miniProgram) {
                    wx.miniProgram.navigateTo({
                        url: `/pages/payment/result?${query.toString()}&success=true`,
                    })
                    return
                }
            }

            window.location.href = `/booking/confirmation?${query.toString()}`
        } catch (err: any) {
            setError(err.message || 'Unable to confirm your booking. Please contact us.')
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="bg-white border border-black/10 rounded-card p-5">
                <PaymentElement options={{ layout: 'tabs' }} />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-[13px]">{error}</p>
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || !elements || loading}
                className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[15px] py-4 rounded-xl transition-all shadow-orange-glow disabled:opacity-60"
            >
                <CreditCard size={18} />
                {loading ? 'Processing…' : `Pay $${payAmount.toLocaleString()} NZD`}
            </button>

            <p className="text-[11px] text-muted text-center flex items-center justify-center gap-1.5">
                <Lock size={11} /> Payments are securely processed by Stripe. Cards and Alipay accepted.
            </p>
        </form>
    )
}
