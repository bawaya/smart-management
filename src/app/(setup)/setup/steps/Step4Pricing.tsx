'use client';

export interface Step4Data {
  clientEquipmentRate: string;
  clientWorkerRate: string;
  defaultWorkerRate: string;
  fuelPrice: string;
  vatRate: string;
  isValid: boolean;
}

interface Step4PricingProps {
  data: Partial<Step4Data>;
  onUpdate: (data: Step4Data) => void;
  equipmentLabel: string;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function toNum(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number): string {
  return `₪${n.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function Step4Pricing({
  data,
  onUpdate,
  equipmentLabel,
}: Step4PricingProps) {
  const clientEquipmentRate = data.clientEquipmentRate ?? '';
  const clientWorkerRate = data.clientWorkerRate ?? '';
  const defaultWorkerRate = data.defaultWorkerRate ?? '';
  const fuelPrice = data.fuelPrice ?? '';
  const vatRate = data.vatRate ?? '17';

  function emit(changes: Partial<Omit<Step4Data, 'isValid'>>): void {
    onUpdate({
      clientEquipmentRate,
      clientWorkerRate,
      defaultWorkerRate,
      fuelPrice,
      vatRate,
      ...changes,
      isValid: true,
    });
  }

  const profit =
    toNum(clientEquipmentRate) +
    toNum(clientWorkerRate) -
    toNum(defaultWorkerRate);
  const profitPositive = profit >= 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <header className="text-center mb-6">
        <div className="text-4xl mb-2" aria-hidden>
          💰
        </div>
        <h2 className="text-xl font-bold text-gray-900">תמחור</h2>
        <p className="mt-2 text-sm text-gray-600">
          הגדר את המחירים הבסיסיים. תוכל לשנות אותם בכל עת מההגדרות.
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
              onChange={(e) =>
                emit({ clientEquipmentRate: e.target.value })
              }
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
              onChange={(e) => emit({ clientWorkerRate: e.target.value })}
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
            onChange={(e) => emit({ defaultWorkerRate: e.target.value })}
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
              onChange={(e) => emit({ fuelPrice: e.target.value })}
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
              onChange={(e) => emit({ vatRate: e.target.value })}
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
    </div>
  );
}
