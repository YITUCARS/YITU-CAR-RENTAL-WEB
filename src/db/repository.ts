export interface VehicleRecord {
    id: string
    brand: string
    model: string
    category: 'sedan' | 'suv' | 'mpv' | 'van'
    seats: number
    bags: number
    fuel: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'
    drive: 'FWD' | 'AWD' | 'RWD'
    price_per_day: number
    tags: string[]
    image: string
    active: boolean
    created_at: string
}

export interface VehicleRepository {
    getAll(): Promise<VehicleRecord[]>
    getActive(): Promise<VehicleRecord[]>
    getById(id: string): Promise<VehicleRecord | null>
    create(data: Omit<VehicleRecord, 'id' | 'created_at'>): Promise<VehicleRecord>
    update(id: string, data: Partial<VehicleRecord>): Promise<VehicleRecord>
    delete(id: string): Promise<void>
    uploadImage(file: File): Promise<string>
}