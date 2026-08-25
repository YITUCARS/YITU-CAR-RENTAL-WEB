import {getSupabaseAdmin} from '@/lib/supabase-admin'

export type AiBookingMemoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

type SaveAiBookingMemoryInput = {
  sessionId: string
  locale: 'en' | 'zh'
  responseLanguage: string
  status: 'needs_info' | 'ready'
  messages: AiBookingMemoryMessage[]
  structuredSearch: unknown
  missingFields: readonly string[]
  recommendedVehicles?: unknown[]
  bookingUrl?: string
}

export async function saveAiBookingMemory(input: SaveAiBookingMemoryInput) {
  const sessionId = input.sessionId.trim().slice(0, 120)
  if (!sessionId) return false

  try {
    const supabase = getSupabaseAdmin()
    const {error} = await supabase
      .from('ai_booking_conversations')
      .upsert({
        session_id: sessionId,
        locale: input.locale,
        response_language: input.responseLanguage.slice(0, 60),
        status: input.status,
        messages: input.messages.slice(-24),
        structured_search: input.structuredSearch,
        missing_fields: input.missingFields,
        recommended_vehicles: (input.recommendedVehicles || []).slice(0, 3),
        booking_url: input.bookingUrl || null,
        completed_at: input.status === 'ready' ? new Date().toISOString() : null,
      }, {onConflict: 'session_id'})

    if (error) throw error
    return true
  } catch (error: any) {
    console.warn('[ai/booking-memory] Unable to save conversation:', error?.message || error)
    return false
  }
}
