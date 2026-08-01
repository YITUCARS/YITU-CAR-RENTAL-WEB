export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ChatMessage, extractSessionId, getAgentJoinedReply } from '@/lib/chat'
import { appendMessages, ensureChatSession, findChatSessionByTelegramMessageId, incrementUnread } from '@/lib/chat-store'
import { answerTelegramCallbackQuery, buildTelegramCallbackReply, buildTelegramCommandReply, buildTelegramMenuMarkup, isAllowedTelegramChat, sendTelegramMessage } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const callbackQuery = payload.callback_query

    if (callbackQuery?.data) {
      const chatId = callbackQuery.message?.chat?.id
      if (!chatId || !isAllowedTelegramChat(chatId)) {
        return NextResponse.json({ ok: true })
      }

      await answerTelegramCallbackQuery(callbackQuery.id).catch((error) => {
        console.warn('[telegram-webhook] answerCallbackQuery failed:', error instanceof Error ? error.message : error)
      })

      try {
        const reply = await buildTelegramCallbackReply(callbackQuery.data)
        if (reply) {
          await sendTelegramMessage({
            chatId,
            text: reply,
            replyToMessageId: callbackQuery.message?.message_id,
            replyMarkup: buildTelegramMenuMarkup(),
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load RCM bookings.'
        console.error('[telegram-webhook] callback handling failed:', message)
        await sendTelegramMessage({
          chatId,
          text: `RCM query failed: ${message}`,
          replyToMessageId: callbackQuery.message?.message_id,
          replyMarkup: buildTelegramMenuMarkup(),
        }).catch(() => {})
      }

      return NextResponse.json({ ok: true })
    }

    const message = payload.message

    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const replyText = (message.reply_to_message?.text || message.reply_to_message?.caption) as string | undefined
    const sessionIdFromText = extractSessionId(replyText) || extractSessionId(message.text)
    const repliedTelegramMessageId = message.reply_to_message?.message_id
    const chatFromTelegramMessage = sessionIdFromText
      ? null
      : await findChatSessionByTelegramMessageId(repliedTelegramMessageId)
    const sessionId = sessionIdFromText || chatFromTelegramMessage?.sessionId || null

    if (sessionId) {
      const chat = chatFromTelegramMessage && chatFromTelegramMessage.sessionId === sessionId
        ? chatFromTelegramMessage
        : await ensureChatSession(sessionId)
      const now = Date.now()
      const agentMessages: ChatMessage[] = []

      if (!chat.agentJoinedAt) {
        agentMessages.push({
          sender: 'agent',
          text: getAgentJoinedReply(),
          timestamp: now,
        })
      }

      agentMessages.push({
        sender: 'agent',
        text: message.text,
        timestamp: now + 1,
      })

      await appendMessages(sessionId, agentMessages, {
        status: 'human',
        agentJoinedAt: chat.agentJoinedAt ?? now,
      })
      await incrementUnread(sessionId, 1)

      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat?.id
    if (!chatId) {
      return NextResponse.json({ ok: true })
    }

    if (!isAllowedTelegramChat(chatId)) {
      if (message.chat?.type === 'private') {
        await sendTelegramMessage({
          chatId,
          text: [
            '<b>This private chat is not enabled yet.</b>',
            `Your Telegram chat id is: <code>${chatId}</code>`,
            'Add this id to TELEGRAM_ALLOWED_CHAT_IDS in Vercel, then redeploy or wait for the env update to apply.',
          ].join('\n'),
          replyToMessageId: message.message_id,
        })
      }
      return NextResponse.json({ ok: true })
    }

    const reply = await buildTelegramCommandReply(message.text)
    if (reply) {
      await sendTelegramMessage({
        chatId,
        text: reply,
        replyToMessageId: message.message_id,
        replyMarkup: buildTelegramMenuMarkup(),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[telegram-webhook] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
