export const BUDGET_CATEGORIES = [
  'income_equipment',
  'income_workers',
  'income_other',
  'expense_fuel',
  'expense_vehicle_insurance',
  'expense_vehicle_license',
  'expense_vehicle_maintenance',
  'expense_vehicle_rental',
  'expense_equipment_maintenance',
  'expense_worker_payment',
  'expense_office',
  'expense_phone',
  'expense_internet',
  'expense_other',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export type ActualAmounts = Record<BudgetCategory, number>;
