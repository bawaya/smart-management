import { cache } from 'react';
import { getDb } from '@/lib/db';

export type AlertSeverity = 'warning' | 'critical';
export type AlertType = 'insurance' | 'license';
export type AlertEntityType = 'equipment' | 'vehicle';

export interface ExpiryAlert {
  type: AlertType;
  entityType: AlertEntityType;
  entityName: string;
  expiryDate: string;
  daysLeft: number;
  severity: AlertSeverity;
}

interface EntityRow {
  name: string;
  insurance_expiry: string | null;
  license_expiry: string | null;
}

function daysUntil(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function classify(days: number): AlertSeverity | null {
  if (days < 14) return 'critical';
  if (days < 30) return 'warning';
  return null;
}

function pushIfAlert(
  out: ExpiryAlert[],
  entityType: AlertEntityType,
  entityName: string,
  type: AlertType,
  date: string | null,
): void {
  if (!date) return;
  const days = daysUntil(date);
  if (days === null) return;
  const severity = classify(days);
  if (!severity) return;
  out.push({
    type,
    entityType,
    entityName,
    expiryDate: date.slice(0, 10),
    daysLeft: days,
    severity,
  });
}

export const getExpiryAlerts = cache(
  async (tenantId: string): Promise<ExpiryAlert[]> => {
    const db = getDb();
    const [equipment, vehicles] = await Promise.all([
      db.query<EntityRow>(
        "SELECT name, insurance_expiry, license_expiry FROM equipment WHERE tenant_id = ? AND is_active = 1 AND status != 'retired'",
        [tenantId],
      ),
      db.query<EntityRow>(
        'SELECT name, insurance_expiry, license_expiry FROM vehicles WHERE tenant_id = ? AND is_active = 1',
        [tenantId],
      ),
    ]);

    const alerts: ExpiryAlert[] = [];
    for (let i = 0; i < equipment.length; i++) {
      const e = equipment[i];
      pushIfAlert(alerts, 'equipment', e.name, 'insurance', e.insurance_expiry);
      pushIfAlert(alerts, 'equipment', e.name, 'license', e.license_expiry);
    }
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      pushIfAlert(alerts, 'vehicle', v.name, 'insurance', v.insurance_expiry);
      pushIfAlert(alerts, 'vehicle', v.name, 'license', v.license_expiry);
    }
    alerts.sort((a, b) => a.daysLeft - b.daysLeft);
    return alerts;
  },
);
