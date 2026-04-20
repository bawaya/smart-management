# מודולים

המערכת מחולקת ל-12 מודולים פונקציונליים. כל מודול יושב תחת `src/app/(dashboard)/<module>/` (פרט ל-Setup Wizard שתחת `(setup)/`).

התבנית החוזרת לכל מודול:
- `page.tsx` — Server Component שמושך נתונים ומרכיב props.
- `<Module>Manager.tsx` (או דומה) — Client Component עם state, טבלה, modals.
- `actions.ts` — Server Actions (`'use server'`).
- (אופציונלי) `[id]/page.tsx` — עמוד פירוט לרישום בודד.

---

## 1. Setup Wizard — `(setup)/setup/`

אשף ההגדרות הראשוני המוצג למשתמש בלוגין הראשון. 5 שלבים (`steps/Step1.tsx`..`Step5.tsx`): סיסמה חדשה, פרטי חברה, עסק (לוגו/פרטי בנק), תמחור (שעה/יום, מע"מ), ציוד התחלתי.

**קבצים**: `page.tsx` (wizard shell), `actions.ts`, `setup-context.tsx`, `layout.tsx`, `steps/Step1..Step5.tsx`.

**Actions**: `changePasswordAction`, `saveCompanyAction`, `saveBusinessAction`, `savePricingAction`, `saveEquipmentAction`, `completeSetupAction`.

**הרשאות**: כל משתמש מאומת. ה-wizard מוצג אוטומטית כש-`must_change_password=1` או `is_setup_complete=false`.

---

## 2. Dashboard — `(dashboard)/page.tsx`

עמוד הבית. 4 מדדים (ציוד פעיל, עובדים היום, הכנסות החודש, חשבוניות פתוחות), 5 פעילויות אחרונות, AlertsBanner.

**קבצים**: `page.tsx`, `DashboardPage.tsx`, `layout.tsx`, `loading.tsx`.

**Utilities**: `getDashboardStats`, `getRecentActivity`, `getExpiryAlerts` (כולם ב-`lib/utils/`, כולם `React.cache()`).

**הרשאות**: כל משתמש מאומת.

---

## 3. Settings — `(dashboard)/settings/`

הגדרות כלליות, חברה, תמחור, ציוד (סוגים+תוויות), משתמשים, לקוחות. 5 תתי-דפים.

**קבצים**: `page.tsx`, `layout.tsx` (גייט `settings`), `company/`, `pricing/`, `equipment-config/`, `users/`, `clients/`.

**Actions** (`settings/actions.ts`):
- חברה: `updateCompanyAction`.
- תמחור: `updatePricingAction`.
- תוויות ציוד: `updateEquipmentLabelAction`.
- סוגי ציוד: `addEquipmentTypeAction`, `updateEquipmentTypeAction`, `deleteEquipmentTypeAction`.
- משתמשים: `addUserAction`, `updateUserAction`, `toggleUserAction`, `resetPasswordAction`.
- לקוחות: `addClientAction`, `updateClientAction`, `toggleClientAction`.

**הרשאות**: `settings` (owner בלבד). דף users דורש `settings.users`.

---

## 4. Equipment — `(dashboard)/equipment/`

רישום ציוד, סטטוס (פעיל/תחזוקה/מושבת), תאריכי טסט ורישיונות, שיוך לסוג ציוד (equipment_types).

**קבצים**: `page.tsx`, `EquipmentManager.tsx`, `EquipmentForm.tsx`, `actions.ts`.

**Actions**: `addEquipmentAction`, `updateEquipmentAction`, `updateEquipmentStatusAction`.

**הרשאות**: `equipment` (owner, manager).

---

## 5. Vehicles — `(dashboard)/vehicles/`

צי הרכב — לוחית רישוי, סוג, תאריכי טסט/ביטוח/רישיון. ה-expiry alerts מהדשבורד מתבסס בחלקו על הטבלה הזו.

**קבצים**: `page.tsx`, `VehiclesManager.tsx`, `VehicleForm.tsx`, `actions.ts`.

**Actions**: `addVehicleAction`, `updateVehicleAction`, `toggleVehicleAction`.

**הרשאות**: `equipment` (owner, manager) — משתמשות בהרשאה המשותפת של תחום הציוד.

---

## 6. Workers — `(dashboard)/workers/`

עובדים — שם, ת"ז, תפקיד, שכר יומי/שעתי, תאריך התחלה. מקושרים דרך `worker_assignments` ליומן.

**קבצים**: `page.tsx`, `WorkersManager.tsx`, `WorkerForm.tsx`, `actions.ts`.

**Actions**: `addWorkerAction`, `updateWorkerAction`, `toggleWorkerAction`.

**הרשאות**: `workers` (owner, manager).

---

## 7. Daily Log — `(dashboard)/daily-log/`

יומן העבודה — ליבת המערכת. כל רישום = עבודה של יום אחד: לקוח, רכב, ציוד, שעות, סטטוס (טיוטה/מאושר). מכיל שיבוצי עובדים (worker_assignments).

**קבצים**: `page.tsx` (רשימה), `[id]/page.tsx` (פירוט), `DailyLogManager.tsx`, `DailyLogForm.tsx`, `actions.ts`.

**Actions**: `addDailyLogAction`, `updateDailyLogAction`, `confirmLogAction`.

**הרשאות**: `daily_log.write` לכתיבה (owner, manager, operator); `daily_log.read` לצפייה (כולם).

**מיוחד**: operator יכול לערוך רק רישומים שהוא יצר (`created_by === auth.userId`). `confirmLogAction` קופא את הרישום — חשבוניות יכולות להכלילו רק לאחר confirm.

---

## 8. Fuel — `(dashboard)/fuel/`

תדלוקים — תאריך, רכב, עלות, ליטרים, מד-ק"מ. מקושר ל-vehicles.

**קבצים**: `page.tsx`, `FuelManager.tsx`, `FuelForm.tsx`, `actions.ts`.

**Actions**: `addFuelAction`, `updateFuelAction`, `deleteFuelAction`.

**הרשאות**: `daily_log.write` (owner, manager, operator).

---

## 9. Expenses — `(dashboard)/expenses/`

הוצאות כלליות — קטגוריה, סכום, תאריך, קישור אופציונלי ל-vehicle/equipment/worker.

**קבצים**: `page.tsx`, `ExpensesManager.tsx`, `ExpenseForm.tsx`, `actions.ts`.

**Actions**: `addExpenseAction`, `updateExpenseAction`, `deleteExpenseAction`.

**הרשאות**: `daily_log.write` (owner, manager, operator).

---

## 10. Invoices — `(dashboard)/invoices/`

חשבוניות — יוצרות מיומני עבודה מאושרים. שני שלבים: חיפוש (searchLogs) → יצירה (generateInvoice). מעקב תשלומים.

**קבצים**: `page.tsx`, `[id]/page.tsx` (print-friendly), `InvoicesManager.tsx`, `GenerateInvoiceModal.tsx`, `actions.ts`.

**Actions**: `searchLogsForInvoiceAction`, `generateInvoiceAction`, `updateInvoiceStatusAction`, `recordPaymentAction`.

**הרשאות**: `invoices` (owner, accountant).

**מיוחד**: ה-PDF מודפס דרך `window.print()` עם CSS `@media print` — לא jsPDF (בעיות RTL עם עברית).

---

## 11. Budget — `(dashboard)/budget/`

תקציב — יעדים חודשיים או שנתיים לפי קטגוריות. השוואה לביצוע בפועל (מ-expenses+fuel+daily_logs).

**קבצים**: `page.tsx`, `BudgetManager.tsx`, `MonthlyView.tsx`, `YearlyView.tsx`, `actions.ts`, `budget-types.ts` (client-safe).

**Actions**: `saveBudgetAction`.

**Utilities**: `getActualAmounts`, `getMonthlyActualsForYear` (שניהם `React.cache()` ב-`lib/utils/budget-calculations.ts`).

**הרשאות**: `budget` (owner, accountant).

**מיוחד**: `budget-types.ts` מופרד מ-`budget-calculations.ts` — Client Components יכולים לייבא types בלי לגרור את DB.

---

## 12. Finance — `(dashboard)/finance/`

תחום כספים נרחב — 8 תתי-דפים:
1. `/finance` — ריכוז.
2. `/finance/accounts` — חשבונות בנק.
3. `/finance/credit-cards` — כרטיסי אשראי.
4. `/finance/checks` — צ'קים (נכנסים ויוצאים).
5. `/finance/standing-orders` — הוראות קבע.
6. `/finance/transactions` — תנועות כספיות.
7. `/finance/debts` — חובות.
8. `/finance/reconciliation` — התאמת בנק.
9. `/finance/cash-flow` — תחזית תזרים מזומנים.

**קבצים**: `page.tsx` + תת-תיקייה לכל sub-route, `actions.ts` (ענק — ~1500 שורות), `types.ts`.

**Actions** (`finance/actions.ts`):
- Accounts: `addBankAccount`, `updateBankAccount`, `toggleBankAccount`.
- Credit Cards: `addCreditCard`, `updateCreditCard`, `toggleCreditCard`.
- Checks: `addCheckAction`, `updateCheckAction`, `updateCheckStatusAction`.
- Standing Orders: `addStandingOrderAction`, `updateStandingOrderAction`, `toggleStandingOrderAction`.
- Transactions: `addTransactionAction`, `updateTransactionAction`, `deleteTransactionAction`.
- Debts: `addDebtAction`, `updateDebtAction`, `addDebtPaymentAction`.
- Reconciliation: `createReconciliationAction`, `updateReconciliationStatusAction`.

**Utilities**: `getCashFlowProjection` (`React.cache()`).

**הרשאות**: `finance` (owner, accountant).

---

## Reports — `(dashboard)/reports/`

לא מודול נפרד במובן של mutations — קובץ דוחות בלבד (קריאה). 6 תת-דוחות:
1. `/reports` — אינדקס.
2. `/reports/profit-loss` — רווח והפסד.
3. `/reports/accountant` — דוח רואה-חשבון.
4. `/reports/fuel` — דוח דלק.
5. `/reports/workers` — דוח עובדים.
6. `/reports/budget` — השוואת תקציב לביצוע.

**קבצים**: `page.tsx` לכל דוח + Client Component לתצוגה (print-friendly).

**Utilities**: `getProfitLossData`, `getAccountantReportData`, `getFuelReportData`, `getWorkersReportData`, `getCompanyInfo` (כולם `React.cache()`).

**הרשאות**: `reports` (owner, manager, accountant).

---

## Help — `(dashboard)/help/`

עמוד עזרה עם FAQ + כפתור "Reset Setup" למנהלים.

**קבצים**: `page.tsx`, `HelpPage.tsx`, `actions.ts`.

**Actions**: `resetSetupAction`.

**הרשאות**: `help` (כל משתמש). `resetSetupAction` רק ל-owner.
