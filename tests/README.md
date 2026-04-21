# ניהול חכם — Tests

## Setup

```powershell
cd C:\smart-management\tests
npm install
npx playwright install chromium
Copy-Item .env.example .env
# עדّל .env وضيف credentials للأدوار الـ 5
```

## إدارة مستخدمي الاختبار

### قبل التشغيل أول مرة

1. افتح `tests/.env`
2. ضع كلمة مرور الـ admin:
   ```
   OWNER_USERNAME=admin
   OWNER_PASSWORD=<كلمة مرور admin على الإنتاج>
   ```
3. شغّل:
   ```powershell
   npm run users:create
   npm run users:verify
   ```

### إعادة تعيين

```powershell
npm run users:reset    # يحذف الـ 4 الاختباريين
npm run users:create   # ينشئهم من جديد
```

## تشغيل

```powershell
.\run-all.ps1 -Suite smoke    # smoke فقط
.\run-all.ps1 -Suite auth     # auth
.\run-all.ps1 -Suite rbac     # rbac matrix
.\run-all.ps1 -Suite security # أمان
.\run-all.ps1 -Suite all      # الكل
```

## تقارير

```powershell
npm run report
```

---

## CI — GitHub Actions

الـ workflow في [.github/workflows/test.yml](../.github/workflows/test.yml) بيشغّل الـ suite على كل push لـ `main` أو `master` + على PRs (من نفس الـ repo).

### Required secrets

روح Settings → Secrets and variables → Actions → New repository secret، وضيف:

| Secret | وصف |
|---|---|
| `OWNER_USERNAME` | اسم مستخدم الـ owner الحقيقي على prod (عادةً `admin`) |
| `OWNER_PASSWORD` | كلمة مرور الـ owner |
| `MANAGER_PASSWORD` | كلمة مرور `test_manager` |
| `ACCOUNTANT_PASSWORD` | كلمة مرور `test_accountant` |
| `OPERATOR_PASSWORD` | كلمة مرور `test_operator` |
| `VIEWER_PASSWORD` | كلمة مرور `test_viewer` |
| `CLOUDFLARE_API_TOKEN` | API token بصلاحية D1:Edit لـ `smart-management` — للـ teardown cleanup |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (موجود في `wrangler.toml`) |

الـ usernames للـ 4 roles الـ seeded (manager/accountant/operator/viewer) hardcoded في الـ workflow لأنها deterministic.

### كيف تحصل على Cloudflare API token

1. https://dash.cloudflare.com/profile/api-tokens
2. Create Token → Custom Token
3. Permissions: **Account** → **D1** → **Edit**
4. Account Resources: Include → Specific → حدد الحساب
5. Save & copy

### تشغيل يدوي

Actions tab → "E2E Tests" → Run workflow → اختر الـ branch.

### Runtime على CI

~5-7 دقائق للـ ~170 test (392 لو احتسبنا Phase 3 RBAC matrix كاملة).

### Failure artifacts

لو فشل أي test، الـ workflow يرفع:
- `playwright-report-<run-id>`: HTML report (افتح `index.html`)
- `playwright-traces-<run-id>`: trace files (`npx playwright show-trace <file>`)

Retention: 7-14 يوم.

