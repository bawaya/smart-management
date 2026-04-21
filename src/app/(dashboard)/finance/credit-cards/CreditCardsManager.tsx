'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import {
  type CreditCardPayload,
  type CreditCardType,
  addCreditCard,
  toggleCreditCard,
  updateCreditCard,
} from '../actions';

export interface CreditCardRow {
  id: string;
  bank_account_id: string;
  card_name: string;
  last_four_digits: string;
  card_type: CreditCardType;
  credit_limit: number;
  billing_day: number;
  closing_day: number;
  current_balance: number;
  notes: string | null;
  is_active: number;
  bank_name: string;
  account_number: string;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
}

interface CreditCardsManagerProps {
  tenantId: string;
  cards: CreditCardRow[];
  bankAccounts: BankAccountOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; card: CreditCardRow }
  | { kind: 'toggle'; card: CreditCardRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const CARD_TYPE_LABELS: Record<CreditCardType, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  isracard: 'Isracard',
  amex: 'American Express',
  diners: 'Diners',
  other: 'אחר',
};

const CARD_TYPE_BADGE: Record<CreditCardType, string> = {
  visa: 'bg-blue-100 text-blue-800',
  mastercard: 'bg-orange-100 text-orange-800',
  isracard: 'bg-red-100 text-red-800',
  amex: 'bg-teal-100 text-teal-800',
  diners: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
};

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function Modal({
  onClose,
  children,
  size = 'lg',
}: {
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | '2xl';
}) {
  const widthClass =
    size === '2xl' ? 'max-w-2xl' : size === 'md' ? 'max-w-md' : 'max-w-lg';
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

interface CardFormModalProps {
  tenantId: string;
  bankAccounts: BankAccountOption[];
  mode: 'add' | 'edit';
  card?: CreditCardRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function CardFormModal({
  tenantId,
  bankAccounts,
  mode,
  card,
  onClose,
  onSuccess,
}: CardFormModalProps) {
  const editing = mode === 'edit';
  const [bankAccountId, setBankAccountId] = useState(
    card?.bank_account_id ?? bankAccounts[0]?.id ?? '',
  );
  const [cardName, setCardName] = useState(card?.card_name ?? '');
  const [lastFour, setLastFour] = useState(card?.last_four_digits ?? '');
  const [cardType, setCardType] = useState<CreditCardType>(
    card?.card_type ?? 'visa',
  );
  const [creditLimit, setCreditLimit] = useState(
    card ? String(card.credit_limit) : '',
  );
  const [billingDay, setBillingDay] = useState(
    card ? String(card.billing_day) : '10',
  );
  const [closingDay, setClosingDay] = useState(
    card ? String(card.closing_day) : '2',
  );
  const [notes, setNotes] = useState(card?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!bankAccountId) {
      setError('חשבון בנק חובה');
      return;
    }
    if (!cardName.trim()) {
      setError('שם הכרטיס חובה');
      return;
    }
    const cleanLast = lastFour.replace(/\D/g, '');
    if (cleanLast.length !== 4) {
      setError('4 ספרות אחרונות חובה');
      return;
    }

    const payload: CreditCardPayload = {
      bankAccountId,
      cardName,
      lastFourDigits: cleanLast,
      cardType,
      creditLimit,
      billingDay,
      closingDay,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateCreditCard(tenantId, card!.id, payload)
        : await addCreditCard(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'הפרטים עודכנו בהצלחה' : 'הכרטיס נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  const noBanks = bankAccounts.length === 0;

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת כרטיס' : 'הוספת כרטיס'}
      </h3>
      {noBanks && !editing ? (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          יש להוסיף חשבון בנק לפני הוספת כרטיס אשראי.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          data-testid="credit-cards-form"
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חשבון בנק <span className="text-red-500">*</span>
            </label>
            <select
              data-testid="credit-cards-form-bank-account-id"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="">בחר חשבון בנק</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} ({b.account_number})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם הכרטיס <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="credit-cards-form-card-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                4 ספרות אחרונות <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="credit-cards-form-last-four-digits"
                value={lastFour}
                onChange={(e) => setLastFour(e.target.value)}
                maxLength={4}
                inputMode="numeric"
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סוג
              </label>
              <select
                data-testid="credit-cards-form-card-type"
                value={cardType}
                onChange={(e) => setCardType(e.target.value as CreditCardType)}
                className={INPUT_CLASS}
              >
                {(
                  [
                    'visa',
                    'mastercard',
                    'isracard',
                    'amex',
                    'diners',
                    'other',
                  ] as const
                ).map((t) => (
                  <option key={t} value={t}>
                    {CARD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מסגרת אשראי
              </label>
              <input
                type="number"
                data-testid="credit-cards-form-credit-limit"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                min="0"
                step="0.01"
                dir="ltr"
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                יום חיוב (1-31)
              </label>
              <input
                type="number"
                data-testid="credit-cards-form-billing-day"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                min="1"
                max="31"
                step="1"
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                יום סגירת מחזור (1-31)
              </label>
              <input
                type="number"
                data-testid="credit-cards-form-closing-day"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                min="1"
                max="31"
                step="1"
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות
            </label>
            <textarea
              data-testid="credit-cards-form-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={INPUT_CLASS}
            />
          </div>

          {error && (
            <div
              role="alert"
              data-testid="credit-cards-form-error"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <GhostButton
              onClick={onClose}
              disabled={submitting}
              testId="credit-cards-form-cancel"
            >
              ביטול
            </GhostButton>
            <PrimaryButton
              type="submit"
              disabled={submitting}
              testId="credit-cards-form-submit"
            >
              {submitting ? 'שומר...' : 'שמור'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ToggleModal({
  tenantId,
  card,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  card: CreditCardRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activating = card.is_active !== 1;

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await toggleCreditCard(tenantId, card.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(activating ? 'הכרטיס הופעל בהצלחה' : 'הכרטיס הושבת בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="credit-cards-toggle-modal">
        <h3 className="text-lg font-bold text-gray-900">
          {activating ? 'הפעלת כרטיס' : 'השבתת כרטיס'}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {activating
            ? `להפעיל מחדש את ${card.card_name}?`
            : `להשבית את ${card.card_name}?`}
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
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="credit-cards-toggle-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="credit-cards-toggle-confirm"
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

function CardItem({
  card,
  onEdit,
  onToggle,
}: {
  card: CreditCardRow;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const active = card.is_active === 1;
  return (
    <div
      data-testid="credit-cards-row"
      data-card-id={card.id}
      data-credit-cards-active={active ? '1' : '0'}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${
        active ? '' : 'opacity-60'
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${CARD_TYPE_BADGE[card.card_type]}`}
            >
              {CARD_TYPE_LABELS[card.card_type]}
            </span>
            <span
              data-testid="credit-cards-row-last-four"
              className="text-sm font-medium text-gray-700"
              dir="ltr"
            >
              ···· {card.last_four_digits}
            </span>
          </div>
          <h3
            data-testid="credit-cards-row-card-name"
            className="font-bold text-gray-900 mt-1 truncate"
          >
            {card.card_name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {card.bank_name}{' '}
            <span dir="ltr">({card.account_number})</span>
          </p>
        </div>
        {!active && (
          <span className="text-xs text-gray-500 shrink-0">(מושבת)</span>
        )}
      </header>

      <dl className="mt-3 space-y-0.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">מסגרת אשראי:</dt>
          <dd className="font-medium text-gray-900" dir="ltr">
            {formatILS(card.credit_limit)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">יתרה נוכחית:</dt>
          <dd
            data-testid="credit-cards-row-balance"
            className="font-medium text-gray-900"
            dir="ltr"
          >
            {formatILS(card.current_balance)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">יום חיוב:</dt>
          <dd dir="ltr">{card.billing_day} בחודש</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">יום סגירת מחזור:</dt>
          <dd dir="ltr">{card.closing_day} בחודש</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onEdit} testId="credit-cards-row-edit">
          עריכה
        </GhostButton>
        <button
          type="button"
          data-testid="credit-cards-row-toggle"
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

export function CreditCardsManager({
  tenantId,
  cards,
  bankAccounts,
}: CreditCardsManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);

  function handleSuccess(text: string): void {
    setModal(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            💳
          </span>
          כרטיסי אשראי
        </h1>
      </header>

      <div>
        <PrimaryButton
          onClick={() => setModal({ kind: 'add' })}
          testId="credit-cards-add-button"
        >
          + הוסף כרטיס
        </PrimaryButton>
      </div>

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

      {cards.length === 0 ? (
        <div
          data-testid="credit-cards-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">אין כרטיסים עדיין.</p>
        </div>
      ) : (
        <div
          data-testid="credit-cards-list"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {cards.map((c) => (
            <CardItem
              key={c.id}
              card={c}
              onEdit={() => setModal({ kind: 'edit', card: c })}
              onToggle={() => setModal({ kind: 'toggle', card: c })}
            />
          ))}
        </div>
      )}

      {modal?.kind === 'add' && (
        <CardFormModal
          tenantId={tenantId}
          bankAccounts={bankAccounts}
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <CardFormModal
          key={modal.card.id}
          tenantId={tenantId}
          bankAccounts={bankAccounts}
          mode="edit"
          card={modal.card}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'toggle' && (
        <ToggleModal
          key={modal.card.id}
          tenantId={tenantId}
          card={modal.card}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
