'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { updatePricingAction } from '../actions';

interface PricingFormProps {
  tenantId: string;
  equipmentLabel: string;
  initialData: {
    clientEquipmentRate: string;
    clientWorkerRate: string;
    defaultWorkerRate: string;
    fuelPrice: string;
    vatRate: string;
  };
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number): string {
  return `₪${n.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function PricingForm({
  tenantId,
  equipmentLabel,
  initialData,
}: PricingFormProps) {
  const router = useRouter();

  const [clientEquipmentRate, setClientEquipmentRate] = useState(
    initialData.clientEquipmentRate,
  );
  const [clientWorkerRate, setClientWorkerRate] = useState(
    initialData.clientWorkerRate,
  );
  const [defaultWorkerRate, setDefaultWorkerRate] = useState(
    initialData.defaultWorkerRate,
  );
  const [fuelPrice, setFuelPrice] = useState(initialData.fuelPrice);
  const [vatRate, setVatRate] = useState(initialData.vatRate);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profit =
    toNum(clientEquipmentRate) +
    toNum(clientWorkerRate) -
    toNum(defaultWorkerRate);
  const profitPositive = profit >= 0;

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const result = await updatePricingAction(tenantId, {
        clientEquipmentRate,
        clientWorkerRate,
        defaultWorkerRate,
        fuelPrice,
        vatRate,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <header className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">תמחור</h2>
        <p className="mt-1 text-sm text-gray-600">
          עדכן את המחירים הבסיסיים.
        </p>
      </header>

      <section className="bg-[#ecfdf5] border border-green-200 rounded-xl p-4 mb-4 text-right">
        <h3 className="text-sm font-semibold text-green-800 mb-3">
          הכנסות (מה שהלקוח משלם לך)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מחיר יומי ל{equipmentLabel}
            </label>
            <input
              type="number"
              dir="ltr"
              min="0"
              placeholder="0"
              value={clientEquipmentRate}
              onChange={(e) => setClientEquipmentRate(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">₪ ליום</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מחיר יומי לעובד
            </label>
            <input
              type="number"
              dir="ltr"
              min="0"
              placeholder="0"
              value={clientWorkerRate}
              onChange={(e) => setClientWorkerRate(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">₪ ליום</p>
          </div>
        </div>
      </section>

      <section className="bg-[#fef2f2] border border-red-200 rounded-xl p-4 mb-4 text-right">
        <h3 className="text-sm font-semibold text-red-800 mb-3">
          עלויות (מה שאתה משלם)
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שכר יומי לעובד
          </label>
          <input
            type="number"
            dir="ltr"
            min="0"
            placeholder="0"
            value={defaultWorkerRate}
            onChange={(e) => setDefaultWorkerRate(e.target.value)}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-gray-500">
            ₪ ליום — ברירת מחדל, ניתן להגדיר מחיר שונה לכל עובד
          </p>
        </div>
      </section>

      <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-right">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">דלק ומע״מ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מחיר ליטר דלק
            </label>
            <input
              type="number"
              dir="ltr"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">₪ לליטר</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              אחוז מע״מ
            </label>
            <input
              type="number"
              dir="ltr"
              min="0"
              max="100"
              step="0.1"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">%</p>
          </div>
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-700">רווח משוער ליום עבודה:</p>
        <p
          className={`text-2xl font-bold mt-1 ${
            profitPositive ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {formatCurrency(profit)}
        </p>
      </div>

      {success && (
        <div
          role="status"
          className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center"
        >
          השינויים נשמרו בהצלחה
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-lg bg-[#f59e0b] text-black font-bold hover:bg-[#d97706] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </form>
  );
}
