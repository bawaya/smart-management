'use client';

import { type ChangeEvent, useState } from 'react';

export interface Step2Data {
  companyName: string;
  phone: string;
  address: string;
  taxId: string;
  logoBase64: string | null;
  logoFileName: string | null;
  isValid: boolean;
}

interface Step2CompanyProps {
  data: Partial<Step2Data>;
  onUpdate: (data: Step2Data) => void;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

function mimeFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

export function Step2Company({ data, onUpdate }: Step2CompanyProps) {
  const companyName = data.companyName ?? '';
  const phone = data.phone ?? '';
  const address = data.address ?? '';
  const taxId = data.taxId ?? '';
  const logoBase64 = data.logoBase64 ?? null;
  const logoFileName = data.logoFileName ?? null;

  const [fileError, setFileError] = useState<string | null>(null);

  const previewSrc =
    logoBase64 && logoFileName
      ? `data:${mimeFromFilename(logoFileName)};base64,${logoBase64}`
      : null;

  function emit(changes: Partial<Step2Data>): void {
    const next: Step2Data = {
      companyName,
      phone,
      address,
      taxId,
      logoBase64,
      logoFileName,
      isValid: false,
      ...changes,
    };
    next.isValid = next.companyName.trim().length > 0;
    onUpdate(next);
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    setFileError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setFileError('סוג קובץ לא נתמך. מותר: PNG, JPG, SVG');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setFileError('הקובץ גדול מדי. מקסימום 2MB');
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
    if (!base64) {
      setFileError('קריאת הקובץ נכשלה');
      return;
    }
    emit({ logoBase64: base64, logoFileName: file.name });
  }

  function handleRemoveLogo(): void {
    setFileError(null);
    emit({ logoBase64: null, logoFileName: null });
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <header className="text-center mb-6">
        <div className="text-4xl mb-2" aria-hidden>
          🏢
        </div>
        <h2 className="text-xl font-bold text-gray-900">פרטי החברה</h2>
        <p className="mt-2 text-sm text-gray-600">
          הזן את פרטי החברה שלך. הם יופיעו בחשבוניות ובדוחות.
        </p>
      </header>

      <div className="mb-6">
        {previewSrc ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt={logoFileName ?? 'לוגו'}
              className="max-h-32 max-w-full rounded-lg border border-gray-200 bg-white p-2 object-contain"
            />
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              הסר
            </button>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-2 py-8 px-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#f59e0b] hover:bg-amber-50/30 transition-colors"
            aria-label="העלאת לוגו"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-sm text-gray-600">לחץ להעלאת לוגו</span>
            <span className="text-xs text-gray-400">
              PNG, JPG, SVG · עד 2MB
            </span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
        {fileError && (
          <p className="mt-2 text-sm text-red-600 text-center">{fileError}</p>
        )}
      </div>

      <div className="space-y-4 text-right">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם החברה <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => emit({ companyName: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            טלפון
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => emit({ phone: e.target.value })}
            className={INPUT_CLASS}
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            כתובת
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => emit({ address: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            מספר עוסק מורשה / ח.פ
          </label>
          <input
            type="text"
            value={taxId}
            onChange={(e) => emit({ taxId: e.target.value })}
            className={INPUT_CLASS}
            dir="ltr"
          />
        </div>
      </div>
    </div>
  );
}
