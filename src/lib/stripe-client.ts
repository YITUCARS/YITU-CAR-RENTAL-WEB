// The /pure entry only adds Stripe.js to the page when loadStripe() is first
// called. The default entry injects it on import, which puts Stripe's
// m.stripe.network frame on every page; the WeChat mini program's web-view
// refuses to open pages that frame a domain it has not whitelisted.
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'

// Which Stripe environment the browser talks to. Mirror this on the server with
// STRIPE_LIVE_SECRET_KEY / STRIPE_TEST_SECRET_KEY.
export const STRIPE_MODE: 'live' | 'test' =
    (process.env.NEXT_PUBLIC_STRIPE_MODE || 'live').toLowerCase() === 'test'
        ? 'test'
        : 'live'

function publishableKey(): string {
    const key =
        STRIPE_MODE === 'live'
            ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY
            : process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
    return key || ''
}

// loadStripe must be called once and reused — never inside render.
let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
    if (!stripePromise) {
        stripePromise = loadStripe(publishableKey())
    }
    return stripePromise
}
