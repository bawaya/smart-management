'use client';

export interface Step1Data {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  isValid: boolean;
}

interface Step1PasswordProps {
  data: Partial<Step1Data>;
  onUpdate: (data: Step1Data) => void;
}

type Strength = 'weak' | 'medium' | 'strong';

interface FieldErrors {
  newPassword?: string;
  confirmPassword?: string;
}

function countTypes(password: string): number {
  let types = 0;
  if (/[A-Z]/.test(password)) types += 1;
  if (/[a-z]/.test(password)) types += 1;
  if (/\d/.test(password)) types += 1;
  return types;
}

function computeStrength(password: string): Strength | null {
  if (password.length === 0) return null;
  if (password.length < 8) return 'weak';
  const types = countTypes(password);
  if (types >= 3) return 'strong';
  if (types === 2) return 'medium';
  return 'weak';
}

function validate(newPassword: string, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {};

  if (newPassword.length > 0 && newPassword.length < 8) {
    errors.newPassword = 'הסיסמה חייבת להכיל לפחות 8 תווים';
  } else if (newPassword.length >= 8 && !/[A-Z]/.test(newPassword)) {
    errors.newPassword = 'הסיסמה חייבת להכיל אות גדולה באנגלית';
  } else if (newPassword.length >= 8 && !/[a-z]/.test(newPassword)) {
    errors.newPassword = 'הסיסמה חייבת להכיל אות קטנה באנגלית';
  } else if (newPassword.length >= 8 && !/\d/.test(newPassword)) {
    errors.newPassword = 'הסיסמה חייבת להכיל ספרה';
  }

  if (confirmPassword.length > 0 && confirmPassword !== newPassword) {
    errors.confirmPassword = 'הסיסמאות אינן תואמות';
  }

  return errors;
}

function isFullyValid(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): boolean {
  if (!currentPassword) return false;
  if (newPassword.length < 8) return false;
  if (countTypes(newPassword) < 3) return false;
  if (newPassword !== confirmPassword) return false;
  return true;
}

const STRENGTH_LABELS: Record<Strength, string> = {
  weak: 'חלשה',
  medium: 'בינונית',
  strong: 'חזקה',
};

const STRENGTH_BAR_COLOR: Record<Strength, string> = {
  weak: 'bg-red-500',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const STRENGTH_TEXT_COLOR: Record<Strength, string> = {
  weak: 'text-red-600',
  medium: 'text-yellow-700',
  strong: 'text-green-700',
};

const STRENGTH_SEGMENTS: Record<Strength, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

function StrengthMeter({ strength }: { strength: Strength }) {
  const filled = STRENGTH_SEGMENTS[strength];
  const barColor = STRENGTH_BAR_COLOR[strength];
  const textColor = STRENGTH_TEXT_COLOR[strength];

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= filled ? barColor : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${textColor}`}>
        {STRENGTH_LABELS[strength]}
      </span>
    </div>
  );
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

export function Step1Password({ data, onUpdate }: Step1PasswordProps) {
  const currentPassword = data.currentPassword ?? '';
  const newPassword = data.newPassword ?? '';
  const confirmPassword = data.confirmPassword ?? '';

  const errors = validate(newPassword, confirmPassword);
  const strength = computeStrength(newPassword);

  function emit(changes: Partial<Pick<Step1Data, 'currentPassword' | 'newPassword' | 'confirmPassword'>>): void {
    const next = {
      currentPassword,
      newPassword,
      confirmPassword,
      ...changes,
    };
    onUpdate({
      ...next,
      isValid: isFullyValid(
        next.currentPassword,
        next.newPassword,
        next.confirmPassword,
      ),
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <header className="text-center mb-6">
        <div className="text-4xl mb-2" aria-hidden>
          🔐
        </div>
        <h2 className="text-xl font-bold text-gray-900">שינוי סיסמה</h2>
        <p className="mt-2 text-sm text-gray-600">
          הסיסמה הנוכחית היא ברירת מחדל. יש לשנות אותה לסיסמה חזקה.
        </p>
      </header>

      <div className="space-y-4 text-right">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סיסמה נוכחית
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => emit({ currentPassword: e.target.value })}
            className={`${INPUT_CLASS} border-gray-300`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סיסמה חדשה
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => emit({ newPassword: e.target.value })}
            className={`${INPUT_CLASS} ${
              errors.newPassword ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {strength && <StrengthMeter strength={strength} />}
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            אימות סיסמה
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => emit({ confirmPassword: e.target.value })}
            className={`${INPUT_CLASS} ${
              errors.confirmPassword ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">
              {errors.confirmPassword}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
