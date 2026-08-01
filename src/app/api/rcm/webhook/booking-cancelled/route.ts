export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { handleRcmAutomationHealthcheck, handleRcmAutomationWebhook } from '@/lib/rcm-automation-webhook'

export async function GET(request: NextRequest) {
  return handleRcmAutomationHealthcheck(request, 'cancelled')
}

export async function POST(request: NextRequest) {
  return handleRcmAutomationWebhook(request, 'cancelled')
}
