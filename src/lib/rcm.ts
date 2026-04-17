import crypto from 'crypto'

function getBaseUrl() {
    return `https://apis.rentalcarmanager.com/booking/v3.2/?apikey=${process.env.RCM_API_KEY}`
}

function createSignature(body: string): string {
    return crypto
        .createHmac('sha256', process.env.RCM_SHARED_SECRET!)
        .update(body)
        .digest('hex')
        .toUpperCase()
}

async function postToRCM(bodyObj: Record<string, any>) {
    const body = JSON.stringify(bodyObj)
    const signature = createSignature(body)

    const res = await fetch(getBaseUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'signature': signature,
        },
        body,
    })

    if (!res.ok) throw new Error(`RCM API call failed: ${res.status}`)
    const data = await res.json()
    if (data.status === 'ERR') throw new Error(`RCM error: ${data.error}`)
    return data.results
}

export async function rcmStep1() {
    return postToRCM({ method: 'step1' })
}

export async function rcmSearch(params: {
    pickupLocationId: number
    dropoffLocationId: number
    pickupDate: string
    pickupTime: string
    dropoffDate: string
    dropoffTime: string
    campaignCode?: string
    vehicleCategoryTypeId?: number
    ageId?: number
}) {
    return postToRCM({
        method: 'step2',
        vehiclecategorytypeid: String(params.vehicleCategoryTypeId ?? 0),
        pickuplocationid: params.pickupLocationId,
        pickupdate: params.pickupDate,
        pickuptime: params.pickupTime,
        dropofflocationid: params.dropoffLocationId,
        dropoffdate: params.dropoffDate,
        dropofftime: params.dropoffTime,
        ageid: params.ageId ?? 9,
        campaigncode: params.campaignCode ?? '',
    })
}

export async function rcmSaveCustomer(params: {
    firstName: string
    lastName: string
    email: string
    phone: string
}) {
    return postToRCM({
        method: 'savecustomer',
        firstname: params.firstName,
        lastname: params.lastName,
        email: params.email,
        phone1: params.phone,
    })
}

export async function rcmMakeBooking(params: {
    customerId: number
    vehicleCategoryId: number
    pickupLocationId: number
    dropoffLocationId: number
    pickupDate: string
    pickupTime: string
    dropoffDate: string
    dropoffTime: string
    flightNumber?: string
    notes?: string
}) {
    return postToRCM({
        method: 'makebooking',
        customerid: params.customerId,
        vehiclecategoryid: params.vehicleCategoryId,
        pickuplocationid: params.pickupLocationId,
        dropofflocationid: params.dropoffLocationId,
        pickupdate: params.pickupDate,
        pickuptime: params.pickupTime,
        dropoffdate: params.dropoffDate,
        dropofftime: params.dropoffTime,
        flightin: params.flightNumber || '',
        remark: params.notes || '',
        ageid: 9,
    })
}

export const LOCATION_IDS: Record<string, number> = {
    'Christchurch': 1,
    'Queenstown': 7,
    'Auckland': 8,
}
export async function rcmStep3(params: {
    vehicleCategoryTypeId: number
    vehicleCategoryId: number
    pickupLocationId: number
    dropoffLocationId: number
    pickupDate: string
    pickupTime: string
    dropoffDate: string
    dropoffTime: string
    campaignCode?: string
    ageId?: number
}) {
    return postToRCM({
        method: 'step3',
        vehiclecategorytypeid: params.vehicleCategoryTypeId,
        vehiclecategoryid: params.vehicleCategoryId,
        pickuplocationid: params.pickupLocationId,
        pickupdate: params.pickupDate,
        pickuptime: params.pickupTime,
        dropofflocationid: params.dropoffLocationId,
        dropoffdate: params.dropoffDate,
        dropofftime: params.dropoffTime,
        ageid: params.ageId ?? 9,
        campaigncode: params.campaignCode ?? '',
    })
}
export function toRCMDate(date: string): string {
    if (!date) return ''
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
}

export async function rcmCall(method: string, params: Record<string, any> = {}) {
    return postToRCM({ method, ...params })
}

export async function rcmCreatePaymentTransaction(params: {
    reservationRef: string
    paymentGatewayType: string
    transactionType: string
    amount: number
    payScenario?: number
    paySource?: string
}) {
    return postToRCM({
        method: 'createpaymenttransaction',
        paymentgatewaytype: params.paymentGatewayType,
        reservationref: params.reservationRef,
        transactiontype: params.transactionType,
        amount: params.amount,
        payscenario: params.payScenario ?? 1,
        paysource: params.paySource ?? 'YITU Web Booking',
    })
}

export async function rcmConfirmPayment(params: {
    reservationRef: string
    amount: number
    success: boolean
    payType: string
    payDate: string
    supplierId: number
    transactId?: string
    dpsTxnRef?: string
    cardHolder?: string
    paySource?: string
}) {
    return postToRCM({
        method: 'confirmpayment',
        reservationref: params.reservationRef,
        amount: params.amount,
        success: params.success,
        paytype: params.payType,
        paydate: params.payDate,
        supplierid: params.supplierId,
        transactid: params.transactId ?? '',
        dpstxnref: params.dpsTxnRef ?? '',
        cardholder: params.cardHolder ?? '',
        paysource: params.paySource ?? 'YITU Web Booking',
        payscenario: 1,
        emailoption: 1,
    })
}
