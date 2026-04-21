export const VALID_CATEGORIES = [
  'fuel',
  'vehicle_insurance',
  'vehicle_license',
  'vehicle_maintenance',
  'vehicle_rental',
  'equipment_maintenance',
  'worker_payment',
  'office',
  'phone',
  'internet',
  'other',
] as const;

export type ExpenseCategory = (typeof VALID_CATEGORIES)[number];
