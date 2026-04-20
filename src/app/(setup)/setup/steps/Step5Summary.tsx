'use client';

import type { Step1Data } from './Step1Password';
import type { Step2Data } from './Step2Company';
import type { Step3Data } from './Step3Business';
import type { Step4Data } from './Step4Pricing';

interface Step5SummaryProps {
  formData: {
    step1?: Step1Data;
    step2?: Step2Data;
    step3?: Step3Data;
    step4?: Step4Data;
  };
  onEdit: (step: number) => void;
}

function toNum(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(v: string | undefined): string {
  return toNum(v).toLocaleString('he-IL');
}

function formatDecimal(v: string | undefined): string {
  return toNum(v).toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function EditButton({ step, onEdit }: { step: number; onEdit: (s: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(step)}
      className="ms-auto text-xs font-medium text-[#d97706] hover:text-[#b45309] hover:underline"
    >
      עריכה
    </button>
  );
}

function CardHeader({
  icon,
  title,
  step,
  onEdit,
}: {
  icon: string;
  title: string;
  step?: number;
  onEdit?: (s: number) => void;
}) {
  return (
    <header className="flex items-center gap-2 mb-3">
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <h3 className="font-bold text-gray-900">{title}</h3>
      {step !== undefined && onEdit && <EditButton step={step} onEdit={onEdit} />}
    </header>
  );
}

const CARD_CLASS =
  'bg-white border border-gray-200 rounded-xl shadow-sm p-4';
const ROW_CLASS = 'flex justify-between gap-2 text-sm';
const LABEL_CLASS = 'text-gray-600';
const VALUE_CLASS = 'text-gray-900 font-medium truncate';
const EMPTY_CLASS = 'text-gray-400';

export function Step5Summary({ formData, onEdit }: Step5SummaryProps) {
  const step2 = formData.step2;
  const step3 = formData.step3;
  const step4 = formData.step4;

  const profit =
    toNum(step4?.clientEquipmentRate) +
    toNum(step4?.clientWorkerRate) -
    toNum(step4?.defaultWorkerRate);
  const profitPositive = profit >= 0;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <header className="text-center mb-6">
        <div className="text-4xl mb-2" aria-hidden>
          ✅
        </div>
        <h2 className="text-xl font-bold text-gray-900">סיכום</h2>
        <p className="mt-2 text-sm text-gray-600">
          בדוק את הפרטים לפני שמתחילים.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
        <div className={CARD_CLASS}>
          <CardHeader icon="🔐" title="סיסמה" />
          <p className="text-sm text-green-700 font-medium flex items-center gap-2">
            <span aria-hidden>✓</span>
            <span>הסיסמה שונתה בהצלחה</span>
          </p>
        </div>

        <div className={CARD_CLASS}>
          <CardHeader icon="🏢" title="פרטי החברה" step={2} onEdit={onEdit} />
          <dl className="space-y-1.5">
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>שם:</dt>
              <dd className={VALUE_CLASS}>{step2?.companyName || '—'}</dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>טלפון:</dt>
              <dd className={step2?.phone ? VALUE_CLASS : EMPTY_CLASS}>
                {step2?.phone || 'לא הוזן'}
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>כתובת:</dt>
              <dd className={step2?.address ? VALUE_CLASS : EMPTY_CLASS}>
                {step2?.address || 'לא הוזן'}
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>מספר עוסק:</dt>
              <dd className={step2?.taxId ? VALUE_CLASS : EMPTY_CLASS}>
                {step2?.taxId || 'לא הוזן'}
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>לוגו:</dt>
              <dd
                className={
                  step2?.logoBase64
                    ? 'text-green-700 font-medium'
                    : EMPTY_CLASS
                }
              >
                {step2?.logoBase64 ? 'הועלה ✓' : 'לא הועלה'}
              </dd>
            </div>
          </dl>
        </div>

        <div className={CARD_CLASS}>
          <CardHeader icon="🔧" title="סוג העסק" step={3} onEdit={onEdit} />
          <div className="space-y-2">
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>שם הציוד:</dt>
              <dd className={VALUE_CLASS}>
                {step3?.equipmentLabelHe || '—'}
              </dd>
            </div>
            <div>
              <p className={`${LABEL_CLASS} mb-2 text-sm`}>סוגים:</p>
              {step3?.types && step3.types.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {step3.types.map((t, i) => (
                    <span
                      key={`${i}-${t.name}`}
                      className="inline-flex items-center bg-amber-100 text-[#92400e] px-2.5 py-1 rounded-full text-xs font-medium"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={`${EMPTY_CLASS} text-sm`}>לא הוגדרו סוגים</p>
              )}
            </div>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <CardHeader icon="💰" title="תמחור" step={4} onEdit={onEdit} />
          <dl className="space-y-1.5">
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>הכנסה מציוד:</dt>
              <dd className={VALUE_CLASS} dir="ltr">
                ₪{formatInt(step4?.clientEquipmentRate)}/יום
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>הכנסה מעובד:</dt>
              <dd className={VALUE_CLASS} dir="ltr">
                ₪{formatInt(step4?.clientWorkerRate)}/יום
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>עלות עובד:</dt>
              <dd className={VALUE_CLASS} dir="ltr">
                ₪{formatInt(step4?.defaultWorkerRate)}/יום
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>דלק:</dt>
              <dd className={VALUE_CLASS} dir="ltr">
                ₪{formatDecimal(step4?.fuelPrice)}/ליטר
              </dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>מע״מ:</dt>
              <dd className={VALUE_CLASS} dir="ltr">
                {formatDecimal(step4?.vatRate)}%
              </dd>
            </div>
          </dl>

          <div
            className={`mt-3 rounded-lg border p-2.5 text-center text-sm ${
              profitPositive
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span className="text-xs">רווח יומי משוער: </span>
            <span className="font-bold" dir="ltr">
              ₪{profit.toLocaleString('he-IL')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
