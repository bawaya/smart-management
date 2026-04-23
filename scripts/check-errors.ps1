<#
.SYNOPSIS
  Queries Cloudflare D1 request_log to show errors and activity.

.PARAMETER Hours
  Time window in hours (default: 4).

.PARAMETER Limit
  Max number of error rows to show (default: 50).

.EXAMPLE
  .\scripts\check-errors.ps1
  .\scripts\check-errors.ps1 -Hours 24
  .\scripts\check-errors.ps1 -Hours 1 -Limit 100
#>
[CmdletBinding()]
param(
  [int]$Hours = 4,
  [int]$Limit = 50
)

$ErrorActionPreference = 'Stop'
$DB = 'smart-management'

function Invoke-D1 {
  param([string]$Sql)
  $raw = npx --silent wrangler d1 execute $DB --remote --command $Sql --json 2>&1
  if ($LASTEXITCODE -ne 0) { throw "wrangler failed: $raw" }
  $json = ($raw -join "`n")
  $start = $json.IndexOf('[')
  $end   = $json.LastIndexOf(']')
  if ($start -lt 0 -or $end -lt 0) { throw "bad JSON from wrangler" }
  return ($json.Substring($start, $end - $start + 1) | ConvertFrom-Json)[0].results
}

$line = '=================================================='
Write-Host ""
Write-Host $line -ForegroundColor Cyan
Write-Host "  Smart-Management Error Report" -ForegroundColor Cyan
Write-Host "  Window: last $Hours hour(s)" -ForegroundColor Cyan
Write-Host $line -ForegroundColor Cyan

Write-Host ""
Write-Host "[1/4] Activity summary..." -ForegroundColor Yellow
$sql1 = "SELECT outcome, COUNT(*) as count FROM request_log WHERE timestamp >= datetime('now', '-$Hours hours') GROUP BY outcome ORDER BY count DESC"
$summary = Invoke-D1 $sql1

if (-not $summary) {
  Write-Host "  No requests in this window." -ForegroundColor DarkGray
} else {
  $total = ($summary | Measure-Object -Property count -Sum).Sum
  Write-Host ("  Total requests: {0}" -f $total) -ForegroundColor White
  $summary | ForEach-Object {
    $color = 'White'
    if ($_.outcome -eq 'exception')     { $color = 'Red' }
    if ($_.outcome -eq 'auth_redirect') { $color = 'DarkGray' }
    if ($_.outcome -eq 'auth_ok')       { $color = 'Green' }
    Write-Host ("    {0,-20} {1,6}" -f $_.outcome, $_.count) -ForegroundColor $color
  }
}

Write-Host ""
Write-Host "[2/4] Exceptions / crashes..." -ForegroundColor Yellow
$sql2 = "SELECT timestamp, method, url, exception_name, exception_message, user_id, duration_ms FROM request_log WHERE timestamp >= datetime('now', '-$Hours hours') AND (outcome = 'exception' OR exception_name IS NOT NULL) ORDER BY timestamp DESC LIMIT $Limit"
$exceptions = Invoke-D1 $sql2

if (-not $exceptions) {
  Write-Host "  No exceptions. Clean!" -ForegroundColor Green
} else {
  Write-Host ("  Found {0} exception(s):" -f @($exceptions).Count) -ForegroundColor Red
  $exceptions | ForEach-Object {
    Write-Host ""
    Write-Host ("  [{0}] {1} {2}" -f $_.timestamp, $_.method, $_.url) -ForegroundColor Red
    Write-Host ("    {0}: {1}" -f $_.exception_name, $_.exception_message) -ForegroundColor White
    if ($_.user_id)     { Write-Host ("    user: {0}" -f $_.user_id) -ForegroundColor DarkGray }
    if ($_.duration_ms) { Write-Host ("    took: {0} ms" -f $_.duration_ms) -ForegroundColor DarkGray }
  }
}

Write-Host ""
Write-Host "[3/4] HTTP error responses (4xx / 5xx)..." -ForegroundColor Yellow
$sql3 = "SELECT timestamp, method, url, status_code, duration_ms, user_id FROM request_log WHERE timestamp >= datetime('now', '-$Hours hours') AND status_code >= 400 ORDER BY timestamp DESC LIMIT $Limit"
$httpErrors = Invoke-D1 $sql3

if (-not $httpErrors) {
  Write-Host "  No HTTP errors." -ForegroundColor Green
} else {
  Write-Host ("  Found {0} error response(s):" -f @($httpErrors).Count) -ForegroundColor Yellow
  $httpErrors | Format-Table timestamp, status_code, method, url, duration_ms, user_id -AutoSize
}

Write-Host ""
Write-Host "[4/4] Slow requests (> 1000ms)..." -ForegroundColor Yellow
$sql4 = "SELECT timestamp, method, url, duration_ms, outcome, user_id FROM request_log WHERE timestamp >= datetime('now', '-$Hours hours') AND duration_ms > 1000 ORDER BY duration_ms DESC LIMIT 20"
$slow = Invoke-D1 $sql4

if (-not $slow) {
  Write-Host "  No slow requests." -ForegroundColor Green
} else {
  Write-Host ("  Found {0} slow request(s):" -f @($slow).Count) -ForegroundColor Yellow
  $slow | Format-Table timestamp, duration_ms, method, url, outcome, user_id -AutoSize
}

Write-Host ""
Write-Host $line -ForegroundColor Cyan
Write-Host "Done." -ForegroundColor Cyan
Write-Host $line -ForegroundColor Cyan
Write-Host ""
