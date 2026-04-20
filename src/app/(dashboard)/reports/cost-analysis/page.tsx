import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import { CostAnalysisView, type VehicleCostRow } from './CostAnalysisView';

interface SettingRow {
  value: string;
}

interface VehicleRow {
  id: string;
  name: string;
  license_plate: string;
  annual_insurance_cost: number | null;
  annual_license_cost: number | null;
}

interface AggRow {
  vehicle_id: string;
  total: number;
}

const WINDOW_DAYS = 90;
const YEAR_DAYS = 365;

function toNumber(v: string | null | undefined, fallback = 0): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function CostAnalysisPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'reports')) {
    redirect('/');
  }

  const db = getDb();

  const [labelRow, revenueRow, vehicles, fuelRows, maintenanceRows] =
    await Promise.all([
      db.queryOne<SettingRow>(
        "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
        [tenantId],
      ),
      db.queryOne<SettingRow>(
        "SELECT value FROM settings WHERE tenant_id = ? AND key = 'client_equipment_revenue'",
        [tenantId],
      ),
      db.query<VehicleRow>(
        `SELECT id, name, license_plate, annual_insurance_cost, annual_license_cost
           FROM vehicles
           WHERE tenant_id = ? AND is_active = 1
           ORDER BY name`,
        [tenantId],
      ),
      db.query<AggRow>(
        `SELECT vehicle_id, COALESCE(SUM(total_cost), 0) AS total
           FROM fuel_records
           WHERE tenant_id = ? AND record_date >= date('now', '-90 days')
           GROUP BY vehicle_id`,
        [tenantId],
      ),
      db.query<AggRow>(
        `SELECT vehicle_id, COALESCE(SUM(amount), 0) AS total
           FROM expenses
           WHERE tenant_id = ? AND category = 'vehicle_maintenance'
             AND expense_date >= date('now', '-90 days')
             AND vehicle_id IS NOT NULL
           GROUP BY vehicle_id`,
        [tenantId],
      ),
    ]);

  const equipmentLabel = (labelRow?.value ?? '').trim() || 'ציוד';
  const clientRevenue = toNumber(revenueRow?.value, 0);

  const fuelByVehicle = new Map(fuelRows.map((r) => [r.vehicle_id, r.total]));
  const maintenanceByVehicle = new Map(
    maintenanceRows.map((r) => [r.vehicle_id, r.total]),
  );

  const rows: VehicleCostRow[] = vehicles.map((v) => {
    const fuelTotal = Number(fuelByVehicle.get(v.id) ?? 0);
    const maintenanceTotal = Number(maintenanceByVehicle.get(v.id) ?? 0);
    const dailyFuel = round2(fuelTotal / WINDOW_DAYS);
    const dailyMaintenance = round2(maintenanceTotal / WINDOW_DAYS);
    const dailyInsurance = round2(
      Number(v.annual_insurance_cost ?? 0) / YEAR_DAYS,
    );
    const dailyLicense = round2(
      Number(v.annual_license_cost ?? 0) / YEAR_DAYS,
    );
    const totalDailyCost = round2(
      dailyFuel + dailyInsurance + dailyLicense + dailyMaintenance,
    );
    const profit = round2(clientRevenue - totalDailyCost);

    return {
      id: v.id,
      name: v.name,
      licensePlate: v.license_plate,
      dailyFuel,
      dailyInsurance,
      dailyLicense,
      dailyMaintenance,
      totalDailyCost,
      revenue: clientRevenue,
      profit,
    };
  });

  return (
    <CostAnalysisView
      equipmentLabel={equipmentLabel}
      clientRevenue={clientRevenue}
      rows={rows}
    />
  );
}
