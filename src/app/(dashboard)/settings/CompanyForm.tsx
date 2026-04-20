'use client';

import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from 'react';
import { updateCompanyAction } from './actions';

interface CompanyFormProps {
  tenantId: string;
  initialData: {
    companyName: string;
    phone: string;
    address: string;
    taxId: string;
    hasLogo: boolean;
  };
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

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

export function CompanyForm({ tenantId, initialData }: CompanyFormProps) {
  const router = useRouter();

  const [companyName, setCompanyName] = useState(initialData.companyName);
  const [phone, setPhone] = useState(initialData.phone);
  const [address, setAddress] = useState(initialData.address);
  const [taxId, setTaxId] = useState(initialData.taxId);

  const [newLogoBase64, setNewLogoBase64] = useState<string | null>(null);
  const [newLogoFileName, setNewLogoFileName] = useState<string | null>(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);

  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingLogoPresent = initialData.hasLogo && !removeExistingLogo;
  const newPreviewSrc =
    newLogoBase64 && newLogoFileName
      ? `data:${mimeFromFilename(newLogoFileName)};base64,${newLogoBase64}`
      : null;

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [success]);

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
    setNewLogoBase64(base64);
    setNewLogoFileName(file.name);
    setRemoveExistingLogo(false);
  }

  function handleClearNewLogo(): void {
    setNewLogoBase64(null);
    setNewLogoFileName(null);
    setFileError(null);
  }

  function handleRemoveExistingLogo(): void {
    setRemoveExistingLogo(true);
    setNewLogoBase64(null);
    setNewLogoFileName(null);
    setFileError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!companyName.trim()) {
      setError('שם החברה חובה');
      return;
    }

    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const result = await updateCompanyAction(tenantId, {
        companyName,
        phone,
        address,
        taxId,
        logoBase64: newLogoBase64,
        logoFileName: newLogoFileName,
        removeLogo: removeExistingLogo && !newLogoBase64,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setNewLogoBase64(null);
      setNewLogoFileName(null);
      setRemoveExistingLogo(false);
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
        <h2 className="text-lg font-bold text-gray-900">פרטי החברה</h2>
        <p className="mt-1 text-sm text-gray-600">
          הפרטים יופיעו בחשבוניות ובדוחות.
        </p>
      </header>

      <div className="mb-6">
        {newPreviewSrc ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={newPreviewSrc}
              alt={newLogoFileName ?? 'לוגו'}
              className="max-h-32 max-w-full rounded-lg border border-gray-200 bg-white p-2 object-contain"
            />
            <button
              type="button"
              onClick={handleClearNewLogo}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              בטל העלאה
            </button>
          </div>
        ) : existingLogoPresent ? (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <span className="text-sm font-medium text-green-700">
              לוגו קיים ✓
            </span>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#d97706] hover:text-[#b45309] cursor-pointer">
                החלף
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleRemoveExistingLogo}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                הסר
              </button>
            </div>
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
            onChange={(e) => setCompanyName(e.target.value)}
            required
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
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            כתובת
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
            onChange={(e) => setTaxId(e.target.value)}
            dir="ltr"
            className={INPUT_CLASS}
          />
        </div>
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
