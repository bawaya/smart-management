'use client';

import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useState } from 'react';
import {
  addEquipmentTypeAction,
  deleteEquipmentTypeAction,
  updateEquipmentLabelAction,
  updateEquipmentTypeAction,
} from '../actions';

interface EquipmentType {
  id: string;
  name: string;
}

interface EquipmentTypesManagerProps {
  tenantId: string;
  initialLabelHe: string;
  initialLabelAr: string;
  types: EquipmentType[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';
const INPUT_COMPACT =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent text-sm';

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
  testId,
}: {
  children: React.ReactNode;
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
  children: React.ReactNode;
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

export function EquipmentTypesManager({
  tenantId,
  initialLabelHe,
  initialLabelAr,
  types,
}: EquipmentTypesManagerProps) {
  const router = useRouter();

  const [labelHe, setLabelHe] = useState(initialLabelHe);
  const [labelAr, setLabelAr] = useState(initialLabelAr);
  const [labelSubmitting, setLabelSubmitting] = useState(false);
  const [labelMessage, setLabelMessage] = useState<Message>(null);

  const [typesMessage, setTypesMessage] = useState<Message>(null);

  const [adding, setAdding] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (labelMessage?.kind !== 'success') return;
    const t = setTimeout(() => setLabelMessage(null), 3000);
    return () => clearTimeout(t);
  }, [labelMessage]);

  useEffect(() => {
    if (typesMessage?.kind !== 'success') return;
    const t = setTimeout(() => setTypesMessage(null), 3000);
    return () => clearTimeout(t);
  }, [typesMessage]);

  async function handleLabelSubmit(): Promise<void> {
    if (labelSubmitting) return;
    if (!labelHe.trim()) {
      setLabelMessage({ kind: 'error', text: 'יש למלא שם בעברית' });
      return;
    }
    setLabelMessage(null);
    setLabelSubmitting(true);
    try {
      const res = await updateEquipmentLabelAction(tenantId, labelHe, labelAr);
      if (!res.success) {
        setLabelMessage({ kind: 'error', text: res.error });
        return;
      }
      setLabelMessage({ kind: 'success', text: 'השם עודכן בהצלחה' });
      router.refresh();
    } finally {
      setLabelSubmitting(false);
    }
  }

  function openAdd(): void {
    setAdding(true);
    setNewTypeName('');
    setTypesMessage(null);
  }

  function cancelAdd(): void {
    setAdding(false);
    setNewTypeName('');
  }

  async function saveAdd(): Promise<void> {
    if (addSubmitting) return;
    const name = newTypeName.trim();
    if (!name) return;
    setTypesMessage(null);
    setAddSubmitting(true);
    try {
      const res = await addEquipmentTypeAction(tenantId, name);
      if (!res.success) {
        setTypesMessage({ kind: 'error', text: res.error });
        return;
      }
      setAdding(false);
      setNewTypeName('');
      setTypesMessage({ kind: 'success', text: 'הסוג נוסף בהצלחה' });
      router.refresh();
    } finally {
      setAddSubmitting(false);
    }
  }

  function startEdit(type: EquipmentType): void {
    setEditingId(type.id);
    setEditingName(type.name);
    setTypesMessage(null);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditingName('');
  }

  async function saveEdit(): Promise<void> {
    if (!editingId || editSubmitting) return;
    const name = editingName.trim();
    if (!name) return;
    setTypesMessage(null);
    setEditSubmitting(true);
    try {
      const res = await updateEquipmentTypeAction(tenantId, editingId, name);
      if (!res.success) {
        setTypesMessage({ kind: 'error', text: res.error });
        return;
      }
      setEditingId(null);
      setEditingName('');
      setTypesMessage({ kind: 'success', text: 'הסוג עודכן בהצלחה' });
      router.refresh();
    } finally {
      setEditSubmitting(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!confirmDeleteId || deleteSubmitting) return;
    setTypesMessage(null);
    setDeleteSubmitting(true);
    try {
      const res = await deleteEquipmentTypeAction(tenantId, confirmDeleteId);
      if (!res.success) {
        setTypesMessage({ kind: 'error', text: res.error });
        setConfirmDeleteId(null);
        return;
      }
      setConfirmDeleteId(null);
      setTypesMessage({ kind: 'success', text: 'הסוג נמחק בהצלחה' });
      router.refresh();
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleAddKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveAdd();
    } else if (event.key === 'Escape') {
      cancelAdd();
    }
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveEdit();
    } else if (event.key === 'Escape') {
      cancelEdit();
    }
  }

  const titleLabel = initialLabelHe || 'ציוד';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">
        ניהול סוגי {titleLabel}
      </h1>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <header className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">שם הציוד</h2>
          <p className="mt-1 text-sm text-gray-600">
            השם שתבחר יופיע בכל המערכת
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם בעברית <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={labelHe}
              onChange={(e) => setLabelHe(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם בערבית
            </label>
            <input
              type="text"
              value={labelAr}
              onChange={(e) => setLabelAr(e.target.value)}
              dir="rtl"
              lang="ar"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {labelMessage && (
          <div
            role={labelMessage.kind === 'error' ? 'alert' : 'status'}
            className={`mt-4 p-3 rounded-lg text-sm text-center border ${
              labelMessage.kind === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {labelMessage.text}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <PrimaryButton onClick={handleLabelSubmit} disabled={labelSubmitting}>
            {labelSubmitting ? 'שומר...' : 'עדכן שם'}
          </PrimaryButton>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">סוגים</h2>
          {!adding && (
            <PrimaryButton
              onClick={openAdd}
              testId="equipment-types-add-button"
            >
              + הוסף סוג חדש
            </PrimaryButton>
          )}
        </header>

        {typesMessage && (
          <div
            role={typesMessage.kind === 'error' ? 'alert' : 'status'}
            data-testid={
              typesMessage.kind === 'error'
                ? 'equipment-types-form-error'
                : 'toast-success'
            }
            className={`mb-4 p-3 rounded-lg text-sm text-center border ${
              typesMessage.kind === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {typesMessage.text}
          </div>
        )}

        {adding && (
          <div
            data-testid="equipment-types-form"
            className="flex items-center gap-2 p-3 rounded-lg border border-[#f59e0b]/40 bg-amber-50/40 mb-3"
          >
            <input
              type="text"
              data-testid="equipment-types-form-name"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="שם הסוג"
              autoFocus
              className={INPUT_COMPACT}
            />
            <PrimaryButton
              onClick={saveAdd}
              disabled={addSubmitting || newTypeName.trim().length === 0}
              testId="equipment-types-form-submit"
            >
              {addSubmitting ? '...' : 'שמור'}
            </PrimaryButton>
            <GhostButton
              onClick={cancelAdd}
              disabled={addSubmitting}
              testId="equipment-types-form-cancel"
            >
              ביטול
            </GhostButton>
          </div>
        )}

        {types.length === 0 && !adding ? (
          <p
            data-testid="equipment-types-empty"
            className="text-sm text-gray-500 text-center py-6"
          >
            אין סוגי ציוד עדיין
          </p>
        ) : (
          <ul
            data-testid="equipment-types-list"
            className="divide-y divide-gray-100"
          >
            {types.map((type) => (
              <li
                key={type.id}
                data-testid="equipment-types-row"
                data-type-id={type.id}
                className="flex items-center gap-2 py-3 first:pt-0 last:pb-0"
              >
                {editingId === type.id ? (
                  <>
                    <input
                      type="text"
                      data-testid="equipment-types-form-name"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                      className={INPUT_COMPACT}
                    />
                    <PrimaryButton
                      onClick={saveEdit}
                      disabled={
                        editSubmitting || editingName.trim().length === 0
                      }
                      testId="equipment-types-form-submit"
                    >
                      {editSubmitting ? '...' : 'שמור'}
                    </PrimaryButton>
                    <GhostButton
                      onClick={cancelEdit}
                      disabled={editSubmitting}
                      testId="equipment-types-form-cancel"
                    >
                      ביטול
                    </GhostButton>
                  </>
                ) : (
                  <>
                    <span
                      data-testid="equipment-types-row-name"
                      className="flex-1 text-sm text-gray-900 truncate"
                    >
                      {type.name}
                    </span>
                    <GhostButton
                      onClick={() => startEdit(type)}
                      testId="equipment-types-row-edit"
                    >
                      עריכה
                    </GhostButton>
                    <button
                      type="button"
                      data-testid="equipment-types-row-delete"
                      onClick={() => setConfirmDeleteId(type.id)}
                      className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      מחיקה
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            data-testid="equipment-types-delete-modal"
            className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-right"
          >
            <h3 className="text-lg font-bold text-gray-900">אישור מחיקה</h3>
            <p className="mt-2 text-sm text-gray-600">
              האם אתה בטוח? פעולה זו לא ניתנת לביטול
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <GhostButton
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleteSubmitting}
                testId="equipment-types-delete-cancel"
              >
                ביטול
              </GhostButton>
              <button
                type="button"
                data-testid="equipment-types-delete-confirm"
                onClick={confirmDelete}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-md bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleteSubmitting ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
