import type { Metadata } from 'next'
import CheckinClient from './CheckinClient'

export const metadata: Metadata = {
  title: 'Online check-in',
  robots: { index: false, follow: false },
}

export default function CheckinPage({ params }: { params: { token: string } }) {
  return <CheckinClient token={params.token} />
}
