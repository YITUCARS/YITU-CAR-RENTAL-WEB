'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { MessageCircle, SendHorizontal, X, Headset, BellDot } from 'lucide-react'
import { ensureAnonymousAuth, getFirebaseFirestore } from '@/lib/firebase'
import { ChatMessage, ChatSession, getInitialBotMessage } from '@/lib/chat'

const STORAGE_KEY = 'yitu-chat-session-id'

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

    for (const message of [...current, ...incoming]) {
        map.set(`${message.sender}-${message.timestamp}-${message.text}`, message)
    }

    return sortMessages(Array.from(map.values()))
}

export default function ChatWidget() {
    const [open, setOpen] = useState(false)
    const [sessionId, setSessionId] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([getInitialBotMessage()])
    const [status, setStatus] = useState<'bot' | 'human'>('bot')
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [supportOffered, setSupportOffered] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [error, setError] = useState('')
    const latestTimestampRef = useRef(0)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const openRef = useRef(false)

    function syncFromChat(chat: ChatSession | null | undefined) {
        if (!chat) return

        const nextMessages = Array.isArray(chat.messages) ? sortMessages(chat.messages) : []
        const merged = nextMessages.length > 0 ? nextMessages : [getInitialBotMessage()]
        const newestMessage = merged[merged.length - 1]

        if (newestMessage && newestMessage.timestamp > latestTimestampRef.current && newestMessage.sender === 'agent' && !openRef.current) {
            playNotificationSound()
        }

        latestTimestampRef.current = newestMessage?.timestamp ?? latestTimestampRef.current
        setMessages(merged)
        setStatus(chat.status)
        setUnreadCount(chat.unreadCount ?? 0)
    }

    async function refreshChatSession(targetSessionId: string) {
        const response = await fetch(`/api/chat-session?sessionId=${encodeURIComponent(targetSessionId)}`)
        const data = await response.json()
        if (!response.ok) {
            throw new Error(data.error || 'Unable to refresh chat.')
        }
        syncFromChat(data.chat as ChatSession | null)
    }

    useEffect(() => {
        openRef.current = open
    }, [open])

    useEffect(() => {
        const existing = window.localStorage.getItem(STORAGE_KEY)
        const id = existing || createSessionId()
        if (!existing) {
            window.localStorage.setItem(STORAGE_KEY, id)
        }
        setSessionId(id)
    }, [])

    useEffect(() => {
        if (!sessionId) return

        let unsubscribe = () => {}
        let cancelled = false

        async function start() {
            await ensureAnonymousAuth()
            const firestore = getFirebaseFirestore()
            if (!firestore) {
                throw new Error('Firebase chat is not configured yet.')
            }

            const chatRef = doc(firestore, 'chats', sessionId)
            unsubscribe = onSnapshot(
                chatRef,
                snapshot => {
                    if (cancelled || !snapshot.exists()) return
                    syncFromChat(snapshot.data() as ChatSession)
                },
                async () => {
                    try {
                        await refreshChatSession(sessionId)
                    } catch {
                        setError('Chat sync is temporarily unavailable.')
                    }
                },
            )
        }

        start().catch(() => {
            setError('Chat is temporarily unavailable.')
        })

        return () => {
            cancelled = true
            unsubscribe()
        }
    }, [sessionId])

    useEffect(() => {
        if (!open || !sessionId) return

        refreshChatSession(sessionId).catch(() => {})
        const interval = window.setInterval(() => {
            refreshChatSession(sessionId).catch(() => {})
        }, 3000)

        return () => window.clearInterval(interval)
    }, [open, sessionId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, open])

    useEffect(() => {
        if (!open || !sessionId || unreadCount === 0) return

        fetch('/api/chat-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        }).catch(() => {})
    }, [open, sessionId, unreadCount])

    async function sendMessage(text: string, requestHuman = false) {
        if (!sessionId || (!text.trim() && !requestHuman)) return

        setSending(true)
        setError('')

        try {
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    text,
                    requestHuman,
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || 'Unable to send message.')
            }

            if (Array.isArray(data.messages)) {
                setMessages(current => mergeMessages(current, data.messages as ChatMessage[]))
                const newest = sortMessages(data.messages as ChatMessage[]).at(-1)
                latestTimestampRef.current = Math.max(latestTimestampRef.current, newest?.timestamp ?? 0)
            }
            setSupportOffered(Boolean(data.supportOffered))
            if (requestHuman) {
                setStatus('human')
            }
            setInput('')

            refreshChatSession(sessionId).catch(() => {})
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to send message.'
            setError(message)
        } finally {
            setSending(false)
        }
    }

    const hasMessages = messages.length > 0
    const headerLabel = useMemo(() => (status === 'human' ? 'Live Support' : 'FAQ Assistant'), [status])

    return (
        <>
            <button
                onClick={() => setOpen(current => !current)}
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
                    <div className="bg-[linear-gradient(135deg,#0f2347_0%,#183a6d_100%)] px-5 py-4 text-white">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-white/70 font-bold">
                                    {status === 'human' ? <Headset size={14} /> : <BellDot size={14} />}
                                    {headerLabel}
                                </div>
                                <h3 className="font-syne text-[1.1rem] font-extrabold mt-1">YITU Website Chat</h3>
                                <p className="text-[12px] text-white/75 mt-1">
                                    Ask a quick question or request human support.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="h-[420px] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]">
                        <div className="h-full overflow-y-auto px-4 py-4">
                            {!hasMessages && (
                                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-muted">
                                    Hi! Ask us about price, deposit, locations, or request support.
                                </div>
                            )}

                            {messages.map(message => (
                                <div
                                    key={`${message.sender}-${message.timestamp}-${message.text}`}
                                    className={`mb-3 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                                            message.sender === 'user'
                                                ? 'bg-orange text-white rounded-br-md'
                                                : 'bg-white border border-black/10 text-navy rounded-bl-md'
                                        }`}
                                    >
                                        <div>{message.text}</div>
                                        <div className={`mt-1 text-[10px] ${message.sender === 'user' ? 'text-white/80' : 'text-muted'}`}>
                                            {formatTime(message.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {supportOffered && status !== 'human' && (
                                <div className="mt-2 rounded-2xl border border-orange/20 bg-orange/5 p-3">
                                    <div className="text-[12px] text-muted leading-relaxed">
                                        Need more help? Our support team can continue this conversation for you.
                                    </div>
                                    <button
                                        onClick={() => sendMessage(input, true)}
                                        disabled={sending}
                                        className="mt-3 inline-flex items-center rounded-xl bg-navy px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-navy/90 disabled:opacity-60"
                                    >
                                        Contact Support
                                    </button>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    <div className="border-t border-black/10 bg-white px-4 py-3">
                        {error && <div className="mb-2 text-[12px] text-red-600">{error}</div>}
                        <div className="flex items-end gap-2">
                            <textarea
                                rows={1}
                                value={input}
                                onChange={event => setInput(event.target.value)}
                                placeholder={status === 'human' ? 'Message our support team…' : 'Ask a question…'}
                                className="min-h-[48px] flex-1 resize-none rounded-2xl border border-black/10 bg-off-white px-4 py-3 text-[13px] text-navy outline-none focus:border-orange"
                                onKeyDown={event => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        sendMessage(input)
                                    }
                                }}
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={sending || !input.trim()}
                                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange text-white transition-colors hover:bg-orange-dark disabled:opacity-60"
                                aria-label="Send message"
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
