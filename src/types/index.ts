export interface Vehicle {
  id: string
  brand: string
  model: string
  category: 'sedan' | 'suv' | 'mpv' | 'van'
  seats: number
  bags: number
  fuel: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'
  drive: 'FWD' | 'AWD' | 'RWD'
  pricePerDay: number
  tags: string[]
  image: string
}

export interface Deal {
  id: string
  title: string
  description: string
  value: string
  unit?: string
  image: string
  badge: string
}

export interface Location {
  id: string
  city: string
  address: string
  suburb: string
}

export interface BookingForm {
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  dropoffDate: string
  roundTrip: boolean
}
