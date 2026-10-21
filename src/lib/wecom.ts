const webhookUrl = () => process.env.WECHAT_WORK_WEBHOOK_URL || ''

function plainText(value: string) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export async function sendWeComMessage(text: string) {
  const url = webhookUrl()
  if (!url) return { sent: false, skipped: 'WECHAT_WORK_WEBHOOK_URL is not configured' }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: plainText(text).slice(0, 5000) } }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.errcode) throw new Error(data?.errmsg || `WeCom webhook failed: ${response.status}`)
  return { sent: true }
}

export async function sendWeComMessageSafely(text: string) {
  try {
    return await sendWeComMessage(text)
  } catch (error) {
    console.error('[wecom] notification failed:', error instanceof Error ? error.message : error)
    return { sent: false, error: error instanceof Error ? error.message : String(error) }
  }
}
