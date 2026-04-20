'use client';

import { type KeyboardEvent, useState } from 'react';

export interface EquipmentTypeItem {
  name: string;
}

export interface Step3Data {
  equipmentLabelHe: string;
  equipmentLabelAr: string;
  types: EquipmentTypeItem[];
  isValid: boolean;
}

interface Step3BusinessProps {
  data: Partial<Step3Data>;
  onUpdate: (data: Step3Data) => void;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function computeValid(labelHe: string, types: EquipmentTypeItem[]): boolean {
  return labelHe.trim().length > 0 && types.length > 0;
}

export function Step3Business({ data, onUpdate }: Step3BusinessProps) {
  const equipmentLabelHe = data.equipmentLabelHe ?? '';
  const equipmentLabelAr = data.equipmentLabelAr ?? '';
  const types = data.types ?? [];

  const [draft, setDraft] = useState<string>('');

  function emit(next: Pick<Step3Data, 'equipmentLabelHe' | 'equipmentLabelAr' | 'types'>): void {
    onUpdate({ ...next, isValid: computeValid(next.equipmentLabelHe, next.types) });
  }

  function updateLabelHe(value: string): void {
    emit({ equipmentLabelHe: value, equipmentLabelAr, types });
  }

  function updateLabelAr(value: string): void {
    emit({ equipmentLabelHe, equipmentLabelAr: value, types });
  }

  function addType(): void {
    const name = draft.trim();
    if (!name) return;
    const exists = types.some(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setDraft('');
      return;
    }
    emit({
      equipmentLabelHe,
      equipmentLabelAr,
      types: [...types, { name }],
    });
    setDraft('');
  }

  function removeType(index: number): void {
    emit({
      equipmentLabelHe,
      equipmentLabelAr,
      types: types.filter((_, i) => i !== index),
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addType();
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <header className="text-center mb-6">
        <div className="text-4xl mb-2" aria-hidden>
          🔧
        </div>
        <h2 className="text-xl font-bold text-gray-900">סוג העסק</h2>
        <p className="mt-2 text-sm text-gray-600">
          ספר לנו על העסק שלך כדי שנתאים את המערכת אליך.
        </p>
      </header>

      <section className="mb-8 text-right">
        <p className="text-sm font-medium text-gray-800 mb-3">
          איך אתה קורא ליחידות/ציוד שאתה עובד איתם?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם בעברית <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={equipmentLabelHe}
              onChange={(e) => updateLabelHe(e.target.value)}
              placeholder="עגלות / גנרטורים / מנופים"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם בערבית
            </label>
            <input
              type="text"
              value={equipmentLabelAr}
              onChange={(e) => updateLabelAr(e.target.value)}
              placeholder="عربيات / مولدات / رافعات"
              className={INPUT_CLASS}
              dir="rtl"
              lang="ar"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          השם שתבחר יופיע בכל המערכת
        </p>
      </section>

      <section className="text-right">
        <h3 className="text-sm font-medium text-gray-800 mb-1">
          הוסף את סוגי הציוד שלך
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          למשל: עגלת חץ, בלון תאורה, עין חתול — או: גנרטור 50KVA, גנרטור 100KVA
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="שם הסוג"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={addType}
            disabled={draft.trim().length === 0}
            className="shrink-0 px-5 py-3 rounded-lg bg-[#f59e0b] text-black font-bold hover:bg-[#d97706] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            הוסף
          </button>
        </div>

        {types.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {types.map((type, index) => (
              <span
                key={`${index}-${type.name}`}
                className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 ps-3 pe-2 py-1.5 rounded-full text-sm"
              >
                <span>{type.name}</span>
                <button
                  type="button"
                  onClick={() => removeType(index)}
                  aria-label={`הסר ${type.name}`}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-red-600 hover:bg-red-100 transition-colors font-bold leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
