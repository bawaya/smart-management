# Server Actions Reference

רשימה מלאה של Server Actions במערכת, מקובצות לפי מודול. כולן קבצים עם `'use server'` בראש, נקראים ישירות מ-Client Components.

**הערות כלליות**:
- כל action מחזיר `{success: boolean, error?: string, ...}` (פרט ל-login/logout).
- כל action מתחיל ב-gate של הרשאה (`requireOwner` / `requireRole(...)` / `requireWriter` / `requireFinanceRole`).
- actions שמקבלות `tenantId` בודקות `auth.tenantId !== tenantId` → error.
- actions שמבצעות יותר מ-UPDATE יחיד עטופות ב-`BEGIN/COMMIT/ROLLBACK`.

---

## Auth — `app/(auth)/login/action.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `loginAction` | `(formData: FormData) => Promise<LoginResult>` | מאמת username+password, יוצר JWT+cookies, מחזיר flags | public |
| `logoutAction` | `() => Promise<void>` | מוחק cookies וseoredirect ל-login | מאומת |

---

## Setup Wizard — `app/(setup)/setup/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `changePasswordAction` | `(oldPw: string, newPw: string) => Promise<Result>` | מחליף סיסמה + מנקה `must_change_password` | מאומת |
| `saveCompanyAction` | `(data: CompanyData) => Promise<Result>` | שומר פרטי חברה ב-settings | owner |
| `saveBusinessAction` | `(data: BusinessData) => Promise<Result>` | שומר לוגו, פרטי בנק | owner |
| `savePricingAction` | `(data: PricingData) => Promise<Result>` | שומר תעריפים ומע"מ | owner |
| `saveEquipmentAction` | `(types: EquipmentType[]) => Promise<Result>` | יוצר סוגי ציוד התחלתיים | owner |
| `completeSetupAction` | `() => Promise<Result>` | מסמן `is_setup_complete=1` | owner |

---

## Settings — `app/(dashboard)/settings/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `updateCompanyAction` | `(tenantId, data) => Result` | עדכון פרטי חברה | owner |
| `updatePricingAction` | `(tenantId, data) => Result` | עדכון תעריפים | owner |
| `updateEquipmentLabelAction` | `(tenantId, field, value) => Result` | עדכון תוויות תצוגה של ציוד | owner |
| `addEquipmentTypeAction` | `(tenantId, data) => Result` | הוספת סוג ציוד | owner |
| `updateEquipmentTypeAction` | `(tenantId, id, data) => Result` | עדכון סוג ציוד | owner |
| `deleteEquipmentTypeAction` | `(tenantId, id) => Result` | מחיקת סוג ציוד (רק אם ריק) | owner |
| `addUserAction` | `(tenantId, data) => Result` | יצירת משתמש חדש (עם סיסמה זמנית) | owner |
| `updateUserAction` | `(tenantId, userId, data) => Result` | עדכון פרופיל משתמש | owner |
| `toggleUserAction` | `(tenantId, userId) => Result` | הפעלה/השבתה (self-protection) | owner |
| `resetPasswordAction` | `(tenantId, userId) => Result` | יוצר סיסמה זמנית + `must_change_password=1` | owner |
| `addClientAction` | `(tenantId, data) => Result` | הוספת לקוח | owner |
| `updateClientAction` | `(tenantId, id, data) => Result` | עדכון לקוח | owner |
| `toggleClientAction` | `(tenantId, id) => Result` | הפעלה/השבתה של לקוח | owner |

---

## Equipment — `app/(dashboard)/equipment/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addEquipmentAction` | `(tenantId, data) => Result` | הוספת פריט ציוד | owner, manager |
| `updateEquipmentAction` | `(tenantId, id, data) => Result` | עדכון פריט | owner, manager |
| `updateEquipmentStatusAction` | `(tenantId, id, status) => Result` | שינוי סטטוס (active/maintenance/inactive) | owner, manager |

---

## Vehicles — `app/(dashboard)/vehicles/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addVehicleAction` | `(tenantId, data) => Result` | הוספת רכב | owner, manager |
| `updateVehicleAction` | `(tenantId, id, data) => Result` | עדכון רכב | owner, manager |
| `toggleVehicleAction` | `(tenantId, id) => Result` | הפעלה/השבתה | owner, manager |

---

## Workers — `app/(dashboard)/workers/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addWorkerAction` | `(tenantId, data) => Result` | הוספת עובד | owner, manager |
| `updateWorkerAction` | `(tenantId, id, data) => Result` | עדכון פרופיל עובד | owner, manager |
| `toggleWorkerAction` | `(tenantId, id) => Result` | הפעלה/השבתה | owner, manager |

---

## Daily Log — `app/(dashboard)/daily-log/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addDailyLogAction` | `(tenantId, data) => Result` | יוצר רישום + worker_assignments | owner, manager, operator |
| `updateDailyLogAction` | `(tenantId, id, data) => Result` | עדכון רישום (operator: רק שלו) | owner, manager, operator |
| `confirmLogAction` | `(tenantId, id) => Result` | משנה `status='confirmed'` | owner, manager, operator |

---

## Fuel — `app/(dashboard)/fuel/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addFuelAction` | `(tenantId, data) => Result` | רישום תדלוק | owner, manager, operator |
| `updateFuelAction` | `(tenantId, id, data) => Result` | עדכון תדלוק | owner, manager, operator |
| `deleteFuelAction` | `(tenantId, id) => Result` | מחיקה | owner, manager, operator |

---

## Expenses — `app/(dashboard)/expenses/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addExpenseAction` | `(tenantId, data) => Result` | הוצאה חדשה | owner, manager, operator |
| `updateExpenseAction` | `(tenantId, id, data) => Result` | עדכון | owner, manager, operator |
| `deleteExpenseAction` | `(tenantId, id) => Result` | מחיקה | owner, manager, operator |

---

## Invoices — `app/(dashboard)/invoices/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `searchLogsForInvoiceAction` | `(tenantId, clientId, from, to) => Log[]` | מחזיר logs מאושרים של לקוח בטווח תאריכים | owner, accountant |
| `generateInvoiceAction` | `(tenantId, clientId, logIds, meta) => Result` | יוצר invoice + invoice_items, מסמן logs כ-invoiced | owner, accountant |
| `updateInvoiceStatusAction` | `(tenantId, id, status) => Result` | sent/paid/cancelled | owner, accountant |
| `recordPaymentAction` | `(tenantId, id, amount, date) => Result` | מוסיף תשלום + מעדכן חוב | owner, accountant |

---

## Budget — `app/(dashboard)/budget/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `saveBudgetAction` | `(tenantId, year, entries) => Result` | Upsert של יעדי תקציב (חודש/קטגוריה) | owner, accountant |

---

## Finance — `app/(dashboard)/finance/actions.ts`

### Bank Accounts

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addBankAccount` | `(tenantId, data) => Result` | חשבון בנק חדש | owner, accountant |
| `updateBankAccount` | `(tenantId, id, data) => Result` | עדכון | owner, accountant |
| `toggleBankAccount` | `(tenantId, id) => Result` | הפעלה/השבתה | owner, accountant |

### Credit Cards

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addCreditCard` | `(tenantId, data) => Result` | כרטיס חדש | owner, accountant |
| `updateCreditCard` | `(tenantId, id, data) => Result` | עדכון | owner, accountant |
| `toggleCreditCard` | `(tenantId, id) => Result` | הפעלה/השבתה | owner, accountant |

### Checks

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addCheckAction` | `(tenantId, data) => Result` | צ'ק נכנס או יוצא | owner, accountant |
| `updateCheckAction` | `(tenantId, id, data) => Result` | עדכון | owner, accountant |
| `updateCheckStatusAction` | `(tenantId, id, status) => Result` | pending/cleared/bounced/cancelled | owner, accountant |

### Standing Orders

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addStandingOrderAction` | `(tenantId, data) => Result` | הוראת קבע | owner, accountant |
| `updateStandingOrderAction` | `(tenantId, id, data) => Result` | עדכון | owner, accountant |
| `toggleStandingOrderAction` | `(tenantId, id) => Result` | הפעלה/השבתה | owner, accountant |

### Transactions

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addTransactionAction` | `(tenantId, data) => Result` | תנועה ידנית | owner, accountant |
| `updateTransactionAction` | `(tenantId, id, data) => Result` | עדכון | owner, accountant |
| `deleteTransactionAction` | `(tenantId, id) => Result` | מחיקה | owner, accountant |

### Debts

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `addDebtAction` | `(tenantId, data) => Result` | חוב חדש | owner, accountant |
| `updateDebtAction` | `(tenantId, id, data) => Result` | עדכון | owner, accountant |
| `addDebtPaymentAction` | `(tenantId, debtId, amount, date) => Result` | תשלום על חוב | owner, accountant |

### Reconciliation

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `createReconciliationAction` | `(tenantId, data) => Result` | התאמת בנק חדשה | owner, accountant |
| `updateReconciliationStatusAction` | `(tenantId, id, status) => Result` | draft/final | owner, accountant |

---

## Help — `app/(dashboard)/help/actions.ts`

| Action | חתימה | תיאור | הרשאות |
|--------|-------|-------|--------|
| `resetSetupAction` | `() => void` | מאפס `is_setup_complete=0`, redirect ל-setup | owner |

---

## סיכום

- Auth: 2
- Setup: 6
- Settings: 13
- Equipment: 3
- Vehicles: 3
- Workers: 3
- Daily Log: 3
- Fuel: 3
- Expenses: 3
- Invoices: 4
- Budget: 1
- Finance: 20
- Help: 1

**סה"כ: 65 Server Actions.**
