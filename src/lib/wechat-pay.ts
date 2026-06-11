import crypto from 'crypto'

const WECHAT_PAY_HOST = 'https://api.mch.weixin.qq.com'

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n')
}

export function getWechatPayConfig() {
  return {
    appid: required('WECHAT_PAY_APPID'),
    mchid: required('WECHAT_PAY_MCH_ID'),
    apiV3Key: required('WECHAT_PAY_API_V3_KEY'),
    privateKey: normalizePrivateKey(required('WECHAT_PAY_PRIVATE_KEY')),
    serialNo: required('WECHAT_PAY_CERT_SERIAL_NO'),
    notifyUrl: required('WECHAT_PAY_NOTIFY_URL'),
  }
}

export function randomNonce(size = 32) {
  return crypto.randomBytes(size).toString('base64url').slice(0, size)
}

export function rsaSign(message: string, privateKey: string) {
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')
}

export function buildWechatAuthorization(method: string, pathWithQuery: string, body: string) {
  const cfg = getWechatPayConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomNonce()
  const message = `${method}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = rsaSign(message, cfg.privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`
}

export async function wechatPayPost(path: string, payload: Record<string, any>) {
  const body = JSON.stringify(payload)
  const authorization = buildWechatAuthorization('POST', path, body)
  const res = await fetch(`${WECHAT_PAY_HOST}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'YITU-WeChat-MiniProgram/1.0',
    },
    body,
    cache: 'no-store',
  })

  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.code || `WeChat Pay request failed: ${res.status}`)
  }
  return data
}

export async function wechatPayGet(pathWithQuery: string) {
  const authorization = buildWechatAuthorization('GET', pathWithQuery, '')
  const res = await fetch(`${WECHAT_PAY_HOST}${pathWithQuery}`, {
    method: 'GET',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'User-Agent': 'YITU-WeChat-MiniProgram/1.0',
    },
    cache: 'no-store',
  })

  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.code || `WeChat Pay request failed: ${res.status}`)
  }
  return data
}

export function buildMiniProgramPayment(prepayId: string) {
  const cfg = getWechatPayConfig()
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomNonce()
  const packageValue = `prepay_id=${prepayId}`
  const message = `${cfg.appid}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`
  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign: rsaSign(message, cfg.privateKey),
  }
}

export function decryptWechatPayResource(resource: any) {
  const cfg = getWechatPayConfig()
  const ciphertext = Buffer.from(String(resource?.ciphertext || ''), 'base64')
  const nonce = String(resource?.nonce || '')
  const aad = Buffer.from(String(resource?.associated_data || ''))
  const authTag = ciphertext.subarray(ciphertext.length - 16)
  const data = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(cfg.apiV3Key), nonce)
  decipher.setAuthTag(authTag)
  decipher.setAAD(aad)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(decrypted)
}
