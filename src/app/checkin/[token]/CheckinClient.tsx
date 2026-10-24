'use client'

import { useEffect, useMemo, useState } from 'react'

type Lang = 'en' | 'zh'
type PhotoKey = 'licenseFront' | 'licenseBack' | 'passport' | 'translation'

type Loaded = {
  submittedAt: string | null
  photos: string[]
  booking: {
    reservationNo: string; vehicle: string
    pickupDate: string; pickupTime: string; pickupLocation: string
    dropoffDate: string; dropoffTime: string; dropoffLocation: string
  }
  details: Record<string, string>
}

const T = {
  title: { en: 'Online check-in', zh: '在线办理取车' },
  intro: {
    en: 'Confirm your details and upload your driver licence now, and collecting your car takes just a few minutes.',
    zh: '提前核对信息、上传驾照，到店取车只需几分钟。',
  },
  booking: { en: 'Booking', zh: '订单' },
  vehicle: { en: 'Vehicle', zh: '车型' },
  pickup: { en: 'Pick up', zh: '取车' },
  return: { en: 'Return', zh: '还车' },
  you: { en: 'Your details', zh: '个人信息' },
  name: { en: 'Name', zh: '姓名' },
  email: { en: 'Email', zh: '邮箱' },
  mobile: { en: 'Mobile', zh: '手机号' },
  mobileHint: { en: 'With country code, e.g. +86 138…', zh: '请带国家区号，如 +86 138…' },
  dob: { en: 'Date of birth', zh: '出生日期' },
  address: { en: 'Home address', zh: '住址' },
  city: { en: 'City', zh: '城市' },
  postcode: { en: 'Postcode', zh: '邮编' },
  licence: { en: 'Driver licence', zh: '驾照' },
  country: { en: 'Issued in', zh: '签发国家/地区' },
  state: { en: 'State', zh: '州' },
  issuedBy: { en: 'Issuing country', zh: '签发国家' },
  licenceNo: { en: 'Licence number', zh: '驾照号码' },
  expiry: { en: 'Expiry date', zh: '有效期至' },
  front: { en: 'Licence – front', zh: '驾照正面' },
  back: { en: 'Licence – back', zh: '驾照背面' },
  translation: { en: 'Translation or IDP', zh: '驾照翻译件或国际驾照' },
  translationHint: {
    en: 'A Chinese licence must be used with an approved English translation (NZTA) or an International Driving Permit.',
    zh: '中国驾照需配合新西兰认可的英文翻译件或国际驾照使用。',
  },
  passport: { en: 'Passport', zh: '护照' },
  passportNo: { en: 'Passport number', zh: '护照号码' },
  passportPhoto: { en: 'Passport photo page', zh: '护照照片页' },
  optional: { en: 'Optional', zh: '选填' },
  flight: { en: 'Arrival flight', zh: '到达航班' },
  flightNo: { en: 'Flight number', zh: '航班号' },
  flightHint: { en: 'So we can track delays, e.g. NZ677', zh: '方便我们跟踪延误，如 NZ677' },
  terms: { en: 'Terms', zh: '条款' },
  agree: { en: 'I have read and agree to the', zh: '我已阅读并同意' },
  termsLink: { en: 'rental terms and conditions', zh: '租车条款' },
  signName: { en: 'Type your full name to sign', zh: '输入您的全名作为签名' },
  takePhoto: { en: 'Photo or PDF', zh: '拍照/上传' },
  uploading: { en: 'Uploading…', zh: '上传中…' },
  uploadFailed: { en: 'Not uploaded – tap to retry', zh: '上传失败，点此重试' },
  tooLarge: { en: 'That file is larger than 10 MB.', zh: '文件超过 10MB，请换一个。' },
  waitUploads: { en: 'Please wait for your files to finish uploading.', zh: '请等文件上传完成。' },
  retake: { en: 'Change', zh: '更换' },
  onFile: { en: 'Received', zh: '已收到' },
  submit: { en: 'Complete check-in', zh: '完成办理' },
  submitting: { en: 'Uploading…', zh: '正在上传…' },
  required: { en: 'Please complete the highlighted fields.', zh: '请完成标红的项目。' },
  doneTitle: { en: "You're checked in", zh: '已完成在线办理' },
  doneBody: {
    en: 'Thank you. Please bring your original driver licence (and translation or IDP if needed) when you collect the car.',
    zh: '谢谢！取车时请携带驾照原件（如需要，另带翻译件或国际驾照）。',
  },
  edit: { en: 'Edit my details', zh: '修改信息' },
  loading: { en: 'Loading your booking…', zh: '正在加载订单…' },
  help: { en: 'Questions? Call +64 27 3922666 or reply to the email.', zh: '有疑问请致电 +64 27 3922666，或直接回复邮件。' },
} satisfies Record<string, Record<Lang, string>>

const COUNTRIES = [
  { code: 'NZ', en: 'New Zealand', zh: '新西兰' },
  { code: 'AU', en: 'Australia', zh: '澳大利亚' },
  { code: 'CN', en: 'China (Mainland)', zh: '中国大陆' },
  { code: 'OTHER', en: 'Other', zh: '其他' },
]
const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

type FileState = { name: string; preview?: string; status: 'uploading' | 'done' | 'error' }

/** PDFs are sent as they are (up to 10 MB). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Shrinks a photo to at most 1600px and returns JPEG base64 (keeps uploads small on mobile data). */
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** "Australia NSW" ⇄ country + state, for licences already recorded in RCM. */
function splitIssued(issued: string) {
  const value = issued.trim()
  const state = AU_STATES.find(s => new RegExp(`\\b${s}\\b`, 'i').test(value))
  if (state || /australia/i.test(value)) return { country: 'AU', state: state || '', other: '' }
  if (/new zealand|^nz$/i.test(value)) return { country: 'NZ', state: '', other: '' }
  if (/china|中国|^cn$/i.test(value)) return { country: 'CN', state: '', other: '' }
  return { country: value ? 'OTHER' : '', state: '', other: value }
}

export default function CheckinClient({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>('en')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [country, setCountry] = useState('')
  const [auState, setAuState] = useState('')
  const [files, setFiles] = useState<Partial<Record<PhotoKey, FileState>>>({})
  // Uploads run one after another (each is a separate request, kept small for mobile data).
  const [queue] = useState(() => ({ last: Promise.resolve() as Promise<unknown> }))
  const [agreed, setAgreed] = useState(false)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const t = (key: keyof typeof T) => T[key][lang]

  useEffect(() => {
    if (navigator.language?.toLowerCase().startsWith('zh')) setLang('zh')
    fetch(`/api/checkin/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then((json) => {
        if (!json.success) { setLoadError(json.error || 'This link is not valid.'); return }
        setLoaded(json)
        setForm(json.details)
        const split = splitIssued(json.details.licenseIssued || '')
        setCountry(json.details.licenseCountry || split.country)
        setAuState(split.state)
        if (split.country === 'OTHER') setForm(f => ({ ...f, licenseIssued: split.other }))
        setDone(Boolean(json.submittedAt))
      })
      .catch(() => setLoadError('Could not load your booking. Please try again.'))
  }, [token])

  const onFile = (key: PhotoKey) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (isPdf && file.size > 10 * 1024 * 1024) { setError(t('tooLarge')); return }
    let data: string
    try {
      data = isPdf ? await readAsDataUrl(file) : await compress(file)
    } catch {
      setError(lang === 'zh' ? '这个文件无法读取，请换一个。' : 'That file could not be read. Please try another.')
      return
    }
    setFiles(f => ({ ...f, [key]: { name: file.name, preview: isPdf ? undefined : data, status: 'uploading' } }))
    setMissing(m => { const next = new Set(m); next.delete(key); return next })

    const upload = async () => {
      try {
        const res = await fetch(`/api/checkin/${encodeURIComponent(token)}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, data }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        setLoaded(l => l && { ...l, photos: json.photos })
        setFiles(f => ({ ...f, [key]: { ...f[key]!, status: 'done' } }))
      } catch (err: any) {
        setFiles(f => ({ ...f, [key]: { ...f[key]!, status: 'error' } }))
        if (err?.message) setError(err.message)
      }
    }
    queue.last = queue.last.then(upload)
  }

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setForm(f => ({ ...f, [key]: value }))
    setMissing(m => { if (!m.has(key)) return m; const next = new Set(m); next.delete(key); return next })
  }

  const issued = useMemo(() => {
    if (country === 'NZ') return 'New Zealand'
    if (country === 'CN') return 'China'
    if (country === 'AU') return auState ? `Australia ${auState}` : ''
    return form.licenseIssued || ''
  }, [country, auState, form.licenseIssued])

  const has = (key: PhotoKey) => Boolean(loaded?.photos.includes(key)) && files[key]?.status !== 'error'
  const uploading = Object.values(files).some(f => f?.status === 'uploading')

  async function submit() {
    setError('')
    if (uploading) { setError(t('waitUploads')); return }
    const need = new Set<string>()
    if (!form.mobile?.trim()) need.add('mobile')
    if (!form.dateOfBirth) need.add('dateOfBirth')
    if (!country || !issued) need.add('licenseIssued')
    if (!form.licenseNo?.trim()) need.add('licenseNo')
    if (!form.licenseExpires) need.add('licenseExpires')
    if (!has('licenseFront')) need.add('licenseFront')
    if (!has('licenseBack')) need.add('licenseBack')
    if (country === 'CN' && !has('translation')) need.add('translation')
    if (!agreed || !form.agreedName?.trim()) need.add('agreed')
    setMissing(need)
    if (need.size) { setError(t('required')); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkin/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, licenseCountry: country, licenseIssued: issued, agreed }),
      })
      const json = await res.json()
      if (!json.success) {
        if (Array.isArray(json.fields)) setMissing(new Set(json.fields))
        setError(json.error || 'Something went wrong. Please try again.')
        return
      }
      setLoaded(l => l && { ...l, submittedAt: json.submittedAt })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError(lang === 'zh' ? '网络不稳定，请重试。' : 'Connection problem. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
        <img src="/YITU_CAR_RENTAL_Logo.png" alt="YITU Car Rental" className="h-8 w-auto brightness-0 invert" />
        <button
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="rounded-full px-3 py-1 text-sm font-medium text-white/90 hover:bg-white/10"
        >
          {lang === 'en' ? '中文' : 'English'}
        </button>
      </div>
    </header>
  )

  if (loadError) {
    return (
      <main className="min-h-screen bg-off-white font-dm">
        {header}
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-lg font-semibold text-navy">{loadError}</p>
          <p className="mt-3 text-sm text-muted">{t('help')}</p>
        </div>
      </main>
    )
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-off-white font-dm">
        {header}
        <p className="py-16 text-center text-muted">{t('loading')}</p>
      </main>
    )
  }

  const b = loaded.booking
  const summary = (
    <section className="mx-auto max-w-xl px-4 pt-6">
      <h1 className="font-syne text-2xl font-bold text-navy">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('intro')}</p>
      <dl className="mt-5 divide-y divide-slate-100 rounded-card bg-white px-4 shadow-card">
        <Row label={t('booking')} value={`#${b.reservationNo}`} />
        <Row label={t('vehicle')} value={b.vehicle} />
        <Row label={t('pickup')} value={`${b.pickupDate} ${b.pickupTime} · ${b.pickupLocation}`} />
        <Row label={t('return')} value={`${b.dropoffDate} ${b.dropoffTime} · ${b.dropoffLocation}`} />
      </dl>
    </section>
  )

  if (done) {
    return (
      <main className="min-h-screen bg-off-white pb-16 font-dm">
        {header}
        {summary}
        <section className="mx-auto max-w-xl px-4 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white">✓</div>
          <h2 className="mt-4 font-syne text-xl font-bold text-navy">{t('doneTitle')}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{t('doneBody')}</p>
          <button onClick={() => setDone(false)} className="mt-6 text-sm font-semibold text-orange">{t('edit')}</button>
          <p className="mt-10 text-xs text-muted">{t('help')}</p>
        </section>
      </main>
    )
  }

  const fieldClass = (key: string) => missing.has(key) ? 'text-orange' : 'text-muted'

  return (
    <main className="min-h-screen overflow-x-hidden bg-off-white pb-28 font-dm">
      {header}
      {summary}

      <Section title={t('you')}>
        <Row label={t('name')} value={`${form.firstName || ''} ${form.lastName || ''}`.trim()} />
        <Row label={t('email')} value={form.email || ''} />
        <Field label={t('mobile')} className={fieldClass('mobile')}>
          <input type="tel" autoComplete="tel" value={form.mobile || ''} onChange={set('mobile')} placeholder={t('mobileHint')} className={inputClass} />
        </Field>
        <Field label={t('dob')} className={fieldClass('dateOfBirth')}>
          <input type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} className={inputClass} />
        </Field>
        <Field label={t('address')} className="text-muted">
          <input autoComplete="street-address" value={form.address || ''} onChange={set('address')} className={inputClass} />
        </Field>
        <Field label={t('city')} className="text-muted">
          <input autoComplete="address-level2" value={form.city || ''} onChange={set('city')} className={inputClass} />
        </Field>
        <Field label={t('postcode')} className="text-muted">
          <input autoComplete="postal-code" value={form.postcode || ''} onChange={set('postcode')} className={inputClass} />
        </Field>
      </Section>

      <Section title={t('licence')}>
        <Field label={t('country')} className={fieldClass('licenseIssued')}>
          <select value={country} onChange={e => { setCountry(e.target.value); setMissing(m => { const n = new Set(m); n.delete('licenseIssued'); return n }) }} className={inputClass}>
            <option value="">—</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c[lang]}</option>)}
          </select>
        </Field>
        {country === 'AU' && (
          <Field label={t('state')} className={fieldClass('licenseIssued')}>
            <select value={auState} onChange={e => setAuState(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        )}
        {country === 'OTHER' && (
          <Field label={t('issuedBy')} className={fieldClass('licenseIssued')}>
            <input value={form.licenseIssued || ''} onChange={set('licenseIssued')} className={inputClass} />
          </Field>
        )}
        <Field label={t('licenceNo')} className={fieldClass('licenseNo')}>
          <input value={form.licenseNo || ''} onChange={set('licenseNo')} autoCapitalize="characters" className={inputClass} />
        </Field>
        <Field label={t('expiry')} className={fieldClass('licenseExpires')}>
          <input type="date" value={form.licenseExpires || ''} onChange={set('licenseExpires')} className={inputClass} />
        </Field>
        <Photo label={t('front')} file={files.licenseFront} onFile={has('licenseFront')} missing={missing.has('licenseFront')} onChange={onFile('licenseFront')} t={t} />
        <Photo label={t('back')} file={files.licenseBack} onFile={has('licenseBack')} missing={missing.has('licenseBack')} onChange={onFile('licenseBack')} t={t} />
        {country === 'CN' && (
          <>
            <p className="py-3 text-xs leading-relaxed text-muted">{t('translationHint')}</p>
            <Photo label={t('translation')} file={files.translation} onFile={has('translation')} missing={missing.has('translation')} onChange={onFile('translation')} t={t} />
          </>
        )}
      </Section>

      <Section title={t('passport')} note={t('optional')}>
        <Field label={t('passportNo')} className="text-muted">
          <input value={form.passport || ''} onChange={set('passport')} autoCapitalize="characters" className={inputClass} />
        </Field>
        <Photo label={t('passportPhoto')} file={files.passport} onFile={has('passport')} missing={false} onChange={onFile('passport')} t={t} />
      </Section>

      <Section title={t('flight')} note={t('optional')}>
        <Field label={t('flightNo')} className="text-muted">
          <input value={form.flightIn || ''} onChange={set('flightIn')} placeholder={t('flightHint')} autoCapitalize="characters" className={inputClass} />
        </Field>
      </Section>

      <Section title={t('terms')}>
        <label className={`flex items-start gap-3 py-3 text-sm ${missing.has('agreed') && !agreed ? 'text-orange' : 'text-navy'}`}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#e8431a]" />
          <span>{t('agree')} <a href="/terms-conditions" target="_blank" className="font-semibold underline">{t('termsLink')}</a></span>
        </label>
        <Field label={t('signName')} className={missing.has('agreed') && !form.agreedName?.trim() ? 'text-orange' : 'text-muted'}>
          <input value={form.agreedName || ''} onChange={set('agreedName')} autoComplete="name" className={inputClass} />
        </Field>
      </Section>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3">
          {error && <p className="mb-2 text-center text-sm text-orange">{error}</p>}
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-sm bg-orange py-3.5 font-semibold text-white shadow-orange-glow transition hover:bg-orange-dark disabled:opacity-60"
          >
            {submitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </div>
    </main>
  )
}

// Inputs draw nothing of their own: the panel and its hairlines are the only frame.
const inputClass = 'block w-full min-w-0 appearance-none bg-transparent py-1 text-right text-[15px] text-navy outline-none placeholder:text-slate-300'

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-xl px-4 pt-7">
      <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-navy">
        {title}{note && <span className="text-xs font-normal normal-case text-muted">{note}</span>}
      </h2>
      <div className="divide-y divide-slate-100 rounded-card bg-white px-4 shadow-card">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-navy">{value}</dd>
    </div>
  )
}

function Field({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className={`shrink-0 ${className}`}>{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  )
}

function Photo({ label, file, onFile, missing, onChange, t }: {
  label: string; file?: FileState; onFile: boolean; missing: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  t: (key: keyof typeof T) => string
}) {
  const status = file?.status === 'uploading' ? t('uploading') : file?.status === 'error' ? t('uploadFailed') : ''
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3 text-sm">
      <span className={`shrink-0 ${missing || file?.status === 'error' ? 'text-orange' : 'text-muted'}`}>{label}</span>
      <span className="flex min-w-0 items-center gap-3">
        {file?.preview && <img src={file.preview} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />}
        {file && !file.preview && <span className="truncate text-navy">📄 {file.name}</span>}
        {status
          ? <span className={file?.status === 'error' ? 'text-orange' : 'text-muted'}>{status}</span>
          : onFile && <span className="shrink-0 text-emerald-600">✓ {file ? '' : t('onFile')}</span>}
        <span className="shrink-0 font-semibold text-orange">{file || onFile ? t('retake') : t('takePhoto')}</span>
      </span>
      <input type="file" accept="image/*,application/pdf" onChange={onChange} className="hidden" />
    </label>
  )
}
