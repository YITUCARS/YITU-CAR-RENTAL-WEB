import { Suspense } from 'react'
import ManualPaymentPageClient from './ManualPaymentPageClient'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManualPaymentPageClient />
    </Suspense>
  )
}