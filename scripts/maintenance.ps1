<#
.SYNOPSIS
  One-click toggle for maintenance mode on Cloudflare Pages.

.DESCRIPTION
  Sets/unsets the MAINTENANCE_MODE secret on Cloudflare Pages and redeploys
  the project so the change takes effect immediately.

.PARAMETER On
  Enable maintenance mode. Visitors see the /maintenance page.

.PARAMETER Off
  Disable maintenance mode. Site returns to normal.

.PARAMETER Status
  Only show current status without changing anything.

.PARAMETER SkipDeploy
  Only update the secret, do not trigger a new deploy.

.EXAMPLE
  .\scripts\maintenance.ps1 -On
  .\scripts\maintenance.ps1 -Off
  .\scripts\maintenance.ps1 -Status
  .\scripts\maintenance.ps1 -On -SkipDeploy
#>
[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
  [Parameter(ParameterSetName = 'On', Mandatory = $true)]
  [switch]$On,

  [Parameter(ParameterSetName = 'Off', Mandatory = $true)]
  [switch]$Off,

  [Parameter(ParameterSetName = 'Status')]
  [switch]$Status,

  [Parameter(ParameterSetName = 'On')]
  [Parameter(ParameterSetName = 'Off')]
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$PROJECT = 'smart-management'
$DOMAIN  = 'https://smart-management.pages.dev'
$line    = '=================================================='

function Write-Banner([string]$text, [string]$color = 'Cyan') {
  Write-Host ""
  Write-Host $line -ForegroundColor $color
  Write-Host "  $text" -ForegroundColor $color
  Write-Host $line -ForegroundColor $color
}

function Test-LiveStatus {
  try {
    $headers = curl.exe -sI $DOMAIN 2>$null
    $matched = ($headers | Select-String -Pattern 'x-matched-path:\s*(.+)').Matches.Groups[1].Value.Trim()
    if ($matched -like '*maintenance*') {
      return 'ON'
    }
    return 'OFF'
  } catch {
    return 'UNKNOWN'
  }
}

function Set-Maintenance([string]$Value) {
  Write-Host ""
  Write-Host "[1/3] Updating MAINTENANCE_MODE secret on Cloudflare..." -ForegroundColor Yellow

  if ($Value -eq '0') {
    Write-Host "      Removing secret MAINTENANCE_MODE..." -ForegroundColor DarkGray
    $null = "y" | npx wrangler pages secret delete MAINTENANCE_MODE --project-name=$PROJECT 2>&1
    Write-Host "      Removed." -ForegroundColor Green
  } else {
    Write-Host "      Setting MAINTENANCE_MODE=$Value..." -ForegroundColor DarkGray
    $Value | npx wrangler pages secret put MAINTENANCE_MODE --project-name=$PROJECT 2>&1 | Out-Null
    Write-Host "      Set." -ForegroundColor Green
  }
}

function Invoke-Deploy {
  Write-Host ""
  Write-Host "[2/3] Building with @cloudflare/next-on-pages..." -ForegroundColor Yellow
  $cwd = (Get-Location).Path -replace '\\', '/' -replace '^([A-Z]):', '/mnt/$1'.ToLower()
  $cwd = $cwd.ToLower()

  $drive = ((Get-Location).Path.Substring(0, 1)).ToLower()
  $rest  = ((Get-Location).Path.Substring(2)) -replace '\\', '/'
  $wslPath = "/mnt/$drive$rest"

  bash -c "cd '$wslPath' && npx @cloudflare/next-on-pages 2>&1 | tail -3"
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
  }

  Write-Host ""
  Write-Host "[3/3] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
  $deployOut = npx wrangler pages deploy .vercel/output/static `
    --project-name=$PROJECT `
    --branch=master `
    --commit-dirty=true 2>&1

  $url = ($deployOut | Select-String -Pattern 'https://[a-z0-9]+\.smart-management\.pages\.dev').Matches |
    Select-Object -Last 1 -ExpandProperty Value

  if ($url) {
    Write-Host "      Deployed: $url" -ForegroundColor Green
  } else {
    Write-Host ($deployOut | Select-Object -Last 5) -ForegroundColor Red
    throw "Deploy failed."
  }
}

# --- Router ---------------------------------------------------------------

if ($PSCmdlet.ParameterSetName -eq 'Status' -or $Status) {
  Write-Banner "Maintenance Status"
  $currentStatus = Test-LiveStatus
  $color = if ($currentStatus -eq 'ON') { 'Yellow' } elseif ($currentStatus -eq 'OFF') { 'Green' } else { 'Red' }
  Write-Host ""
  Write-Host "  Project : $PROJECT"           -ForegroundColor White
  Write-Host "  Domain  : $DOMAIN"            -ForegroundColor White
  Write-Host "  Status  : $currentStatus"     -ForegroundColor $color
  Write-Host ""
  Write-Host "  Usage:"                       -ForegroundColor DarkGray
  Write-Host "    .\scripts\maintenance.ps1 -On"  -ForegroundColor DarkGray
  Write-Host "    .\scripts\maintenance.ps1 -Off" -ForegroundColor DarkGray
  Write-Host ""
  return
}

if ($On) {
  Write-Banner "Enabling Maintenance Mode" 'Yellow'
  Set-Maintenance -Value '1'

  if (-not $SkipDeploy) {
    Invoke-Deploy
    Start-Sleep -Seconds 6
    Write-Host ""
    Write-Host "Verifying..." -ForegroundColor Yellow
    $currentStatus = Test-LiveStatus
    if ($currentStatus -eq 'ON') {
      Write-Banner "MAINTENANCE MODE IS NOW ACTIVE" 'Yellow'
      Write-Host "  Visitors will see the /maintenance page." -ForegroundColor White
      Write-Host "  $DOMAIN" -ForegroundColor Cyan
    } else {
      Write-Host "  (Verification returned $currentStatus - may need a moment to propagate)" -ForegroundColor DarkYellow
    }
  } else {
    Write-Host ""
    Write-Host "  Secret updated. Skipping deploy (per -SkipDeploy flag)." -ForegroundColor DarkGray
  }
  return
}

if ($Off) {
  Write-Banner "Disabling Maintenance Mode" 'Green'
  Set-Maintenance -Value '0'

  if (-not $SkipDeploy) {
    Invoke-Deploy
    Start-Sleep -Seconds 6
    Write-Host ""
    Write-Host "Verifying..." -ForegroundColor Yellow
    $currentStatus = Test-LiveStatus
    if ($currentStatus -eq 'OFF') {
      Write-Banner "SITE IS BACK ONLINE" 'Green'
      Write-Host "  The application is now serving traffic normally." -ForegroundColor White
      Write-Host "  $DOMAIN" -ForegroundColor Cyan
    } else {
      Write-Host "  (Verification returned $currentStatus - may need a moment to propagate)" -ForegroundColor DarkYellow
    }
  } else {
    Write-Host ""
    Write-Host "  Secret removed. Skipping deploy (per -SkipDeploy flag)." -ForegroundColor DarkGray
  }
  return
}
