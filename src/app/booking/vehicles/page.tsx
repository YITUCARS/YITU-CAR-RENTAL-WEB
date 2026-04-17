import { Suspense } from 'react'
import VehiclesPageClient from './VehiclesPageClient'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VehiclesPageClient />
    </Suspense>
  )
}