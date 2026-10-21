export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { handleRcmAutomationHealthcheck, handleRcmAutomationWebhook } from '@/lib/rcm-automation-webhook'
import { incrementalSync } from '@/lib/rcm-sync'

export async function GET(request: NextRequest) {
  return handleRcmAutomationHealthcheck(request, 'created')
}

export async function POST(request: NextRequest) {
  const response = await handleRcmAutomationWebhook(request, 'created')
  // Pull the new booking into the YITU Lite mirror right away (which also alerts staff)
  // instead of waiting for the 5-minute cron. Runs in the background.
  if (response.ok) {
    incrementalSync().catch(error => console.warn('[rcm webhook] mirror sync failed:', error.message))
  }
  return response
}
