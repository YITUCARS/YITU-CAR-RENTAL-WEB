'use client'

import {useEffect, useState} from 'react'
import Image from 'next/image'
import {ArrowRight, BrainCircuit, Briefcase, ChevronUp, Loader2, RotateCcw, Send, Sparkles, Users} from 'lucide-react'
import {useLocale} from 'next-intl'

interface FinderVehicle {
  vehiclecategoryid: number
  vehiclecategorytypeid: number
  vehiclecategory: string
  categoryfriendlydescription: string
  avgrate: number
  totalrateafterdiscount: number
  totaldiscountamount: number
  numberofadults: number
  numberoflargecases: number
  numberofsmallcases: number
  imageurl: string
  aiReason?: string
}

interface FinderResult {
  success: boolean
  status?: 'needs_info' | 'ready'
  aiAvailable: boolean
  responseLanguage?: string
  assistantMessage?: string
  summary: string
  bookingUrl: string
  search?: Record<string, any>
  vehicles: FinderVehicle[]
  totalLiveVehicles: number
  error?: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type FinderLanguage = 'English' | 'Simplified Chinese' | 'Japanese' | 'Korean' | 'Spanish' | 'Other'
type ConversationMode = 'natural' | 'guided'
type PanelKind = 'locations' | 'dates' | 'age' | 'capacity' | 'promo' | null

type StructuredAnswers = {
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  dropoffDate: string
  pickupTime: string
  dropoffTime: string
  driverAge: string
  passengers: string
  children: string
  largeBags: string
  budgetLevel: string
  promoCode: string
}

const FINDER_LANGUAGES: Array<{value: FinderLanguage; label: string; nativeLabel: string}> = [
  {value: 'English', label: 'English', nativeLabel: 'English'},
  {value: 'Simplified Chinese', label: 'Chinese', nativeLabel: '简体中文'},
  {value: 'Japanese', label: 'Japanese', nativeLabel: '日本語'},
  {value: 'Korean', label: 'Korean', nativeLabel: '한국어'},
  {value: 'Spanish', label: 'Spanish', nativeLabel: 'Español'},
  {value: 'Other', label: 'Other', nativeLabel: 'Other language'},
]

const EXAMPLES = {
  en: [
    'We want to pick up in Christchurch and return in Queenstown.',
    '2 adults, 2 children, 3 large bags.',
    '13 Aug 2026 10am to 20 Aug 2026 10am, driver is over 26.',
  ],
  zh: [
    '我们想基督城取车，皇后镇还车。',
    '2个大人，2个小孩，3个大箱。',
    '2026年8月13日上午10点取车，8月20日上午10点还车，司机26岁以上。',
  ],
}

export default function TriAiCarFinderSection() {
  const locale = useLocale()
  const isZh = locale === 'zh'
  const baseCopy = isZh ? zhBaseCopy : enBaseCopy
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FinderResult | null>(null)
  const [error, setError] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<FinderLanguage | null>(null)
  const [customLanguageDraft, setCustomLanguageDraft] = useState('')
  const [showCustomLanguage, setShowCustomLanguage] = useState(false)
  const [conversationMode, setConversationMode] = useState<ConversationMode | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [structuredAnswers, setStructuredAnswers] = useState<StructuredAnswers>({
    pickupLocation: '', dropoffLocation: '', pickupDate: '', dropoffDate: '', pickupTime: '10:00', dropoffTime: '10:00',
    driverAge: '', passengers: '2', children: '0', largeBags: '0', budgetLevel: '', promoCode: '',
  })
  const [dateStage, setDateStage] = useState<'dates' | 'times'>('dates')
  const [responseLanguage, setResponseLanguage] = useState(isZh ? 'Simplified Chinese' : 'English')
  const [sessionId, setSessionId] = useState('')
  const [expanded, setExpanded] = useState(false)
  const activeCopy = selectedLanguage === 'Simplified Chinese' ? zhBaseCopy : baseCopy

  useEffect(() => {
    const storageKey = 'yitu-tri-ai-session-id'
    const existing = window.localStorage.getItem(storageKey)
    const next = existing || `${Date.now()}-${crypto.randomUUID()}`
    window.localStorage.setItem(storageKey, next)
    setSessionId(next)
  }, [])

  const resultIsZh = isChineseLanguageName(result?.responseLanguage || responseLanguage)
  const resultCopy = resultIsZh ? zhResultCopy : enResultCopy

  async function submit(text = draft) {
    const content = text.trim()
    if (!content || loading || !selectedLanguage || !conversationMode) return

    const activeSessionId = sessionId || `${Date.now()}-${crypto.randomUUID()}`
    if (!sessionId) {
      window.localStorage.setItem('yitu-tri-ai-session-id', activeSessionId)
      setSessionId(activeSessionId)
    }

    const nextMessages: ChatMessage[] = [...messages, {role: 'user', content}]
    setMessages(nextMessages)
    setDraft('')
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/ai/car-finder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: nextMessages,
          locale,
          sessionId: activeSessionId,
          responseLanguage: selectedLanguage,
          conversationMode,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || activeCopy.error)

      const assistantMessage = String(data.assistantMessage || data.summary || '').trim()
      if (data.responseLanguage) setResponseLanguage(data.responseLanguage)

      if (data.status === 'needs_info') {
        setResult(null)
        setMissingFields(Array.isArray(data.missingFields) ? data.missingFields : [])
        setMessages([...nextMessages, {role: 'assistant', content: assistantMessage || activeCopy.moreInfo}])
        return
      }

      setMissingFields([])
      setResult(data)
      setMessages([...nextMessages, {role: 'assistant', content: assistantMessage || resultCopy.readyMessage}])
    } catch (err: any) {
      setError(err?.message || activeCopy.error)
      setMessages(nextMessages)
    } finally {
      setLoading(false)
    }
  }

  function restart() {
    const nextSessionId = `${Date.now()}-${crypto.randomUUID()}`
    window.localStorage.setItem('yitu-tri-ai-session-id', nextSessionId)
    setSessionId(nextSessionId)
    setMessages([])
    setDraft('')
    setResult(null)
    setError('')
    setSelectedLanguage(null)
    setCustomLanguageDraft('')
    setShowCustomLanguage(false)
    setConversationMode(null)
    setMissingFields([])
    setStructuredAnswers({
      pickupLocation: '', dropoffLocation: '', pickupDate: '', dropoffDate: '', pickupTime: '10:00', dropoffTime: '10:00',
      driverAge: '', passengers: '2', children: '0', largeBags: '0', budgetLevel: '', promoCode: '',
    })
    setDateStage('dates')
    setResponseLanguage(isZh ? 'Simplified Chinese' : 'English')
  }

  function chooseLanguage(language: string) {
    setSelectedLanguage(language as FinderLanguage)
    setConversationMode(null)
    setResult(null)
    setMissingFields([])
    setError('')
    setMessages([
      {role: 'assistant', content: languageCopy(language, 'welcome')},
      {role: 'assistant', content: languageCopy(language, 'chooseMode')},
    ])
    setResponseLanguage(language)
  }

  function confirmCustomLanguage() {
    const language = customLanguageDraft.trim().slice(0, 40)
    if (language) {
      setShowCustomLanguage(false)
      chooseLanguage(language)
    }
  }

  function chooseMode(mode: ConversationMode) {
    if (!selectedLanguage) return
    const guided = mode === 'guided'
    setConversationMode(mode)
    setMissingFields(guided ? ['pickupLocation'] : [])
    setMessages(messages => [
      ...messages,
      {role: 'user', content: languageCopy(selectedLanguage, mode === 'natural' ? 'naturalMode' : 'guidedMode')},
      {role: 'assistant', content: languageCopy(selectedLanguage, guided ? 'firstGuidedQuestion' : 'naturalPrompt')},
    ])
  }

  function presetAnswers() {
    if (!selectedLanguage) return []
    const isZhLanguage = selectedLanguage === 'Simplified Chinese'
    const isEnglish = selectedLanguage === 'English'
    const options: Record<string, string[]> = {
      pickupLocation: isZhLanguage ? ['基督城', '皇后镇'] : isEnglish ? ['Christchurch', 'Queenstown'] : ['Christchurch', 'Queenstown'],
      dropoffLocation: isZhLanguage ? ['基督城', '皇后镇'] : isEnglish ? ['Christchurch', 'Queenstown'] : ['Christchurch', 'Queenstown'],
      passengers: isZhLanguage ? ['1 位成人', '2 位成人', '4 位成人'] : isEnglish ? ['1 adult', '2 adults', '4 adults'] : ['1', '2', '4'],
      children: isZhLanguage ? ['没有儿童', '1 个儿童', '2 个儿童'] : isEnglish ? ['No children', '1 child', '2 children'] : ['0', '1', '2'],
      largeBags: isZhLanguage ? ['没有大箱', '1 个大箱', '2 个大箱'] : isEnglish ? ['No large bags', '1 large bag', '2 large bags'] : ['0', '1', '2'],
      driverAge: isZhLanguage ? ['26 岁以上', '26 岁以下'] : isEnglish ? ['26 or older', 'Under 26'] : ['26+', 'Under 26'],
    }
    return options[missingFields[0]] || []
  }

  function panelKind(): PanelKind {
    if (missingFields.includes('promoCode')) return 'promo'
    if (missingFields.includes('pickupLocation') || missingFields.includes('dropoffLocation')) return 'locations'
    if (missingFields.some(field => ['pickupDate', 'pickupTime', 'dropoffDate', 'dropoffTime'].includes(field))) return 'dates'
    if (missingFields.includes('driverAge')) return 'age'
    if (missingFields.some(field => ['passengers', 'children', 'largeBags'].includes(field))) return 'capacity'
    return null
  }

  function updateStructuredAnswer(field: keyof StructuredAnswers, value: string) {
    setStructuredAnswers(current => ({...current, [field]: value}))
  }

  function submitStructuredPanel(kind: Exclude<PanelKind, null>) {
    const value = structuredAnswers
    if (kind === 'locations' && value.pickupLocation && value.dropoffLocation) {
      submit(selectedLanguage === 'Simplified Chinese'
        ? `取车地点：${value.pickupLocation}。还车地点：${value.dropoffLocation}。`
        : `Pickup location: ${value.pickupLocation}. Dropoff location: ${value.dropoffLocation}.`)
    }
    if (kind === 'dates' && dateStage === 'dates' && value.pickupDate && value.dropoffDate) {
      setDateStage('times')
      return
    }
    if (kind === 'dates' && dateStage === 'times' && value.pickupDate && value.dropoffDate && value.pickupTime && value.dropoffTime) {
      submit(selectedLanguage === 'Simplified Chinese'
        ? `取车日期：${value.pickupDate}，时间：${value.pickupTime}。还车日期：${value.dropoffDate}，时间：${value.dropoffTime}。`
        : `Pickup date ${value.pickupDate} at ${value.pickupTime}. Dropoff date ${value.dropoffDate} at ${value.dropoffTime}.`)
    }
    if (kind === 'age' && value.driverAge) {
      submit(selectedLanguage === 'Simplified Chinese'
        ? (value.driverAge === 'under26' ? '主要驾驶员未满 26 岁。' : '主要驾驶员已满 26 岁。')
        : (value.driverAge === 'under26' ? 'The main driver is under 26.' : 'The main driver is 26 or older.'))
    }
    if (kind === 'capacity' && value.passengers && value.children !== '' && value.largeBags !== '') {
      const budget = value.budgetLevel
        ? selectedLanguage === 'Simplified Chinese' ? `预算偏好：${value.budgetLevel}。` : ` Budget preference: ${value.budgetLevel}.`
        : ''
      submit(selectedLanguage === 'Simplified Chinese'
        ? `${value.passengers} 位成人，${value.children} 位儿童，${value.largeBags} 个大箱。${budget}`
        : `${value.passengers} adults, ${value.children} children, ${value.largeBags} large bags.${budget}`)
    }
  }

  function renderStructuredPanel() {
    const kind = panelKind()
    if (!kind || loading || !selectedLanguage || !conversationMode) return null
    const copy = panelCopy(selectedLanguage)
    const buttonClass = 'rounded-xl border border-orange/25 bg-orange/5 px-3 py-2 text-left text-[12px] font-semibold text-navy transition hover:border-orange hover:bg-orange/10'

    if (kind === 'promo') return (
      <div className="mb-3 rounded-2xl border border-orange/20 bg-white p-3 text-navy">
        <p className="text-[12px] font-bold text-orange">{selectedLanguage === 'Simplified Chinese' ? '优惠码（可选）' : 'Promo code (optional)'}</p>
        <p className="mt-1 text-[11px] text-muted">{selectedLanguage === 'Simplified Chinese' ? '如果有优惠码，请输入；没有的话可以直接跳过。' : 'Enter a promo code if you have one, or skip this step.'}</p>
        <input
          type="text"
          value={structuredAnswers.promoCode}
          onChange={event => updateStructuredAnswer('promoCode', event.target.value.toUpperCase())}
          placeholder={selectedLanguage === 'Simplified Chinese' ? '输入优惠码' : 'Enter promo code'}
          className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-[13px] uppercase text-navy outline-none focus:border-orange"
          maxLength={32}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => submit(structuredAnswers.promoCode || (selectedLanguage === 'Simplified Chinese' ? '没有优惠码' : 'No promo code'))} className="rounded-xl bg-orange px-3 py-2 text-[12px] font-bold text-white">{copy.continueLabel}</button>
          <button type="button" onClick={() => submit(selectedLanguage === 'Simplified Chinese' ? '没有优惠码' : 'No promo code')} className="rounded-xl border border-black/10 px-3 py-2 text-[12px] font-bold text-muted">{selectedLanguage === 'Simplified Chinese' ? '没有优惠码' : 'No code'}</button>
        </div>
      </div>
    )

    if (kind === 'locations') return (
      <div className="mb-3 rounded-2xl border border-orange/20 bg-white p-3 text-navy">
        <p className="text-[12px] font-bold text-orange">{copy.locationsTitle}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-muted">{copy.pickup}
            <select value={structuredAnswers.pickupLocation} onChange={event => updateStructuredAnswer('pickupLocation', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-navy outline-none">
              <option value="">{copy.choose}</option><option value="Christchurch">{selectedLanguage === 'Simplified Chinese' ? '基督城' : 'Christchurch'}</option><option value="Queenstown">{selectedLanguage === 'Simplified Chinese' ? '皇后镇' : 'Queenstown'}</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold text-muted">{copy.dropoff}
            <select value={structuredAnswers.dropoffLocation} onChange={event => updateStructuredAnswer('dropoffLocation', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-navy outline-none">
              <option value="">{copy.choose}</option><option value="Christchurch">{selectedLanguage === 'Simplified Chinese' ? '基督城' : 'Christchurch'}</option><option value="Queenstown">{selectedLanguage === 'Simplified Chinese' ? '皇后镇' : 'Queenstown'}</option>
            </select>
          </label>
        </div>
        <button type="button" disabled={!structuredAnswers.pickupLocation || !structuredAnswers.dropoffLocation} onClick={() => submitStructuredPanel('locations')} className="mt-3 w-full rounded-xl bg-orange px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40">{copy.continueLabel}</button>
      </div>
    )

    if (kind === 'dates') return (
      <div className="mb-3 rounded-2xl border border-orange/20 bg-white p-3 text-navy">
        <p className="text-[12px] font-bold text-orange">{dateStage === 'dates' ? copy.datesTitle : copy.timesTitle}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {dateStage === 'dates' ? <>
            <label className="text-[11px] font-semibold text-muted">{copy.pickupDate}<input type="date" value={structuredAnswers.pickupDate} onChange={event => updateStructuredAnswer('pickupDate', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-[13px] text-navy outline-none" /></label>
            <label className="text-[11px] font-semibold text-muted">{copy.dropoffDate}<input type="date" value={structuredAnswers.dropoffDate} onChange={event => updateStructuredAnswer('dropoffDate', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-[13px] text-navy outline-none" /></label>
          </> : <>
            <label className="text-[11px] font-semibold text-muted">{copy.pickupTime}<input type="time" value={structuredAnswers.pickupTime} onChange={event => updateStructuredAnswer('pickupTime', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-[13px] text-navy outline-none" /></label>
            <label className="text-[11px] font-semibold text-muted">{copy.dropoffTime}<input type="time" value={structuredAnswers.dropoffTime} onChange={event => updateStructuredAnswer('dropoffTime', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-[13px] text-navy outline-none" /></label>
          </>}
        </div>
        <button type="button" disabled={dateStage === 'dates' ? !structuredAnswers.pickupDate || !structuredAnswers.dropoffDate : !structuredAnswers.pickupTime || !structuredAnswers.dropoffTime} onClick={() => submitStructuredPanel('dates')} className="mt-3 w-full rounded-xl bg-orange px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40">{copy.continueLabel}</button>
      </div>
    )

    if (kind === 'age') return (
      <div className="mb-3 rounded-2xl border border-orange/20 bg-white p-3 text-navy">
        <p className="text-[12px] font-bold text-orange">{copy.ageTitle}</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => updateStructuredAnswer('driverAge', 'over26')} className={buttonClass}>{copy.over26}</button><button type="button" onClick={() => updateStructuredAnswer('driverAge', 'under26')} className={buttonClass}>{copy.under26}</button></div>
        <button type="button" disabled={!structuredAnswers.driverAge} onClick={() => submitStructuredPanel('age')} className="mt-3 w-full rounded-xl bg-orange px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40">{copy.continueLabel}</button>
      </div>
    )

    return (
      <div className="mb-3 rounded-2xl border border-orange/20 bg-white p-3 text-navy">
        <p className="text-[12px] font-bold text-orange">{copy.capacityTitle}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="text-[10px] font-semibold text-muted">{copy.adults}<input type="number" min="1" max="12" value={structuredAnswers.passengers} onChange={event => updateStructuredAnswer('passengers', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-2 py-2 text-[13px] text-navy" /></label>
          <label className="text-[10px] font-semibold text-muted">{copy.children}<input type="number" min="0" max="8" value={structuredAnswers.children} onChange={event => updateStructuredAnswer('children', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-2 py-2 text-[13px] text-navy" /></label>
          <label className="text-[10px] font-semibold text-muted">{copy.largeBags}<input type="number" min="0" max="8" value={structuredAnswers.largeBags} onChange={event => updateStructuredAnswer('largeBags', event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-2 py-2 text-[13px] text-navy" /></label>
        </div>
        <p className="mt-3 text-[11px] font-semibold text-muted">{copy.budget}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">{(selectedLanguage === 'Simplified Chinese' ? [['budget', '经济'], ['mid', '舒适'], ['premium', '高端']] : [['budget', 'Budget'], ['mid', 'Comfort'], ['premium', 'Premium']]).map(([value, label]) => <button key={value} type="button" onClick={() => updateStructuredAnswer('budgetLevel', value)} className={`${buttonClass} ${structuredAnswers.budgetLevel === value ? 'border-orange bg-orange/10' : ''}`}>{label}</button>)}</div>
        <button type="button" onClick={() => submitStructuredPanel('capacity')} className="mt-3 w-full rounded-xl bg-orange px-3 py-2 text-[12px] font-bold text-white">{copy.continueLabel}</button>
      </div>
    )
  }

  function startInlineBooking(vehicle: FinderVehicle) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('yitu-ai-start-booking', {
      detail: {
        vehicle,
        search: result?.search,
        responseLanguage: selectedLanguage,
      },
    }))
  }

  return (
    <section id="tri-ai-car-finder" className={`relative overflow-hidden bg-navy px-5 text-white sm:px-10 ${expanded ? 'py-20' : 'py-3'}`}>
      {expanded && <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(232,67,26,.7), transparent 28%), radial-gradient(circle at 80% 10%, rgba(255,255,255,.35), transparent 24%)',
      }} />}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group relative mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-left shadow-[0_10px_35px_rgba(0,0,0,.14)] backdrop-blur transition-colors hover:border-orange/45 hover:bg-white/12 sm:px-6"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-orange/30 bg-[#fffaf5] shadow-inner">
              <Image src="/ai-rental-bot.png" alt="YITU AI car finder" fill sizes="40px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-syne text-[13px] font-bold text-white sm:text-[14px]">
                {activeCopy.compactTitle}
                <span className="rounded-full border border-orange/40 bg-orange/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[1.4px] text-orange">
                  {activeCopy.eyebrow}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-white/55 sm:text-[12px]">{activeCopy.compactSubtitle}</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange px-3.5 py-2 font-syne text-[11px] font-bold text-white shadow-orange-glow transition-transform group-hover:translate-x-0.5 sm:px-4">
            {activeCopy.tryNow} <ArrowRight size={14} />
          </span>
        </button>
      ) : (
      <div className="relative mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange/35 bg-orange/15 px-4 py-2 text-[11px] font-bold uppercase tracking-[2.4px] text-orange">
            <Sparkles size={14} /> {activeCopy.eyebrow}
          </div>
          <h2 className="font-montserrat text-[clamp(2.1rem,4vw,4rem)] font-extrabold italic leading-[0.98]">
            {activeCopy.title}
          </h2>
          <p className="mt-5 max-w-[540px] text-[15px] leading-[1.85] text-white/72">
            {activeCopy.subtitle}
          </p>

          <div className="mt-7 overflow-hidden rounded-[28px] border border-white/10 bg-white/8 shadow-[0_24px_70px_rgba(0,0,0,.22)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[1.8px] text-white/62">
                <BrainCircuit size={15} className="text-orange" />
                {activeCopy.chatTitle}
              </div>
              <button
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/68 transition-colors hover:bg-white/16 hover:text-white"
              >
                <RotateCcw size={12} />
                {activeCopy.restart}
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/68 transition-colors hover:bg-white/16 hover:text-white"
              >
                <ChevronUp size={12} />
                {activeCopy.collapse}
              </button>
            </div>

            <div className="flex max-h-[420px] min-h-[340px] flex-col gap-3 overflow-y-auto px-4 py-5">
              {!selectedLanguage && (
                <div className="rounded-[22px] border border-orange/25 bg-white p-4 text-navy shadow-[0_12px_30px_rgba(0,0,0,.14)]">
                  <p className="text-[12px] font-bold uppercase tracking-[1.6px] text-orange">{activeCopy.languageStep}</p>
                  <p className="mt-2 text-[14px] font-semibold">{activeCopy.chooseLanguage}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {FINDER_LANGUAGES.map(language => (
                      <button
                        key={language.value}
                        type="button"
                        onClick={() => language.value === 'Other' ? setShowCustomLanguage(true) : chooseLanguage(language.value)}
                        className="rounded-2xl border border-black/10 px-3 py-3 text-left text-[12px] font-semibold text-navy transition hover:border-orange hover:bg-orange/5"
                      >
                        <span className="block text-[13px]">{language.nativeLabel}</span>
                        <span className="mt-0.5 block text-[10px] text-muted">{language.label}</span>
                      </button>
                    ))}
                  </div>
                  {showCustomLanguage && (
                    <div className="mt-4 rounded-2xl bg-off-white p-3">
                      <p className="text-[13px] font-semibold">{activeCopy.otherLanguagePrompt}</p>
                      <div className="mt-3 flex gap-2">
                        <input
                          autoFocus
                          value={customLanguageDraft}
                          onChange={event => setCustomLanguageDraft(event.target.value)}
                          onKeyDown={event => { if (event.key === 'Enter') confirmCustomLanguage() }}
                          placeholder={activeCopy.otherLanguagePlaceholder}
                          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-orange"
                        />
                        <button type="button" onClick={confirmCustomLanguage} className="rounded-xl bg-orange px-4 py-2 text-[12px] font-bold text-white">
                          {activeCopy.continueLabel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
                  className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[13.5px] leading-[1.65] ${
                    message.role === 'assistant'
                      ? 'self-start bg-white text-navy shadow-[0_12px_30px_rgba(0,0,0,.14)]'
                      : 'self-end bg-orange text-white shadow-orange-glow'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {loading && (
                <div className="flex max-w-[88%] items-center gap-2 self-start rounded-[20px] bg-white px-4 py-3 text-[13.5px] text-muted">
                  <Loader2 size={15} className="animate-spin text-orange" />
                  {activeCopy.loading}
                </div>
              )}
              {selectedLanguage && !conversationMode && (
                <div className="self-start rounded-[20px] bg-white p-4 text-navy shadow-[0_12px_30px_rgba(0,0,0,.14)]">
                  <p className="mb-3 text-[13px] font-semibold">{languageCopy(selectedLanguage, 'chooseMode')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => chooseMode('natural')} className="rounded-full border border-orange/35 bg-orange/10 px-3 py-2 text-[12px] font-semibold text-orange hover:bg-orange hover:text-white">
                      {languageCopy(selectedLanguage, 'naturalMode')}
                    </button>
                    <button type="button" onClick={() => chooseMode('guided')} className="rounded-full border border-orange/35 bg-orange/10 px-3 py-2 text-[12px] font-semibold text-orange hover:bg-orange hover:text-white">
                      {languageCopy(selectedLanguage, 'guidedMode')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              {renderStructuredPanel()}
              {selectedLanguage && conversationMode && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {presetAnswers().map(example => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => submit(example)}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-left text-[11.5px] text-white/70 transition-colors hover:bg-orange/80 hover:text-white"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
              {selectedLanguage && conversationMode === 'natural' && (
                <div className="mb-3 flex flex-wrap gap-2">
                {(selectedLanguage === 'Simplified Chinese' ? EXAMPLES.zh : EXAMPLES.en).map(example => (
                  <button
                    key={example}
                    onClick={() => setDraft(example)}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-left text-[11.5px] text-white/70 transition-colors hover:bg-white/16 hover:text-white"
                  >
                    {example}
                  </button>
                ))}
                </div>
              )}
              <div className={`flex gap-2 rounded-[22px] bg-white p-2 ${!selectedLanguage || !conversationMode ? 'pointer-events-none opacity-40' : ''}`}>
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      submit()
                    }
                  }}
                  placeholder={selectedLanguage ? activeCopy.placeholder : activeCopy.chooseLanguageFirst}
                  rows={2}
                  className="min-h-[52px] flex-1 resize-none rounded-[16px] px-3 py-2 text-[14px] leading-[1.55] text-navy outline-none placeholder:text-muted/60"
                />
                <button
                  onClick={() => submit()}
                  disabled={loading || !draft.trim() || !selectedLanguage || !conversationMode}
                  className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[17px] bg-orange text-white shadow-orange-glow transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={activeCopy.send}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              {error && (
                <p className="mt-3 rounded-2xl bg-orange/15 px-4 py-3 text-[12.5px] leading-[1.55] text-white/82">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white p-4 text-navy shadow-[0_24px_70px_rgba(0,0,0,.25)] sm:p-5 lg:mt-[190px]">
          {!result && (
            <div className="relative min-h-[520px] overflow-hidden rounded-[24px] bg-off-white">
              <Image
                src="/ai-rental-bot.png"
                alt="YITU AI car finder"
                fill
                sizes="(max-width: 1024px) 100vw, 540px"
                className="object-cover"
                priority
              />
            </div>
          )}

          {result && (
            <div>
              <div className="rounded-[24px] bg-off-white p-5">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[2px] text-orange">
                  <BrainCircuit size={14} /> {resultCopy.aiUnderstanding}
                </div>
                <p className="text-[14px] leading-[1.7] text-muted">{result.summary}</p>
                {!result.aiAvailable && (
                  <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-[12px] leading-[1.55] text-muted">
                    {resultCopy.fallback}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {result.vehicles.length === 0 ? (
                  <div className="rounded-[24px] border border-black/10 p-5 text-[14px] text-muted">
                    {resultCopy.noResults}
                  </div>
                ) : result.vehicles.map(vehicle => {
                  const image = normalizeImageUrl(vehicle.imageurl)
                  return (
                    <div key={vehicle.vehiclecategoryid} className="grid gap-4 rounded-[24px] border border-black/10 p-4 sm:grid-cols-[150px_1fr]">
                      <div className="relative h-32 overflow-hidden rounded-[18px] bg-off-white">
                        {image ? (
                          <Image src={image} alt={vehicle.categoryfriendlydescription || vehicle.vehiclecategory} fill sizes="150px" className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[12px] text-muted">{resultCopy.noImage}</div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-syne text-[1.05rem] font-extrabold text-navy">
                          {vehicle.categoryfriendlydescription || vehicle.vehiclecategory}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-3 text-[12.5px] text-muted">
                          <span className="inline-flex items-center gap-1.5"><Users size={13} className="text-orange" /> {vehicle.numberofadults} {resultCopy.seats}</span>
                          <span className="inline-flex items-center gap-1.5"><Briefcase size={13} className="text-orange" /> {vehicle.numberoflargecases} {resultCopy.bags}</span>
                          {vehicle.avgrate ? <span className="font-bold text-navy">${Number(vehicle.avgrate).toFixed(0)}{resultCopy.perDay}</span> : null}
                        </div>
                        <p className="mt-3 text-[13px] leading-[1.65] text-muted">{vehicle.aiReason}</p>
                        <button
                          onClick={() => startInlineBooking(vehicle)}
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-syne text-[12.5px] font-bold text-white transition-colors hover:bg-orange-dark"
                        >
                          {resultCopy.bookNow} <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => window.open(result.bookingUrl, '_self')}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-orange/30 bg-orange/10 px-5 py-3.5 font-syne text-[13px] font-bold text-orange transition-colors hover:bg-orange hover:text-white"
              >
                {resultCopy.viewAll} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </section>
  )
}

const enBaseCopy = {
  eyebrow: 'Beta version',
  title: 'Try AI Car Finder',
  compactTitle: 'Want to try booking with AI?',
  compactSubtitle: 'Tell us about your trip and get a real vehicle recommendation.',
  tryNow: 'Try it now',
  collapse: 'Collapse',
  subtitle: 'Chat naturally with our AI advisor. It asks for the missing trip details, checks live vehicle availability, and explains the best matches for your trip.',
  chatTitle: 'Guided AI conversation',
  languageStep: 'Step 1 · Language',
  chooseLanguage: 'Which language would you like to use?',
  modeTitle: 'Step 2 · Choose how you want to search',
  naturalMode: 'Tell me naturally',
  naturalModeBody: 'Describe your trip in your own words. I will ask only for missing details.',
  guidedMode: 'Quick guided questions',
  guidedModeBody: 'Answer short questions with suggested options, or type your own answer.',
  chooseLanguageFirst: 'Choose a language to begin...',
  otherLanguagePrompt: 'What language would you like to use?',
  otherLanguagePlaceholder: 'Type a language, for example French or German',
  continueLabel: 'Continue',
  placeholder: 'Type your answer here...',
  loading: 'Thinking and checking what information is still needed...',
  error: 'Unable to continue the AI car finder right now.',
  moreInfo: 'I need a little more information before checking live vehicles.',
  restart: 'Restart',
  send: 'Send',
  emptyState: 'The AI will first collect the essential details, then show live available vehicles here.',
}

const zhBaseCopy = {
  eyebrow: 'Beta version',
  title: 'Try AI Car Finder',
  compactTitle: '想试试 AI 帮你订车吗？',
  compactSubtitle: '告诉我们你的行程，获取真实车辆推荐。',
  tryNow: '立即体验',
  collapse: '收起',
  subtitle: '像聊天一样告诉 AI 你的行程。AI 会主动追问缺少的信息，资料齐全后查询实时可订车辆，并解释为什么推荐这些车。',
  chatTitle: 'AI 引导式对话',
  languageStep: '第 1 步 · 语言',
  chooseLanguage: '请选择你希望使用的语言',
  modeTitle: '第 2 步 · 选择找车方式',
  naturalMode: '自然表达需求',
  naturalModeBody: '直接用自己的话描述行程，AI 只会追问缺少的信息。',
  guidedMode: '快速引导问答',
  guidedModeBody: '通过预设选项回答，也可以随时自己输入。',
  chooseLanguageFirst: '请先选择语言...',
  otherLanguagePrompt: '请输入你希望使用的语言',
  otherLanguagePlaceholder: '例如：法语、德语、葡萄牙语',
  continueLabel: '继续',
  placeholder: '在这里回复 AI...',
  loading: '正在理解你的回复，并判断还缺哪些信息...',
  error: 'AI 找车暂时无法继续，请稍后再试。',
  moreInfo: '我还需要一点信息，才能帮你查询真实车辆。',
  restart: '重新开始',
  send: '发送',
  emptyState: 'AI 会先收集必要行程资料，然后在这里展示实时可订车辆。',
}

function languageCopy(language: string, key: 'welcome' | 'chooseMode' | 'naturalMode' | 'guidedMode' | 'naturalPrompt' | 'guidedPrompt' | 'firstGuidedQuestion') {
  if (/russian|русский|русск/i.test(language)) {
    const russianCopy = {
      welcome: 'Добро пожаловать. Я помогу подобрать подходящий автомобиль YITU шаг за шагом.',
      chooseMode: 'Как вы хотите рассказать о своей поездке?',
      naturalMode: 'Описать поездку своими словами',
      guidedMode: 'Ответить на короткие вопросы',
      naturalPrompt: 'Расскажите всё, что уже известно: места, даты, количество пассажиров или багаж.',
      guidedPrompt: 'Пойдём по шагам: я буду задавать короткие вопросы и предлагать варианты ответа.',
      firstGuidedQuestion: 'Сначала укажите, где вы хотите получить автомобиль.',
    }
    return russianCopy[key]
  }
  const copy: Record<FinderLanguage, Record<typeof key, string>> = {
    English: {
      welcome: 'Welcome. I will help you find the right YITU rental car step by step.',
      chooseMode: 'How would you like to tell me about your trip?',
      naturalMode: 'I want to describe my trip naturally',
      guidedMode: 'I prefer quick guided questions',
      naturalPrompt: 'Tell me anything you already know about your trip, such as locations, dates, passengers or luggage.',
      guidedPrompt: 'Let’s take it one step at a time. I’ll show short questions with suggested answers.',
      firstGuidedQuestion: 'First, where would you like to pick up the vehicle?',
    },
    'Simplified Chinese': {
      welcome: '欢迎！我会一步一步帮你找到合适的 YITU 租车。',
      chooseMode: '你希望用哪种方式告诉我行程？',
      naturalMode: '我想直接描述行程',
      guidedMode: '我想回答快速问题',
      naturalPrompt: '你可以先告诉我已经确定的信息，例如地点、日期、乘客或行李数量。',
      guidedPrompt: '我们一步一步来。我会显示简短问题和预设答案，你也可以自己输入。',
      firstGuidedQuestion: '首先，你想在哪里取车？',
    },
    Japanese: {
      welcome: 'ようこそ。ご旅行に合う YITU のレンタカーを順番にお探しします。',
      chooseMode: '旅行の希望をどのように伝えますか？',
      naturalMode: '自然な文章で伝える',
      guidedMode: '簡単な質問に答える',
      naturalPrompt: '場所、日付、人数、荷物など、分かっている旅行情報を自由に入力してください。',
      guidedPrompt: '短い質問と選択肢で順番に確認します。自分で入力することもできます。',
      firstGuidedQuestion: 'まず、どこで車を受け取りますか？',
    },
    Korean: {
      welcome: '환영합니다. 여행에 맞는 YITU 렌터카를 단계별로 찾아드릴게요.',
      chooseMode: '여행 정보를 어떤 방식으로 알려주시겠어요?',
      naturalMode: '자연스럽게 설명하기',
      guidedMode: '간단한 질문에 답하기',
      naturalPrompt: '장소, 날짜, 인원, 수하물 등 알고 있는 여행 정보를 자유롭게 입력해 주세요.',
      guidedPrompt: '짧은 질문과 선택지로 하나씩 확인해 드립니다. 직접 입력해도 됩니다.',
      firstGuidedQuestion: '먼저 차량을 어디에서 픽업하시겠어요?',
    },
    Spanish: {
      welcome: 'Bienvenido. Te ayudaré a encontrar el vehículo YITU adecuado paso a paso.',
      chooseMode: '¿Cómo prefieres contarme los detalles de tu viaje?',
      naturalMode: 'Describir mi viaje libremente',
      guidedMode: 'Responder preguntas rápidas',
      naturalPrompt: 'Cuéntame lo que ya sabes, como lugares, fechas, pasajeros o equipaje.',
      guidedPrompt: 'Lo haremos paso a paso con preguntas breves y opciones sugeridas. También puedes escribir tu respuesta.',
      firstGuidedQuestion: 'Primero, ¿dónde te gustaría recoger el vehículo?',
    },
    Other: {
      welcome: 'Welcome. I will help you find the right YITU rental car step by step.',
      chooseMode: 'How would you like to tell me about your trip?',
      naturalMode: 'Tell me naturally',
      guidedMode: 'Quick guided questions',
      naturalPrompt: 'Tell me anything you already know about your trip, such as locations, dates, passengers or luggage.',
      guidedPrompt: 'Let’s take it one step at a time. I’ll show short questions with suggested answers.',
      firstGuidedQuestion: 'First, where would you like to pick up the vehicle?',
    },
  }
  return (copy[language as FinderLanguage] || copy.Other)[key]
}

function panelCopy(language: string) {
  if (/chinese|中文|汉语|漢語/i.test(language)) return {
    locationsTitle: '请选择取车和还车地点', pickup: '取车地点', dropoff: '还车地点', choose: '请选择',
    datesTitle: '请选择取车和还车日期', timesTitle: '请选择取车和还车时间', pickupDate: '取车日期', pickupTime: '取车时间', dropoffDate: '还车日期', dropoffTime: '还车时间',
    ageTitle: '请选择主要驾驶员年龄', over26: '26 岁以上', under26: '26 岁以下', capacityTitle: '告诉我乘客和行李数量', adults: '成人', children: '儿童', largeBags: '大箱', budget: '预算区间', continueLabel: '继续',
  }
  if (/russian|русский|русск/i.test(language)) return {
    locationsTitle: 'Выберите места получения и возврата', pickup: 'Получение', dropoff: 'Возврат', choose: 'Выберите',
    datesTitle: 'Выберите даты получения и возврата', timesTitle: 'Выберите время получения и возврата', pickupDate: 'Дата получения', pickupTime: 'Время получения', dropoffDate: 'Дата возврата', dropoffTime: 'Время возврата',
    ageTitle: 'Выберите возраст основного водителя', over26: '26 лет или старше', under26: 'Младше 26 лет', capacityTitle: 'Укажите пассажиров и багаж', adults: 'Взрослые', children: 'Дети', largeBags: 'Большие чемоданы', budget: 'Бюджет', continueLabel: 'Продолжить',
  }
  return {
    locationsTitle: 'Choose pickup and return locations', pickup: 'Pickup location', dropoff: 'Return location', choose: 'Choose',
    datesTitle: 'Choose your pickup and return dates', timesTitle: 'Choose your pickup and return times', pickupDate: 'Pickup date', pickupTime: 'Pickup time', dropoffDate: 'Return date', dropoffTime: 'Return time',
    ageTitle: 'Choose the main driver age', over26: '26 or older', under26: 'Under 26', capacityTitle: 'Tell me about passengers and luggage', adults: 'Adults', children: 'Children', largeBags: 'Large bags', budget: 'Budget range', continueLabel: 'Continue',
  }
}

const enResultCopy = {
  aiUnderstanding: 'AI understanding',
  noResults: 'No close live match yet. View the official booking results and adjust your trip.',
  bookNow: 'Book now',
  viewAll: 'View official booking results',
  fallback: 'OpenAI key is not enabled yet, so smart rules were used. Add OPENAI_API_KEY to enable full OpenAI extraction.',
  seats: 'seats',
  bags: 'large bags',
  perDay: '/day',
  noImage: 'No image',
  readyMessage: 'I found live available vehicles for your trip.',
}

const zhResultCopy = {
  aiUnderstanding: 'AI 理解结果',
  noResults: '暂时没有找到完全匹配的可用车辆，请点击查看全部车辆调整条件。',
  bookNow: '立即预订',
  viewAll: '查看正式预订结果',
  fallback: '当前未启用 OpenAI key，已使用智能规则解析。配置 OPENAI_API_KEY 后会自动升级为 OpenAI 提取。',
  seats: '座',
  bags: '大箱',
  perDay: '/天',
  noImage: '暂无图片',
  readyMessage: '我已经找到这段行程真实可订的车辆。',
}

function normalizeImageUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}

function isChineseLanguageName(language: string) {
  return /^(zh|zh-|zh_)|chinese|mandarin|cantonese|中文|汉语|漢語/i.test(language)
}
