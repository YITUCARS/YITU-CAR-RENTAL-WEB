/** The normalized classification every raw listing is mapped onto. */
export const VEHICLE_CLASSES = [
  'ECONOMY',
  'COMPACT',
  'MIDSIZE',
  'FULLSIZE',
  'COMPACT_SUV',
  'MIDSIZE_SUV',
  'LARGE_SUV',
  'PREMIUM',
  'EV',
  'VAN_8_SEAT',
  'VAN_12_SEAT',
] as const;

export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export function isVehicleClass(value: string): value is VehicleClass {
  return (VEHICLE_CLASSES as readonly string[]).includes(value);
}

/** How a class was decided. `unresolved` means a human needs to look at it. */
export type ClassificationMethod = 'mapping' | 'rule' | 'manual' | 'llm' | 'unresolved';

export interface Classification {
  vehicleClass?: VehicleClass;
  method: ClassificationMethod;
  confidence: number;
  /** which rule fired, for debugging and for auditing the mapping table */
  matchedPattern?: string;
}

export type Transmission = 'automatic' | 'manual' | 'unknown';
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'plugin_hybrid' | 'electric' | 'unknown';
export type Availability = 'available' | 'on_request' | 'sold_out' | 'unknown';
export type PayType = 'prepaid' | 'pay_at_counter' | 'unknown';
