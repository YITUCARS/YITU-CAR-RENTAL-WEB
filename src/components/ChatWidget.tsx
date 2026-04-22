'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { MessageCircle, SendHorizontal, X, Headset, BellDot, Phone, User, ArrowRight } from 'lucide-react'
import { ensureAnonymousAuth, getFirebaseFirestore } from '@/lib/firebase'
import {
    ChatMessage, ChatSession,
    getInitialBotMessage, matchFaqReply,
    getNoMatchReply, getSupportConfirmedReply, getAgentJoinedReply,
    buildTelegramMessage,
} from '@/lib/chat'

const STORAGE_KEY = 'yitu-chat-session-id'
// After this many unanswered questions, proactively suggest human support
const UNANSWERED_THRESHOLD = 2

function createSessionId() {
    return crypto.randomUUID()
}

function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('en-NZ', {
        hour: 'numeric',
        minute: '2-digit',
    })
}

function playNotificationSound() {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.value = 0.03
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.12)
}

function sortMessages(messages: ChatMessage[]) {
    return [...messages].sort((a, b) => a.timestamp - b.timestamp)
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
    const map = new Map<string, ChatMessage>()
    for (const msg of [...current, ...incoming]) {
        map.set(`${msg.sender}-${msg.timestamp}-${msg.text}`, msg)
    }
    return sortMessages(Array.from(map.values()))
}

// ── Contact collection form ───────────────────────────────────────────────────

function ContactForm({ onSubmit, onCancel, sending }: {
    onSubmit: (name: string, phone: string) => void
    onCancel: () => void
    sending: boolean
}) {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})

    function validate() {
        const e: { name?: string; phone?: string } = {}
        if (!name.trim()) e.name = 'Please enter your name'
        if (!phone.trim()) e.phone = 'Please enter your phone number'
        return e
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length > 0) { setErrors(errs); return }
        onSubmit(name.trim(), phone.trim())
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-orange/25 bg-orange/5 p-4 mt-2">
            <p className="text-[12.5px] text-navy font-semibold mb-3">
                Please leave your details and we'll get back to you shortly:
            </p>

            <div className="flex flex-col gap-2.5">
                <div>
                    <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 ${errors.name ? 'border-red-400' : 'border-black/10 focus-within:border-orange'}`}>
                        <User size={13} className="text-muted flex-shrink-0" />
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: '' })) }}
                            placeholder="Your name"
                            className="flex-1 bg-transparent text-[13px] text-navy outline-none placeholder:text-muted/60"
                        />
                    </div>
                    {errors.name && <p className="text-[11px] text-red-500 mt-0.5 pl-1">{errors.name}</p>}
                </div>

                <div>
                    <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 ${errors.phone ? 'border-red-400' : 'border-black/10 focus-within:border-orange'}`}>
                        <Phone size={13} className="text-muted flex-shrink-0" />
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setErrors(v => ({ ...v, phone: '' })) }}
                            placeholder="Phone number (e.g. +64 21 000 0000)"
                            className="flex-1 bg-transparent text-[13px] text-navy outline-none placeholder:text-muted/60"
                        />
                    </div>
                    {errors.phone && <p className="text-[11px] text-red-500 mt-0.5 pl-1">{errors.phone}</p>}
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-navy text-white rounded-xl py-2 text-[12px] font-bold transition-colors hover:bg-navy/90 disabled:opacity-60"
                >
                    {sending ? 'Sending…' : <><ArrowRight size={13} /> Send to Support</>}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-2 rounded-xl border border-black/10 text-[12px] text-muted hover:border-orange hover:text-orange transition-colors"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export default function ChatWidget() {
    const [open, setOpen] = useState(false)
    const [sessionId, setSessionId] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([getInitialBotMessage()])
    const [status, setStatus] = useState<'bot' | 'human'>('bot')
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [error, setError] = useState('')
    // How many consecutive questions the bot couldn't answer
    const [unansweredCount, setUnansweredCount] = useState(0)
    // Whether to show the contact collection form
    const [showContactForm, setShowContactForm] = useState(false)

    const latestTimestampRef = useRef(0)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const openRef = useRef(false)

    // ── Firestore sync ────────────────────────────────────────────────────────

    function syncFromChat(chat: ChatSession | null | undefined) {
        if (!chat) return
        const fromFirestore = Array.isArray(chat.messages) ? sortMessages(chat.messages) : []
        const base = fromFirestore.length > 0 ? fromFirestore : [getInitialBotMessage()]
        const newestMessage = base[base.length - 1]

        if (newestMessage && newestMessage.timestamp > latestTimestampRef.current && newestMessage.sender === 'agent' && !openRef.current) {
            playNotificationSound()
        }

        latestTimestampRef.current = newestMessage?.timestamp ?? latestTimestampRef.current

        // Merge Firestore messages WITH local state so locally-added bot
        // replies are never overwritten by an incoming snapshot.
        setMessages(current => mergeMessages(current, base))
        setStatus(chat.status)
        setUnreadCount(chat.unreadCount ?? 0)
    }

    async function refreshChatSession(targetSessionId: string) {
        const response = await fetch(`/api/chat-session?sessionId=${encodeURIComponent(targetSessionId)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to refresh chat.')
        syncFromChat(data.chat as ChatSession | null)
    }

    useEffect(() => { openRef.current = open }, [open])

    useEffect(() => {
        const existing = window.localStorage.getItem(STORAGE_KEY)
        const id = existing || createSessionId()
        if (!existing) window.localStorage.setItem(STORAGE_KEY, id)
        setSessionId(id)
    }, [])

    useEffect(() => {
        if (!sessionId) return
        let unsubscribe = () => {}
        let cancelled = false

        async function start() {
            await ensureAnonymousAuth()
            const firestore = getFirebaseFirestore()
            if (!firestore) throw new Error('Firebase chat is not configured yet.')
            const chatRef = doc(firestore, 'chats', sessionId)
            unsubscribe = onSnapshot(
                chatRef,
                snapshot => { if (cancelled || !snapshot.exists()) return; syncFromChat(snapshot.data() as ChatSession) },
                async () => { try { await refreshChatSession(sessionId) } catch { setError('Chat sync is temporarily unavailable.') } },
            )
        }

        start().catch(() => { setError('Chat is temporarily unavailable.') })
        return () => { cancelled = true; unsubscribe() }
    }, [sessionId])

    useEffect(() => {
        if (!open || !sessionId) return
        refreshChatSession(sessionId).catch(() => {})
        const interval = window.setInterval(() => { refreshChatSession(sessionId).catch(() => {}) }, 3000)
        return () => window.clearInterval(interval)
    }, [open, sessionId])

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open, showContactForm])

    useEffect(() => {
        if (!open || !sessionId || unreadCount === 0) return
        fetch('/api/chat-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) }).catch(() => {})
    }, [open, sessionId, unreadCount])

    // ── Helpers ───────────────────────────────────────────────────────────────

    function addLocalMessage(text: string, sender: 'user' | 'agent', timestamp?: number) {
        const msg: ChatMessage = { sender, text, timestamp: timestamp ?? Date.now() }
        setMessages(current => mergeMessages(current, [msg]))
        latestTimestampRef.current = Math.max(latestTimestampRef.current, msg.timestamp)
        return msg
    }

    async function saveMessageToFirestore(text: string, sender: 'user' | 'agent', timestamp: number) {
        await fetch('/api/chat/user-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, text, sender, timestamp }),
        }).catch(() => {})
    }

    // ── FAQ mode: handle user message locally ─────────────────────────────────

    async function handleFaqMessage(text: string) {
        const trimmed = text.trim()
        if (!trimmed) return

        const now = Date.now()
        setInput('')
        addLocalMessage(trimmed, 'user', now)
        await saveMessageToFirestore(trimmed, 'user', now)

        const faqReply = matchFaqReply(trimmed)

        if (faqReply) {
            // Reset unanswered counter on a successful FAQ match
            setUnansweredCount(0)
            setTimeout(() => addLocalMessage(faqReply, 'agent'), 300)
        } else {
            const nextCount = unansweredCount + 1
            setUnansweredCount(nextCount)

            if (nextCount >= UNANSWERED_THRESHOLD) {
                // Proactively offer human support after repeated misses
                setTimeout(() => {
                    addLocalMessage(
                        'I\'ve had trouble answering your questions. Would you like to speak directly with our team? Click "Contact Support" below.',
                        'agent',
                    )
                }, 300)
            } else {
                setTimeout(() => addLocalMessage(getNoMatchReply(), 'agent'), 300)
            }
        }
    }

    // ── Contact form submit: send to Telegram + escalate to human ─────────────

    async function handleContactSubmit(name: string, phone: string) {
        setSending(true)
        setError('')

        // Collect the last user question as context
        const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user')?.text || '(no message)'

        const telegramText = buildTelegramMessage({
            sessionId,
            name,
            phone,
            message: lastUserMsg,
        })

        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: telegramText, sessionId }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to send')

            setShowContactForm(false)
            setStatus('human')
            addLocalMessage(getSupportConfirmedReply(), 'agent')
            await saveMessageToFirestore(`[Contact request] Name: ${name} | Phone: ${phone} | Query: ${lastUserMsg}`, 'user', Date.now())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    // ── Human mode: send directly to Telegram ────────────────────────────────

    async function handleHumanMessage(text: string) {
        const trimmed = text.trim()
        if (!trimmed) return

        setSending(true)
        setInput('')
        setError('')

        const now = Date.now()
        addLocalMessage(trimmed, 'user', now)
        await saveMessageToFirestore(trimmed, 'user', now)

        try {
            await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Session: ${sessionId}\n${trimmed}`, sessionId }),
            })
        } catch {
            setError('Could not send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    function handleSend() {
        if (status === 'human') {
            handleHumanMessage(input)
        } else {
            handleFaqMessage(input)
        }
    }

    const headerLabel = useMemo(() => (status === 'human' ? 'Live Support' : 'FAQ Assistant'), [status])
    const showSupportButton = status === 'bot' && !showContactForm

    return (
        <>
            <button
                onClick={() => setOpen(v => !v)}
                className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-orange text-white shadow-[0_16px_40px_rgba(232,67,26,0.35)] transition-transform hover:scale-105"
                aria-label="Open chat"
            >
                {open ? <X size={24} /> : <MessageCircle size={24} />}
                {!open && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="fixed bottom-24 right-5 z-50 w-[calc(100vw-24px)] max-w-[380px] overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">

                    {/* Header */}
                    <div className="bg-[linear-gradient(135deg,#0f2347_0%,#183a6d_100%)] px-5 py-4 text-white">
                        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-white/70 font-bold">
                            {status === 'human' ? <Headset size={14} /> : <BellDot size={14} />}
                            {headerLabel}
                        </div>
                        <h3 className="font-syne text-[1.1rem] font-extrabold mt-1">YITU Car Rental</h3>
                        <p className="text-[12px] text-white/75 mt-0.5">
                            {status === 'human' ? 'Connected to our support team.' : 'Ask us anything about your rental.'}
                        </p>
                    </div>

                    {/* Messages */}
                    <div className="h-[380px] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] overflow-y-auto px-4 py-4">
                        {messages.map(msg => (
                            <div
                                key={`${msg.sender}-${msg.timestamp}-${msg.text}`}
                                className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm whitespace-pre-line ${
                                        msg.sender === 'user'
                                            ? 'bg-orange text-white rounded-br-md'
                                            : 'bg-white border border-black/10 text-navy rounded-bl-md'
                                    }`}
                                >
                                    {msg.text}
                                    <div className={`mt-1 text-[10px] ${msg.sender === 'user' ? 'text-white/80' : 'text-muted'}`}>
                                        {formatTime(msg.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Contact form (inline in chat) */}
                        {showContactForm && (
                            <ContactForm
                                onSubmit={handleContactSubmit}
                                onCancel={() => setShowContactForm(false)}
                                sending={sending}
                            />
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="border-t border-black/10 bg-white px-4 py-3">
                        {error && <div className="mb-2 text-[12px] text-red-600">{error}</div>}

                        {/* Human support button (bot mode only) */}
                        {showSupportButton && (
                            <button
                                onClick={() => setShowContactForm(true)}
                                className="w-full mb-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-navy/20 bg-navy/5 py-2 text-[12px] font-bold text-navy hover:bg-navy/10 transition-colors"
                            >
                                <Headset size={13} /> Contact Human Support
                            </button>
                        )}

                        <div className="flex items-end gap-2">
                            <textarea
                                rows={1}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder={status === 'human' ? 'Message our team…' : 'Ask a question…'}
                                className="min-h-[48px] flex-1 resize-none rounded-2xl border border-black/10 bg-off-white px-4 py-3 text-[13px] text-navy outline-none focus:border-orange"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={sending || !input.trim()}
                                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange text-white transition-colors hover:bg-orange-dark disabled:opacity-60"
                                aria-label="Send"
                            >
                                <SendHorizontal size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
