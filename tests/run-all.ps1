param([string]$Suite = 'smoke')

$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot

Write-Host "`n==> Phase: $Suite" -ForegroundColor Cyan
Write-Host "==> Setup" -ForegroundColor Yellow
npm run setup

switch ($Suite) {
  'smoke'    { npx playwright test 01-smoke }
  'auth'     { npx playwright test 02-auth }
  'rbac'     { npx playwright test 03-rbac }
  'security' { npx vitest run security/ }
  'api'      { npx vitest run api/ }
  'all'      {
    npx playwright test
    npx vitest run
  }
  default    { Write-Host "Unknown suite: $Suite" -ForegroundColor Red; exit 1 }
}

Write-Host "`n==> Done" -ForegroundColor Green
Pop-Location
