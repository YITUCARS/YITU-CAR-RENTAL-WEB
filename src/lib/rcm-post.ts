// RCM Post Booking API. Docs: support.rentalcarmanager.com → Developer's Support → Post Booking API.
// 1. POST https://api.rentalcarmanager.com/v32/token (form: username=<api key>, password=<shared secret>,
//    grant_type=password) → access_token, valid ~30 minutes.
// 2. POST https://api.rentalcarmanager.com/v32/api with `Authorization: Bearer <token>` and a JSON body
//    `{ method, ...params }`. Responses are `{ status: 'OK' | 'ERR', error, results }`.
// Uses the same key pair as the booking API (RCM_API_KEY / RCM_SHARED_SECRET).

const POST_BOOKING_HOST = 'https://api.rentalcarmanager.com/v32'
const TOKEN_REUSE_MS = 1000 * 60 * 25

let token: { value: string; at: number } | null = null
let tokenRequest: Promise<string> | null = null

async function requestToken() {
    const apiKey = process.env.RCM_API_KEY
    const secret = process.env.RCM_SHARED_SECRET
    if (!apiKey || !secret) throw new Error('RCM_API_KEY / RCM_SHARED_SECRET are not configured.')

    const res = await fetch(`${POST_BOOKING_HOST}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: apiKey, password: secret, grant_type: 'password' }),
        cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) {
        throw new Error(`RCM post-booking token failed: ${res.status} ${data.error_description || data.error || ''}`.trim())
    }
    return data.access_token as string
}

async function getToken(forceNew = false) {
    if (!forceNew && token && Date.now() - token.at < TOKEN_REUSE_MS) return token.value
    if (!tokenRequest) {
        tokenRequest = requestToken()
            .then(value => {
                token = { value, at: Date.now() }
                return value
            })
            .finally(() => { tokenRequest = null })
    }
    return tokenRequest
}

export async function rcmPostBooking(method: string, params: Record<string, any> = {}) {
    const send = async (bearer: string) => fetch(`${POST_BOOKING_HOST}/api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ method, ...params }),
        cache: 'no-store',
    })

    let res = await send(await getToken())
    if (res.status === 401) res = await send(await getToken(true)) // token expired early
    if (!res.ok) throw new Error(`RCM ${method} failed: ${res.status}`)

    const data = await res.json()
    if (data.status === 'ERR') throw new Error(`RCM ${method} error: ${data.error}`)
    return data.results
}

export type SignatureSlot = {
    customerId: number
    templateId: number
    templateTitle: string
    isSigned: boolean
    /** RCM's local time, e.g. "20-Oct-2026 12:39" — set when signed online or at the counter. */
    signedAt: string
    /** Base64 PNG of the saved signature (no data: prefix), when signed. */
    pngSignature: string
    agreementUrl: string
}

/** Signatures RCM expects for a booking (one per driver × signature template). */
export async function rcmSignatureList(reservationRef: string): Promise<SignatureSlot[]> {
    const rows = await rcmPostBooking('signaturelist', { reservationref: reservationRef })
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        customerId: Number(row.customerid),
        templateId: Number(row.signaturetemplateid ?? 0),
        templateTitle: String(row.signaturetemplatetitle || '').trim(),
        isSigned: Boolean(row.issigned),
        signedAt: String(row.signeddatetime || ''),
        pngSignature: String(row.pngsig || ''),
        agreementUrl: String(row.linktoagreement || ''),
    }))
}

/**
 * Saves a signature against the booking. `signatureJson` is the jquery.signature.js format:
 * `{"lines":[[[x,y],[x,y],…],…]}`.
 */
export async function rcmSaveSignature(params: {
    reservationRef: string
    templateId: number
    signatureJson: string
}) {
    return rcmPostBooking('savesignature', {
        reservationref: params.reservationRef,
        signaturetemplateid: params.templateId,
        signaturejson: params.signatureJson,
    })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2030-01-02` → `02/Jan/2030`, the format RCM returns in customerinfo. */
function rcmLongDate(iso: string) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return match ? `${match[3]}/${MONTHS[Number(match[2]) - 1]}/${match[1]}` : ''
}

function feeSignature(results: any) {
    const fees: any[] = results?.extrafees || []
    return {
        total: Number(results?.bookinginfo?.[0]?.totalcost ?? 0),
        fees: fees.map(fee => `${fee.extrafeeid}x${fee.qty}`).sort().join(','),
    }
}

/**
 * RCM only updates customer / booking details through `editbooking`, which also replaces the
 * booking's insurance, km option and optional fees with whatever is sent — anything omitted is
 * removed. So the booking's current options and customer are resent unchanged with only
 * [changes] applied, then the booking is re-read and this fails loudly if the total or the fee
 * list moved.
 */
async function editBookingKeepingFees(
    reservationRef: string,
    changes: { customer?: Record<string, any>; booking?: Record<string, any> },
) {
    const before = await rcmPostBooking('bookinginfo', { reservationref: reservationRef })
    const info = before?.bookinginfo?.[0]
    const customer = before?.customerinfo?.[0]
    if (!info || !customer) throw new Error('Booking not found in RCM.')

    const fees: any[] = before.extrafees || []
    const insurance = fees.find(fee => fee.isinsurancefee)
    const optionalfees = fees
        .filter(fee => fee.isoptionalfee && !fee.isinsurancefee)
        .map(fee => ({ id: Number(fee.extrafeeid), qty: Number(fee.qty) || 1 }))
    const mandatoryfees = fees
        .filter(fee => !fee.isoptionalfee && !fee.isinsurancefee)
        .map(fee => ({ id: Number(fee.extrafeeid), qty: Number(fee.qty) || 1 }))

    await rcmPostBooking('editbooking', {
        reservationref: reservationRef,
        bookingtype: info.isquotation ? 1 : 2,
        insuranceid: insurance ? Number(insurance.extrafeeid) : 0,
        extrakmsid: Number(info.kmcharges_id || 0),
        transmission: Number(info.transmission || 0),
        optionalfees,
        mandatoryfees,
        UpdateMandatoryFees: 2, // leave mandatory fees exactly as they are
        ...changes.booking,
        customer: {
            // Existing details are sent back unchanged so they aren't cleared.
            customerid: Number(customer.customerid),
            firstname: customer.firstname || '',
            lastname: customer.lastname || '',
            email: customer.email || '',
            phone: customer.phone || '',
            mobile: customer.mobile || '',
            dateofbirth: customer.dateofbirth || '',
            address: customer.address || '',
            city: customer.city || '',
            state: customer.state || '',
            postcode: customer.postcode || '',
            countryid: Number(customer.countryid || 0),
            passport: customer.passport || '',
            licenseissued: customer.licenseissued || '',
            licenseno: customer.licenseno || '',
            licenseexpires: customer.licenseexpires || '',
            ...changes.customer,
        },
    })

    const after = await rcmPostBooking('bookinginfo', { reservationref: reservationRef })
    const was = feeSignature(before), now = feeSignature(after)
    if (was.total !== now.total || was.fees !== now.fees) {
        throw new Error(`Saved, but RCM changed the booking (total ${was.total} → ${now.total}, fees ${was.fees} → ${now.fees}). Check the booking in RCM.`)
    }
    return { before, after }
}

/** Writes the hirer's driver licence back to RCM so it shows on the rental agreement. */
export async function rcmUpdateDriverLicence(params: {
    reservationRef: string
    licenseNo: string
    licenseExpires?: string // YYYY-MM-DD
    licenseIssued?: string  // country / state that issued the licence
}) {
    const expires = rcmLongDate(params.licenseExpires || '')
    const { after } = await editBookingKeepingFees(params.reservationRef, {
        customer: {
            licenseno: params.licenseNo,
            ...(params.licenseIssued?.trim() ? { licenseissued: params.licenseIssued.trim() } : {}),
            ...(expires ? { licenseexpires: expires } : {}),
        },
    })
    const saved = String(after?.customerinfo?.[0]?.licenseno || '').trim()
    if (saved !== params.licenseNo.trim()) throw new Error('RCM did not store the licence number.')
    return {
        licenseNo: saved,
        licenseExpires: after?.customerinfo?.[0]?.licenseexpires || '',
        licenseIssued: after?.customerinfo?.[0]?.licenseissued || '',
    }
}

/** Saves the customer's arrival flight number on the booking (RCM `flightin`). */
export async function rcmUpdateFlight(reservationRef: string, flightNumber: string) {
    const { after } = await editBookingKeepingFees(reservationRef, { booking: { flightin: flightNumber } })
    const saved = String(after?.bookinginfo?.[0]?.flightin || '').trim()
    if (saved.toUpperCase() !== flightNumber.toUpperCase()) throw new Error('RCM did not store the flight number.')
    return saved
}

export type ExtraDriverInput = {
    firstName: string
    lastName: string
    dateOfBirth?: string   // YYYY-MM-DD
    email?: string
    phone?: string
    licenseNo?: string
    licenseExpires?: string // YYYY-MM-DD
    licenseIssued?: string
}

/**
 * Adds (customerId 0) or updates an additional driver on the booking. Fields must be wrapped in
 * a `customer` object — flat fields are silently ignored and an empty driver gets created —
 * so a name is required before calling RCM at all.
 */
export async function rcmSaveExtraDriver(reservationRef: string, customerId: number, driver: ExtraDriverInput) {
    const firstName = driver.firstName.trim(), lastName = driver.lastName.trim()
    if (!firstName || !lastName) throw new Error('Additional driver needs a first and last name.')

    const results = await rcmPostBooking('extradriver', {
        reservationref: reservationRef,
        customerid: customerId,
        customer: {
            firstname: firstName,
            lastname: lastName,
            dateofbirth: rcmLongDate(driver.dateOfBirth || ''),
            email: driver.email?.trim() || '',
            mobile: driver.phone?.trim() || '',
            phone: driver.phone?.trim() || '',
            licenseno: driver.licenseNo?.trim() || '',
            licenseexpires: rcmLongDate(driver.licenseExpires || ''),
            licenseissued: driver.licenseIssued?.trim() || '',
        },
    })
    const savedId = Number(results?.customerid || customerId)
    const saved = (results?.extradrivers || []).find((row: any) => Number(row.customerid) === savedId)
    if (!saved) throw new Error('RCM did not return the saved additional driver.')
    if ((driver.licenseNo?.trim() || '') !== String(saved.licenseno || '').trim()) {
        throw new Error('RCM did not store the additional driver licence.')
    }
    return { customerId: savedId }
}

/** Removes an additional driver (RCM: negative customer id). */
export async function rcmRemoveExtraDriver(reservationRef: string, customerId: number) {
    if (!(customerId > 0)) throw new Error('A saved additional driver id is required.')
    await rcmPostBooking('extradriver', { reservationref: reservationRef, customerid: -customerId })
}
