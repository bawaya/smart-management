'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import type { Role } from '@/lib/auth/rbac';
import {
  addUserAction,
  resetPasswordAction,
  toggleUserAction,
  updateUserAction,
} from '../actions';

export interface UserRow {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: number;
  must_change_password: number;
}

interface UsersManagerProps {
  tenantId: string;
  currentUserId: string;
  users: UserRow[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'owner', label: 'בעלים' },
  { value: 'manager', label: 'מנהל' },
  { value: 'accountant', label: 'רואה חשבון' },
  { value: 'operator', label: 'מפעיל' },
  { value: 'viewer', label: 'צופה' },
];

const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  manager: 'bg-blue-100 text-blue-800',
  accountant: 'bg-green-100 text-green-800',
  operator: 'bg-gray-200 text-gray-800',
  viewer: 'bg-gray-100 text-gray-600',
};

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function RoleBadge({ role }: { role: string }) {
  const className = ROLE_BADGE[role] ?? 'bg-gray-100 text-gray-600';
  const label = ROLE_LABELS[role] ?? role;
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {active ? 'פעיל' : 'מושבת'}
    </span>
  );
}

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-md bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60"
    >
      {children}
    </button>
  );
}

type FormMode =
  | { mode: 'add' }
  | { mode: 'edit'; user: UserRow };

interface UserFormModalProps {
  tenantId: string;
  state: FormMode;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function UserFormModal({
  tenantId,
  state,
  currentUserId,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const editing = state.mode === 'edit';
  const editingSelf = editing && state.user.id === currentUserId;
  const initialUser = editing ? state.user : null;

  const [fullName, setFullName] = useState(initialUser?.full_name ?? '');
  const [username, setUsername] = useState(initialUser?.username ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(initialUser?.phone ?? '');
  const [email, setEmail] = useState(initialUser?.email ?? '');
  const [role, setRole] = useState<Role>(
    ((initialUser?.role as Role) ?? 'viewer') as Role,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canChangeRole = !editingSelf;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('שם משתמש חובה');
      return;
    }
    if (!editing && password.length < 8) {
      setError('סיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        fullName,
        phone,
        email,
        role,
      };
      if (editing) {
        const res = await updateUserAction(tenantId, state.user.id, payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        onSuccess('הפרטים עודכנו בהצלחה');
      } else {
        const res = await addUserAction(tenantId, {
          ...payload,
          username: cleanUsername,
          password,
        });
        if (!res.success) {
          setError(res.error);
          return;
        }
        onSuccess('המשתמש נוסף בהצלחה');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת משתמש' : 'הוספת משתמש'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם מלא
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם משתמש <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={editing}
            dir="ltr"
            required
            className={`${INPUT_CLASS} ${editing ? 'opacity-60' : ''}`}
          />
        </div>

        {!editing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סיסמה <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">
              לפחות 8 תווים. המשתמש יתבקש לשנות אותה בהתחברות הראשונה.
            </p>
          </div>
        )}

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
            אימייל
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            תפקיד
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={!canChangeRole}
            className={`${INPUT_CLASS} ${!canChangeRole ? 'opacity-60' : ''}`}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {!canChangeRole && (
            <p className="mt-1 text-xs text-gray-500">
              לא ניתן לשנות את התפקיד של עצמך
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton onClick={onClose} disabled={submitting}>
            ביטול
          </GhostButton>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? 'שומר...' : 'שמור'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

interface ToggleModalProps {
  tenantId: string;
  user: UserRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ToggleModal({ tenantId, user, onClose, onSuccess }: ToggleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activating = user.is_active !== 1;

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await toggleUserAction(tenantId, user.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(
        activating ? 'המשתמש הופעל בהצלחה' : 'המשתמש הושבת בהצלחה',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-900">
        {activating ? 'הפעלת משתמש' : 'השבתת משתמש'}
      </h3>
      <p className="mt-2 text-sm text-gray-600">
        {activating
          ? `האם להפעיל מחדש את ${user.username}?`
          : `האם להשבית את ${user.username}? המשתמש לא יוכל להיכנס עד להפעלה מחדש.`}
      </p>
      {error && (
        <div
          role="alert"
          className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {error}
        </div>
      )}
      <div className="mt-5 flex items-center justify-end gap-2">
        <GhostButton onClick={onClose} disabled={submitting}>
          ביטול
        </GhostButton>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={`px-4 py-2 rounded-md text-white font-bold text-sm transition-colors disabled:opacity-60 ${
            activating
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {submitting ? '...' : activating ? 'הפעל' : 'השבת'}
        </button>
      </div>
    </Modal>
  );
}

interface ResetModalProps {
  tenantId: string;
  user: UserRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ResetPasswordModal({
  tenantId,
  user,
  onClose,
  onSuccess,
}: ResetModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (newPassword.length < 8) {
      setError('סיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await resetPasswordAction(tenantId, user.id, newPassword);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('הסיסמה אופסה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-900">איפוס סיסמה</h3>
      <p className="mt-1 text-sm text-gray-600">
        איפוס סיסמה עבור {user.username}. המשתמש יתבקש לשנות אותה בהתחברות
        הבאה.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סיסמה חדשה
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-gray-500">לפחות 8 תווים</p>
        </div>
        {error && (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton onClick={onClose} disabled={submitting}>
            ביטול
          </GhostButton>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? 'מאפס...' : 'אפס סיסמה'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function UsersManager({
  tenantId,
  currentUserId,
  users,
}: UsersManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormMode | null>(null);
  const [toggleUser, setToggleUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [message, setMessage] = useState<Message>(null);

  function handleSuccess(text: string): void {
    setFormState(null);
    setToggleUser(null);
    setResetUser(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            👥
          </span>
          ניהול משתמשים
        </h1>
        <PrimaryButton onClick={() => setFormState({ mode: 'add' })}>
          + הוסף משתמש
        </PrimaryButton>
      </header>

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg text-sm text-center border ${
            message.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">שם מלא</th>
              <th className="px-4 py-3 font-medium text-gray-700">שם משתמש</th>
              <th className="px-4 py-3 font-medium text-gray-700">תפקיד</th>
              <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
              <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  אין משתמשים עדיין
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentUserId;
                const active = user.is_active === 1;
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-gray-900">
                      {user.full_name || '—'}
                      {isSelf && (
                        <span className="ms-2 text-xs text-gray-400">
                          (את/ה)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900" dir="ltr">
                      {user.username}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <GhostButton
                          onClick={() =>
                            setFormState({ mode: 'edit', user })
                          }
                        >
                          עריכה
                        </GhostButton>
                        <GhostButton onClick={() => setResetUser(user)}>
                          איפוס סיסמה
                        </GhostButton>
                        <button
                          type="button"
                          onClick={() => setToggleUser(user)}
                          disabled={isSelf}
                          className={`px-3 py-2 rounded-md text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {active ? 'השבתה' : 'הפעלה'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formState && (
        <UserFormModal
          key={formState.mode === 'edit' ? formState.user.id : 'add'}
          tenantId={tenantId}
          state={formState}
          currentUserId={currentUserId}
          onClose={() => setFormState(null)}
          onSuccess={handleSuccess}
        />
      )}

      {toggleUser && (
        <ToggleModal
          tenantId={tenantId}
          user={toggleUser}
          onClose={() => setToggleUser(null)}
          onSuccess={handleSuccess}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          key={resetUser.id}
          tenantId={tenantId}
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
