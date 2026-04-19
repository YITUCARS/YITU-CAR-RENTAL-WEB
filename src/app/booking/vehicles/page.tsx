import { Suspense } from 'react'
import VehiclesPageClient from './VehiclesPageClient'

export const revalidate = 300

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VehiclesPageClient />
    </Suspense>
  )
}