'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { useSetupSession } from '../setup-context';
import {
  type SetupFormData,
  changePasswordAction,
  completeSetup,
  saveBusinessAction,
  saveCompanyAction,
  savePricingAction,
} from './actions';
import { type Step1Data, Step1Password } from './steps/Step1Password';
import { type Step2Data, Step2Company } from './steps/Step2Company';
import { type Step3Data, Step3Business } from './steps/Step3Business';
import { type Step4Data, Step4Pricing } from './steps/Step4Pricing';
import { Step5Summary } from './steps/Step5Summary';

export const runtime = 'edge';

interface Step {
  num: number;
  label: string;
}

const STEPS: Step[] = [
  { num: 1, label: 'סיסמה' },
  { num: 2, label: 'פרטי החברה' },
  { num: 3, label: 'סוג העסק' },
  { num: 4, label: 'תמחור' },
  { num: 5, label: 'סיכום' },
];

interface WizardFormData extends SetupFormData {
  step1?: Step1Data;
  step2?: Step2Data;
  step3?: Step3Data;
  step4?: Step4Data;
}

const DEFAULT_STEP4: Step4Data = {
  clientEquipmentRate: '',
  clientWorkerRate: '',
  defaultWorkerRate: '',
  fuelPrice: '',
  vatRate: '17',
  isValid: true,
};

type StepState = 'done' | 'active' | 'pending';

function stepState(step: number, current: number): StepState {
  if (step < current) return 'done';
  if (step === current) return 'active';
  return 'pending';
}

function circleClasses(state: StepState): string {
  if (state === 'active') return 'bg-[#f59e0b] text-black';
  if (state === 'done') return 'bg-green-500 text-white';
  return 'bg-gray-300 text-gray-600';
}

function connectorClasses(done: boolean): string {
  return done ? 'bg-green-500' : 'bg-gray-300';
}

export default function SetupWizardPage() {
  const router = useRouter();
  const { userId, tenantId } = useSetupSession();
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<WizardFormData>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isFirst = step === 1;
  const isLast = step === STEPS.length;

  const step1Valid = formData.step1?.isValid === true;
  const step2Valid = formData.step2?.isValid === true;
  const step3Valid = formData.step3?.isValid === true;

  const nextDisabled =
    submitting ||
    (step === 1 && !step1Valid) ||
    (step === 2 && !step2Valid) ||
    (step === 3 && !step3Valid);

  function handleBack(): void {
    if (isFirst || submitting) return;
    setActionError(null);
    setStep((s) => s - 1);
  }

  async function handleNext(): Promise<void> {
    if (submitting) return;

    if (step === 1) {
      const step1 = formData.step1;
      if (!step1 || !step1.isValid) return;

      setActionError(null);
      setSubmitting(true);
      try {
        const result = await changePasswordAction(
          userId,
          step1.currentPassword,
          step1.newPassword,
        );
        if (!result.success) {
          setActionError(result.error);
          return;
        }
        setStep(2);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 2) {
      const step2 = formData.step2;
      if (!step2 || !step2.isValid) return;

      setActionError(null);
      setSubmitting(true);
      try {
        const result = await saveCompanyAction(tenantId, {
          companyName: step2.companyName,
          phone: step2.phone,
          address: step2.address,
          taxId: step2.taxId,
          logoBase64: step2.logoBase64,
          logoFileName: step2.logoFileName,
        });
        if (!result.success) {
          setActionError(result.error);
          return;
        }
        setStep(3);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 3) {
      const step3 = formData.step3;
      if (!step3 || !step3.isValid) return;

      setActionError(null);
      setSubmitting(true);
      try {
        const result = await saveBusinessAction(tenantId, {
          equipmentLabelHe: step3.equipmentLabelHe,
          equipmentLabelAr: step3.equipmentLabelAr,
          types: step3.types,
        });
        if (!result.success) {
          setActionError(result.error);
          return;
        }
        setStep(4);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 4) {
      const step4 = formData.step4 ?? DEFAULT_STEP4;

      setActionError(null);
      setSubmitting(true);
      try {
        const result = await savePricingAction(tenantId, {
          clientEquipmentRate: step4.clientEquipmentRate,
          clientWorkerRate: step4.clientWorkerRate,
          defaultWorkerRate: step4.defaultWorkerRate,
          fuelPrice: step4.fuelPrice,
          vatRate: step4.vatRate,
        });
        if (!result.success) {
          setActionError(result.error);
          return;
        }
        setStep(5);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!isLast) {
      setActionError(null);
      setStep((s) => s + 1);
      return;
    }

    setActionError(null);
    setSubmitting(true);
    try {
      const result = await completeSetup(tenantId);
      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        setActionError('שגיאה בהפעלת המערכת');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function goToStep(target: number): void {
    if (submitting) return;
    if (target < 1 || target > STEPS.length) return;
    setActionError(null);
    setStep(target);
  }

  function updateStep1(data: Step1Data): void {
    setFormData((prev) => ({ ...prev, step1: data }));
    if (actionError) setActionError(null);
  }

  function updateStep2(data: Step2Data): void {
    setFormData((prev) => ({ ...prev, step2: data }));
    if (actionError) setActionError(null);
  }

  function updateStep3(data: Step3Data): void {
    setFormData((prev) => ({ ...prev, step3: data }));
    if (actionError) setActionError(null);
  }

  function updateStep4(data: Step4Data): void {
    setFormData((prev) => ({ ...prev, step4: data }));
    if (actionError) setActionError(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm p-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#f59e0b]">ניהול חכם</h1>
          <p className="mt-1 text-sm text-gray-500">הגדרה ראשונית</p>
        </header>

        <div className="flex items-center mb-10">
          {STEPS.map((s, i) => {
            const state = stepState(s.num, step);
            const isLastStep = i === STEPS.length - 1;
            return (
              <Fragment key={s.num}>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${circleClasses(
                      state,
                    )}`}
                  >
                    {state === 'done' ? '✓' : s.num}
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {s.label}
                  </span>
                </div>
                {!isLastStep && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${connectorClasses(
                      s.num < step,
                    )}`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>

        <section className="min-h-[280px] flex items-center justify-center">
          {step === 1 ? (
            <Step1Password data={formData.step1 ?? {}} onUpdate={updateStep1} />
          ) : step === 2 ? (
            <Step2Company data={formData.step2 ?? {}} onUpdate={updateStep2} />
          ) : step === 3 ? (
            <Step3Business data={formData.step3 ?? {}} onUpdate={updateStep3} />
          ) : step === 4 ? (
            <Step4Pricing
              data={formData.step4 ?? DEFAULT_STEP4}
              onUpdate={updateStep4}
              equipmentLabel={formData.step3?.equipmentLabelHe || 'ציוד'}
            />
          ) : (
            <Step5Summary formData={formData} onEdit={goToStep} />
          )}
        </section>

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-red-600 text-center">
            {actionError}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {isFirst ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              הקודם
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
            className={`rounded-lg bg-[#f59e0b] text-black font-bold hover:bg-[#d97706] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ms-auto ${
              isLast ? 'px-8 py-3.5 text-lg' : 'px-6 py-2.5'
            }`}
          >
            {isLast
              ? submitting
                ? 'מפעיל את המערכת...'
                : 'התחל להשתמש בניהול חכם'
              : submitting
                ? 'שומר...'
                : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}
