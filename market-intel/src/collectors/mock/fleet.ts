/**
 * The synthetic fleet. Names are written the way real sites write them
 * ('Toyota RAV4 or similar', 'Intermediate SUV') so the normalizer is exercised
 * against realistic input rather than against clean labels.
 */
export interface MockVehicle {
  nameRaw: string;
  classRaw: string;
  expectedClass: string;
  seats: number;
  bags: number;
  doors: number;
  transmission: string;
  fuel: string;
}

export const MOCK_FLEET: MockVehicle[] = [
  { nameRaw: 'Toyota Yaris or similar',        classRaw: 'Economy',           expectedClass: 'ECONOMY',     seats: 5, bags: 1, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Suzuki Swift or similar',        classRaw: 'Economy',           expectedClass: 'ECONOMY',     seats: 5, bags: 1, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Toyota Corolla or similar',      classRaw: 'Compact',           expectedClass: 'COMPACT',     seats: 5, bags: 2, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Mazda 3 or similar',             classRaw: 'Compact',           expectedClass: 'COMPACT',     seats: 5, bags: 2, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Toyota Camry or similar',        classRaw: 'Intermediate',      expectedClass: 'MIDSIZE',     seats: 5, bags: 3, doors: 4, transmission: 'Automatic', fuel: 'Hybrid' },
  { nameRaw: 'Holden Commodore or similar',    classRaw: 'Full Size',         expectedClass: 'FULLSIZE',    seats: 5, bags: 3, doors: 4, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'MG ZS',                          classRaw: 'Compact SUV',       expectedClass: 'COMPACT_SUV', seats: 5, bags: 2, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Nissan Qashqai',                 classRaw: 'Compact SUV',       expectedClass: 'COMPACT_SUV', seats: 5, bags: 2, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Toyota RAV4 or similar',         classRaw: 'Intermediate SUV',  expectedClass: 'MIDSIZE_SUV', seats: 5, bags: 3, doors: 5, transmission: 'Automatic', fuel: 'Hybrid' },
  { nameRaw: 'Mazda CX-5 or similar',          classRaw: 'Intermediate SUV',  expectedClass: 'MIDSIZE_SUV', seats: 5, bags: 3, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Nissan X-Trail or similar',      classRaw: 'Standard SUV',      expectedClass: 'MIDSIZE_SUV', seats: 5, bags: 3, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Toyota Highlander or similar',   classRaw: 'Large SUV',         expectedClass: 'LARGE_SUV',   seats: 7, bags: 4, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Kia Sorento or similar',         classRaw: '7 Seat SUV',        expectedClass: 'LARGE_SUV',   seats: 7, bags: 4, doors: 5, transmission: 'Automatic', fuel: 'Diesel' },
  { nameRaw: 'BMW 3 Series or similar',        classRaw: 'Premium',           expectedClass: 'PREMIUM',     seats: 5, bags: 3, doors: 4, transmission: 'Automatic', fuel: 'Petrol' },
  { nameRaw: 'Tesla Model 3',                  classRaw: 'Electric',          expectedClass: 'EV',          seats: 5, bags: 2, doors: 4, transmission: 'Automatic', fuel: 'Electric' },
  { nameRaw: 'BYD Atto 3',                     classRaw: 'Electric SUV',      expectedClass: 'EV',          seats: 5, bags: 2, doors: 5, transmission: 'Automatic', fuel: 'Electric' },
  { nameRaw: 'Kia Carnival or similar',        classRaw: '8 Seater',          expectedClass: 'VAN_8_SEAT',  seats: 8, bags: 5, doors: 5, transmission: 'Automatic', fuel: 'Diesel' },
  { nameRaw: 'Toyota Hiace Commuter',          classRaw: '12 Seater Van',     expectedClass: 'VAN_12_SEAT', seats: 12, bags: 6, doors: 4, transmission: 'Manual',   fuel: 'Diesel' },
  // deliberately unmapped, so the unresolved-review path has something in it
  { nameRaw: 'Foton View Wagon',               classRaw: 'Special',           expectedClass: '',            seats: 5, bags: 2, doors: 5, transmission: 'Automatic', fuel: 'Petrol' },
];

export const MOCK_SUPPLIERS = [
  'Avis',
  'Hertz',
  'Budget NZ',
  'Thrifty New Zealand',
  'Europcar',
  'GO Rentals',
];
