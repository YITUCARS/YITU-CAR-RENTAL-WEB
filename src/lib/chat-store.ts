import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { ChatMessage, ChatSession, ChatStatus, getInitialBotMessage } from '@/lib/chat'

export async function getChatSession(sessionId: string) {
    const ref = getAdminDb().collection('chats').doc(sessionId)
    console.log('[chat-store] getting session:', sessionId)
    const snapshot = await ref.get()
    console.log('[chat-store] got snapshot:', snapshot.exists)
    if (!snapshot.exists) return null
    return snapshot.data() as ChatSession
}

export async function ensureChatSession(sessionId: string) {
    const ref = getAdminDb().collection('chats').doc(sessionId)
    const snapshot = await ref.get()

    if (!snapshot.exists) {
        const now = Date.now()
        const initialData: ChatSession = {
            sessionId,
            status: 'bot',
            messages: [getInitialBotMessage()],
            unreadCount: 0,
            createdAt: now,
            updatedAt: now,
            agentJoinedAt: null,
            lastTelegramMessageId: null,
        }
        await ref.set(initialData)
        return initialData
    }

    return snapshot.data() as ChatSession
}


export async function findChatSessionByTelegramMessageId(messageId: number | string | null | undefined) {
    const numericMessageId = Number(messageId)
    if (!Number.isFinite(numericMessageId)) return null

    const snapshot = await getAdminDb()
        .collection('chats')
        .where('lastTelegramMessageId', '==', numericMessageId)
        .limit(1)
        .get()

    if (snapshot.empty) return null
    return snapshot.docs[0].data() as ChatSession
}

export async function appendMessages(sessionId: string, messages: ChatMessage[], updates?: Partial<ChatSession>) {
    const ref = getAdminDb().collection('chats').doc(sessionId)
    await ref.set({
        sessionId,
        updatedAt: Date.now(),
        ...updates,
        messages: FieldValue.arrayUnion(...messages),
    }, { merge: true })
}

export async function incrementUnread(sessionId: string, amount = 1) {
    const ref = getAdminDb().collection('chats').doc(sessionId)
    await ref.set({
        unreadCount: FieldValue.increment(amount),
        updatedAt: Date.now(),
    }, { merge: true })
}

export async function clearUnread(sessionId: string) {
    const ref = getAdminDb().collection('chats').doc(sessionId)
    await ref.set({
        unreadCount: 0,
        updatedAt: Date.now(),
    }, { merge: true })
}

export async function updateChatStatus(sessionId: string, status: ChatStatus, updates?: Partial<ChatSession>) {
    const ref = getAdminDb().collection('chats').doc(sessionId)
    await ref.set({
        status,
        updatedAt: Date.now(),
        ...updates,
    }, { merge: true })
}
