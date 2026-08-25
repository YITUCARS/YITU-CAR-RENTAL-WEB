const RCM_PROMO_CODE_MAP: Record<string, string> = {
  WEEKLYT: 'YITUVD77',
}

export function normalizePromoCode(code: unknown) {
  return String(code || '').trim().toUpperCase().slice(0, 32)
}

export function resolveRcmPromoCode(code: unknown) {
  const publicCode = normalizePromoCode(code)
  return RCM_PROMO_CODE_MAP[publicCode] || publicCode
}

export function isMappedPromoCode(code: unknown) {
  const publicCode = normalizePromoCode(code)
  return Boolean(publicCode && RCM_PROMO_CODE_MAP[publicCode])
}
