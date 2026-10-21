export const STAFF_PERMISSIONS = [
  'bookings.read',
  'bookings.refresh',
  'pickup.manage',
  'dropoff.manage',
  'photos.upload',
  'agreements.manage',
  'completions.confirm',
] as const

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]
export type StaffRole = 'staff' | 'manager'

const permissionSet = new Set<string>(STAFF_PERMISSIONS)

export function cleanStaffPermissions(value: unknown): StaffPermission[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(String).filter((item): item is StaffPermission => permissionSet.has(item))))
}

export function defaultPermissionsForRole(role: StaffRole): StaffPermission[] {
  if (role === 'manager') return [...STAFF_PERMISSIONS]
  return [
    'bookings.read',
    'pickup.manage',
    'dropoff.manage',
    'photos.upload',
    'agreements.manage',
  ]
}

/** Existing rows created before granular permissions inherit their role preset. */
export function accountPermissions(value: unknown, role: StaffRole): StaffPermission[] {
  return Array.isArray(value) ? cleanStaffPermissions(value) : defaultPermissionsForRole(role)
}
