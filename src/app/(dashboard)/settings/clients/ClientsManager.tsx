'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import {
  addClientAction,
  toggleClientAction,
  updateClientAction,
} from '../actions';

export interface ClientRow {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  equipment_daily_rate: number | null;
  worker_daily_rate: number | null;
  notes: string | null;
  is_active: number;
}

interface ClientsManagerProps {
  tenantId: string;
  equipmentLabel: string;
  clients: ClientRow[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type FormMode = { mode: 'add' } | { mode: 'edit'; client: ClientRow };

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function rateToInputValue(n: number | null): string {
  return n == null ? '' : String(n);
}

function formatRate(n: number | null): string {
  if (n == null) return '';
  return `₪${n.toLocaleString('he-IL')}/יום`;
}

function DefaultRate() {
  return <span className="text-xs text-gray-400">ברירת מחדל</span>;
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
  size = 'lg',
}: {
  onClose: () => void;
  children: ReactNode;
  size?: 'lg' | '2xl';
}) {
  const widthClass = size === '2xl' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-lg p-6 w-full text-right max-h-[90vh] overflow-y-auto ${widthClass}`}
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
  testId,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  testId?: string;
}) {
  return (
    <button
      type={type}
      data-testid={testId}
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
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60"
    >
      {children}
    </button>
  );
}

interface ClientFormModalProps {
  tenantId: string;
  equipmentLabel: string;
  state: FormMode;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ClientFormModal({
  tenantId,
  equipmentLabel,
  state,
  onClose,
  onSuccess,
}: ClientFormModalProps) {
  const editing = state.mode === 'edit';
  const initial = editing ? state.client : null;

  const [name, setName] = useState(initial?.name ?? '');
  const [contactPerson, setContactPerson] = useState(
    initial?.contact_person ?? '',
  );
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [taxId, setTaxId] = useState(initial?.tax_id ?? '');
  const [equipmentRate, setEquipmentRate] = useState(
    rateToInputValue(initial?.equipment_daily_rate ?? null),
  );
  const [workerRate, setWorkerRate] = useState(
    rateToInputValue(initial?.worker_daily_rate ?? null),
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError('שם החברה חובה');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        contactPerson,
        phone,
        email,
        address,
        taxId,
        equipmentDailyRate: equipmentRate,
        workerDailyRate: workerRate,
        notes,
      };
      const res = editing
        ? await updateClientAction(tenantId, state.client.id, payload)
        : await addClientAction(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'הפרטים עודכנו בהצלחה' : 'הלקוח נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת לקוח' : 'הוספת לקוח'}
      </h3>
      <form
        onSubmit={handleSubmit}
        data-testid="clients-form"
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם החברה <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              data-testid="clients-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              איש קשר
            </label>
            <input
              type="text"
              data-testid="clients-form-contact-person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              טלפון
            </label>
            <input
              type="tel"
              data-testid="clients-form-phone"
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
              data-testid="clients-form-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מספר עוסק / ח.פ
            </label>
            <input
              type="text"
              data-testid="clients-form-tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              כתובת
            </label>
            <input
              type="text"
              data-testid="clients-form-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <section className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <header className="mb-2">
            <h4 className="text-sm font-semibold text-gray-800">
              תמחור מיוחד (אופציונלי)
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              השאר ריק לשימוש במחיר ברירת המחדל
            </p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מחיר יומי ל{equipmentLabel}
              </label>
              <input
                type="number"
                data-testid="clients-form-equipment-rate"
                dir="ltr"
                min="0"
                step="0.01"
                placeholder="ברירת מחדל"
                value={equipmentRate}
                onChange={(e) => setEquipmentRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מחיר יומי לעובד
              </label>
              <input
                type="number"
                data-testid="clients-form-worker-rate"
                dir="ltr"
                min="0"
                step="0.01"
                placeholder="ברירת מחדל"
                value={workerRate}
                onChange={(e) => setWorkerRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            הערות
          </label>
          <textarea
            data-testid="clients-form-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <div
            role="alert"
            data-testid="clients-form-error"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="clients-form-cancel"
          >
            ביטול
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={submitting}
            testId="clients-form-submit"
          >
            {submitting ? 'שומר...' : 'שמור'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

interface ToggleModalProps {
  tenantId: string;
  client: ClientRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ToggleModal({
  tenantId,
  client,
  onClose,
  onSuccess,
}: ToggleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activating = client.is_active !== 1;

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await toggleClientAction(tenantId, client.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(activating ? 'הלקוח הופעל בהצלחה' : 'הלקוח הושבת בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div data-testid="clients-toggle-modal">
        <h3 className="text-lg font-bold text-gray-900">
          {activating ? 'הפעלת לקוח' : 'השבתת לקוח'}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {activating
            ? `האם להפעיל מחדש את ${client.name}?`
            : `האם להשבית את ${client.name}? לא ניתן יהיה לצרף אותו לרישומים חדשים.`}
        </p>
        {error && (
          <div
            role="alert"
            data-testid="clients-toggle-error"
            className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="clients-toggle-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="clients-toggle-confirm"
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
      </div>
    </Modal>
  );
}

function ClientCard({
  client,
  equipmentLabel,
  onEdit,
  onToggle,
}: {
  client: ClientRow;
  equipmentLabel: string;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const active = client.is_active === 1;
  return (
    <div
      data-testid="clients-row"
      data-client-id={client.id}
      data-clients-active={active ? '1' : '0'}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            data-testid="clients-row-name"
            className="font-bold text-gray-900 truncate"
          >
            {client.name}
          </h3>
          {client.contact_person && (
            <p
              data-testid="clients-row-contact"
              className="text-sm text-gray-600 truncate"
            >
              {client.contact_person}
            </p>
          )}
        </div>
        <div data-testid="clients-row-active">
          <StatusBadge active={active} />
        </div>
      </header>

      {client.phone && (
        <p className="mt-2 text-sm text-gray-700" dir="ltr">
          {client.phone}
        </p>
      )}

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">מחיר {equipmentLabel}:</dt>
          <dd>
            {client.equipment_daily_rate != null ? (
              <span dir="ltr">{formatRate(client.equipment_daily_rate)}</span>
            ) : (
              <DefaultRate />
            )}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">מחיר עובד:</dt>
          <dd>
            {client.worker_daily_rate != null ? (
              <span dir="ltr">{formatRate(client.worker_daily_rate)}</span>
            ) : (
              <DefaultRate />
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onEdit} testId="clients-row-edit">
          עריכה
        </GhostButton>
        <button
          type="button"
          data-testid="clients-row-toggle"
          onClick={onToggle}
          className={`px-3 py-2 rounded-md text-sm transition-colors ${
            active
              ? 'text-red-600 hover:bg-red-50'
              : 'text-green-700 hover:bg-green-50'
          }`}
        >
          {active ? 'השבתה' : 'הפעלה'}
        </button>
      </div>
    </div>
  );
}

export function ClientsManager({
  tenantId,
  equipmentLabel,
  clients,
}: ClientsManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormMode | null>(null);
  const [toggleClient, setToggleClient] = useState<ClientRow | null>(null);
  const [message, setMessage] = useState<Message>(null);

  function handleSuccess(text: string): void {
    setFormState(null);
    setToggleClient(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            🤝
          </span>
          ניהול לקוחות
        </h1>
        <PrimaryButton
          onClick={() => setFormState({ mode: 'add' })}
          testId="clients-add-button"
        >
          + הוסף לקוח
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

      {clients.length === 0 ? (
        <div
          data-testid="clients-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">
            אין לקוחות עדיין. הוסף את הלקוח הראשון שלך.
          </p>
        </div>
      ) : (
        <>
          <div
            data-testid="clients-list"
            className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">שם</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    איש קשר
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">טלפון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    מחיר {equipmentLabel}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    מחיר עובד
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => {
                  const active = client.is_active === 1;
                  return (
                    <tr
                      key={client.id}
                      data-testid="clients-row"
                      data-client-id={client.id}
                      data-clients-active={active ? '1' : '0'}
                    >
                      <td
                        data-testid="clients-row-name"
                        className="px-4 py-3 text-gray-900 font-medium"
                      >
                        {client.name}
                      </td>
                      <td
                        data-testid="clients-row-contact"
                        className="px-4 py-3 text-gray-700"
                      >
                        {client.contact_person ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700" dir="ltr">
                        {client.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-900" dir="ltr">
                        {client.equipment_daily_rate != null ? (
                          formatRate(client.equipment_daily_rate)
                        ) : (
                          <DefaultRate />
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900" dir="ltr">
                        {client.worker_daily_rate != null ? (
                          formatRate(client.worker_daily_rate)
                        ) : (
                          <DefaultRate />
                        )}
                      </td>
                      <td data-testid="clients-row-active" className="px-4 py-3">
                        <StatusBadge active={active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() =>
                              setFormState({ mode: 'edit', client })
                            }
                            testId="clients-row-edit"
                          >
                            עריכה
                          </GhostButton>
                          <button
                            type="button"
                            data-testid="clients-row-toggle"
                            onClick={() => setToggleClient(client)}
                            className={`px-3 py-2 rounded-md text-sm transition-colors ${
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
                })}
              </tbody>
            </table>
          </div>

          <div data-testid="clients-list" className="md:hidden space-y-3">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                equipmentLabel={equipmentLabel}
                onEdit={() => setFormState({ mode: 'edit', client })}
                onToggle={() => setToggleClient(client)}
              />
            ))}
          </div>
        </>
      )}

      {formState && (
        <ClientFormModal
          key={formState.mode === 'edit' ? formState.client.id : 'add'}
          tenantId={tenantId}
          equipmentLabel={equipmentLabel}
          state={formState}
          onClose={() => setFormState(null)}
          onSuccess={handleSuccess}
        />
      )}

      {toggleClient && (
        <ToggleModal
          tenantId={tenantId}
          client={toggleClient}
          onClose={() => setToggleClient(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
