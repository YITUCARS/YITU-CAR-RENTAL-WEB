import crypto from 'crypto'
import http2 from 'http2'

// Apple Push Notification service (token-based auth, HTTP/2).
// Env: APNS_KEY_P8 (contents of AuthKey_<id>.p8), APNS_KEY_ID, APNS_TEAM_ID,
//      APNS_TOPIC (the app's bundle id, YITU Lite device builds: com.yitu.staffapp).

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const

export type ApnsEnvironment = keyof typeof HOSTS

export type ApnsMessage = {
  title: string
  body: string
  /** Extra keys delivered with the notification (e.g. booking ref for deep links). */
  data?: Record<string, string>
  threadId?: string
}

export type ApnsResult = { token: string; ok: boolean; status: number; reason?: string }

let jwtCache: { value: string; at: number } | null = null
const sessions = new Map<string, http2.ClientHttp2Session>()

function config() {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const topic = process.env.APNS_TOPIC
  // fetch-secrets.sh writes newlines in SSM values as a literal "\n".
  const key = process.env.APNS_KEY_P8?.replace(/\\n/g, '\n')
  if (!keyId || !teamId || !topic || !key) return null
  return { keyId, teamId, topic, key }
}

export function isApnsConfigured() {
  return config() !== null
}

/** Provider token; Apple accepts one for up to an hour, so it's reused for 50 minutes. */
function providerToken(cfg: NonNullable<ReturnType<typeof config>>) {
  if (jwtCache && Date.now() - jwtCache.at < 50 * 60 * 1000) return jwtCache.value
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'ES256', kid: cfg.keyId })}.${encode({ iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) })}`
  const signature = crypto.sign('sha256', Buffer.from(unsigned), { key: cfg.key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  jwtCache = { value: `${unsigned}.${signature}`, at: Date.now() }
  return jwtCache.value
}

function session(host: string) {
  const existing = sessions.get(host)
  if (existing && !existing.closed && !existing.destroyed) return existing
  const created = http2.connect(host)
  created.on('error', () => sessions.delete(host))
  created.on('close', () => sessions.delete(host))
  // Don't keep the process busy between batches.
  created.setTimeout(5 * 60 * 1000, () => created.close())
  sessions.set(host, created)
  return created
}

function sendOne(host: string, headers: Record<string, string>, body: string, token: string): Promise<ApnsResult> {
  return new Promise(resolve => {
    let status = 0
    let data = ''
    const request = session(host).request({ ':method': 'POST', ':path': `/3/device/${token}`, ...headers })
    request.setEncoding('utf8')
    request.on('response', response => { status = Number(response[':status']) })
    request.on('data', chunk => { data += chunk })
    request.on('end', () => {
      let reason: string | undefined
      try { reason = data ? JSON.parse(data).reason : undefined } catch { reason = data }
      resolve({ token, ok: status === 200, status, reason })
    })
    request.on('error', error => resolve({ token, ok: false, status: 0, reason: error.message }))
    request.setTimeout(15000, () => { request.close(); resolve({ token, ok: false, status: 0, reason: 'timeout' }) })
    request.end(body)
  })
}

/** Sends one alert to many devices of the same environment. */
export async function sendApns(environment: ApnsEnvironment, tokens: string[], message: ApnsMessage): Promise<ApnsResult[]> {
  const cfg = config()
  if (!cfg || tokens.length === 0) return []
  const body = JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
      ...(message.threadId ? { 'thread-id': message.threadId } : {}),
    },
    ...(message.data || {}),
  })
  const headers = {
    authorization: `bearer ${providerToken(cfg)}`,
    'apns-topic': cfg.topic,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'content-type': 'application/json',
  }
  return Promise.all(tokens.map(token => sendOne(HOSTS[environment], headers, body, token)))
}

/** Apple's reasons that mean the token will never work again. */
export function isDeadToken(result: ApnsResult) {
  return result.status === 410 || result.reason === 'BadDeviceToken' || result.reason === 'Unregistered' || result.reason === 'DeviceTokenNotForTopic'
}
