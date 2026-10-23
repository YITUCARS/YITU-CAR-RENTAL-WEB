// Driver licence recognition with Claude on Amazon Bedrock (Sydney, data stays in Australia).
// Reads Chinese, New Zealand and Australian licences (plus licence translations and
// international permits) into the fields RCM needs, then checks them with format rules.
//
// Env: LICENCE_OCR_MODEL (Bedrock inference profile, default below), AWS_REGION.
// Credentials come from the server's IAM role; no API key is stored.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import sharp from 'sharp'

const MODEL = process.env.LICENCE_OCR_MODEL || 'au.anthropic.claude-sonnet-4-6'
const REGION = process.env.LICENCE_OCR_REGION || 'ap-southeast-2'
/** Longest image side sent to the model; licence text stays sharp well below this. */
const MAX_SIDE = 1600

let client: BedrockRuntimeClient | null = null
function bedrock() {
  return (client ??= new BedrockRuntimeClient({ region: REGION }))
}

export type LicenceDocType =
  | 'cn_licence' | 'nz_licence' | 'au_licence' | 'licence_translation' | 'international_permit'
  | 'other_licence' | 'passport' | 'not_a_licence'

export type LicenceScan = {
  documentType: LicenceDocType
  /** ISO 3166-1 alpha-2 of the issuing country, e.g. CN, NZ, AU. */
  issuingCountry: string
  /** Australian state or territory, e.g. NSW, VIC. */
  issuingState: string
  surname: string
  givenNames: string
  /** Name in the original script (Chinese licences). */
  nativeName: string
  /** Dates are YYYY-MM-DD, or empty. */
  dateOfBirth: string
  licenceNumber: string
  /** NZ version number (5b) or Australian card number. */
  cardNumber: string
  issueDate: string
  expiryDate: string
  /** Chinese licences valid for life ("长期"). */
  noExpiry: boolean
  classes: string
  address: string
  /** Fields the model could not read with confidence. */
  uncertainFields: string[]
  /** Problems for the customer or staff to fix: blurry, glare, cropped, expired, number_format, ... */
  issues: string[]
  /** Chinese licences can't be used alone in NZ; a translation or IDP is required. */
  needsTranslation: boolean
}

const FIELDS: Record<string, { type: string; description: string; enum?: string[] }> = {
  documentType: {
    type: 'string',
    enum: ['cn_licence', 'nz_licence', 'au_licence', 'licence_translation', 'international_permit', 'other_licence', 'passport', 'not_a_licence'],
    description: 'What the image shows. licence_translation = an official English translation of a licence.',
  },
  issuingCountry: { type: 'string', description: 'ISO 3166-1 alpha-2 code of the country that issued the licence.' },
  issuingState: { type: 'string', description: 'Australian state/territory code (NSW, VIC, QLD, WA, SA, TAS, ACT, NT), else empty.' },
  surname: { type: 'string', description: 'Family name in Latin letters. For Chinese names use Hanyu Pinyin in capitals, e.g. ZHANG.' },
  givenNames: { type: 'string', description: 'Given names in Latin letters. For Chinese names use Hanyu Pinyin in capitals, e.g. SAN or XIAO MING.' },
  nativeName: { type: 'string', description: 'Full name exactly as printed in Chinese characters, else empty.' },
  dateOfBirth: { type: 'string', description: 'YYYY-MM-DD or empty.' },
  licenceNumber: { type: 'string', description: 'Licence number exactly as printed, no spaces. Chinese licences: the 18-character 证号.' },
  cardNumber: { type: 'string', description: 'NZ licence version number (field 5b) or Australian card number, else empty.' },
  issueDate: { type: 'string', description: 'Issue date YYYY-MM-DD, or for Chinese licences the start of 有效期限. Empty if not shown.' },
  expiryDate: { type: 'string', description: 'Expiry date YYYY-MM-DD. Chinese licences: end of 有效期限. Empty if 长期 or not shown.' },
  noExpiry: { type: 'boolean', description: 'True when the licence says 长期 (valid indefinitely).' },
  classes: { type: 'string', description: 'Licence classes, e.g. "C1" or "1, 6".' },
  address: { type: 'string', description: 'Address as printed, else empty.' },
  uncertainFields: { type: 'array', description: 'Names of fields you could not read with certainty.' } as any,
  imageIssues: { type: 'array', description: 'Any of: blurry, glare, cropped, too_dark, not_a_licence, back_only. Empty if the image is clear.' } as any,
}

const PROMPT = `You read driver licences for a New Zealand car rental desk.
Record what is printed on the licence in the images (front first, then back if given) using the record_licence tool.
Rules:
- Copy numbers and dates exactly. Never guess a character: if one is unreadable, leave the field empty and list it in uncertainFields.
- Dates must be YYYY-MM-DD. Australian and NZ dates are printed day first.
- Do not invent fields that are not printed.`

function inputSchema() {
  const properties: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(FIELDS)) {
    properties[name] = field.type === 'array'
      ? { type: 'array', items: { type: 'string' }, description: field.description }
      : { type: field.type, description: field.description, ...(field.enum ? { enum: field.enum } : {}) }
  }
  return { type: 'object', properties, required: Object.keys(FIELDS) }
}

/** Rotates by EXIF, shrinks to MAX_SIDE and re-encodes as JPEG (also strips metadata such as GPS). */
async function prepare(image: Buffer) {
  return sharp(image).rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
}

/** Reads the licence in [front] (and [back]). Throws if Bedrock is unreachable. */
export async function scanLicence(front: Buffer, back?: Buffer | null): Promise<LicenceScan> {
  const images = await Promise.all([front, ...(back ? [back] : [])].map(prepare))
  const res = await bedrock().send(new ConverseCommand({
    modelId: MODEL,
    system: [{ text: PROMPT }],
    messages: [{
      role: 'user',
      content: [
        ...images.map(bytes => ({ image: { format: 'jpeg' as const, source: { bytes } } })),
        { text: 'Record this licence.' },
      ],
    }],
    toolConfig: {
      tools: [{ toolSpec: { name: 'record_licence', description: 'Record the licence fields.', inputSchema: { json: inputSchema() as any } } }],
      toolChoice: { tool: { name: 'record_licence' } },
    },
    inferenceConfig: { maxTokens: 1200, temperature: 0 },
  }))
  const block = res.output?.message?.content?.find(c => c.toolUse)
  const raw = (block?.toolUse?.input || {}) as Record<string, any>
  return check(raw)
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

/** Chinese resident ID / licence number: 17 digits + check character (GB 11643). */
export function validChineseIdNumber(value: string) {
  if (!/^\d{17}[\dX]$/.test(value)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const sum = weights.reduce((total, w, i) => total + w * Number(value[i]), 0)
  return '10X98765432'[sum % 11] === value[17]
}

const AU_NUMBER: Record<string, RegExp> = {
  NSW: /^[A-Z0-9]{6,8}$/, VIC: /^\d{8,10}$/, QLD: /^\d{8,9}$/, WA: /^\d{7}$/,
  SA: /^[A-Z0-9]{6}$/, TAS: /^[A-Z0-9]{6,8}$/, ACT: /^\d{1,10}$/, NT: /^\d{1,10}$/,
}

/** Normalises the model's answer and adds rule-based issues the customer or staff should look at. */
function check(raw: Record<string, any>): LicenceScan {
  const documentType = (FIELDS.documentType.enum!.includes(raw.documentType) ? raw.documentType : 'not_a_licence') as LicenceDocType
  const scan: LicenceScan = {
    documentType,
    issuingCountry: str(raw.issuingCountry).toUpperCase(),
    issuingState: str(raw.issuingState).toUpperCase(),
    surname: str(raw.surname).toUpperCase(),
    givenNames: str(raw.givenNames).toUpperCase(),
    nativeName: str(raw.nativeName),
    dateOfBirth: str(raw.dateOfBirth),
    licenceNumber: str(raw.licenceNumber).toUpperCase().replace(/\s+/g, ''),
    cardNumber: str(raw.cardNumber).toUpperCase().replace(/\s+/g, ''),
    issueDate: str(raw.issueDate),
    expiryDate: str(raw.expiryDate),
    noExpiry: raw.noExpiry === true,
    classes: str(raw.classes),
    address: str(raw.address),
    uncertainFields: list(raw.uncertainFields),
    issues: list(raw.imageIssues),
    needsTranslation: documentType === 'cn_licence',
  }
  const issues = new Set(scan.issues)

  for (const field of ['dateOfBirth', 'issueDate', 'expiryDate'] as const) {
    if (scan[field] && !isDate(scan[field])) { scan[field] = ''; scan.uncertainFields.push(field) }
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
  if (scan.expiryDate && scan.expiryDate < today) issues.add('expired')

  const n = scan.licenceNumber
  if (!n) issues.add('number_missing')
  else if (documentType === 'cn_licence' && !validChineseIdNumber(n)) issues.add('number_format')
  else if (documentType === 'nz_licence' && !/^[A-Z]{2}\d{6}$/.test(n)) issues.add('number_format')
  else if (documentType === 'au_licence' && AU_NUMBER[scan.issuingState] && !AU_NUMBER[scan.issuingState].test(n)) issues.add('number_format')
  if (documentType === 'nz_licence' && scan.cardNumber && !/^\d{3}$/.test(scan.cardNumber)) issues.add('version_format')

  // A Chinese licence number embeds the birth date (digits 7-14).
  if (documentType === 'cn_licence' && validChineseIdNumber(n) && scan.dateOfBirth) {
    const fromId = `${n.slice(6, 10)}-${n.slice(10, 12)}-${n.slice(12, 14)}`
    if (fromId !== scan.dateOfBirth) issues.add('birth_date_mismatch')
  }

  scan.uncertainFields = Array.from(new Set(scan.uncertainFields))
  scan.issues = Array.from(issues)
  return scan
}
