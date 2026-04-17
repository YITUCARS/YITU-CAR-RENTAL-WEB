import { BookingProvider } from '@/lib/booking-context'

export default function BookingLayout({ children }: { children: React.ReactNode }) {
    return <BookingProvider>{children}</BookingProvider>
}