# ============================================================================
# Deploy Admin-Web to PRODUCTION (separate from vendor/customer)
# Wraps scripts/deploy-admin-web.sh --prod
# ============================================================================
# Usage (from repo root, requires Git Bash):
#   powershell -ExecutionPolicy Bypass -File scripts/prodWebDeploy/deploy-admin-web-prod.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/prodWebDeploy/deploy-admin-web-prod.ps1 -Yes
# ============================================================================

param(
    [switch]$Yes,
    [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$BashScript = Join-Path $Root "scripts\deploy-admin-web.sh"

$gitBash = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $gitBash) {
    throw "Git Bash not found. Install Git for Windows or run: ./scripts/deploy-admin-web.sh --prod"
}

$argsList = @("--prod")
if ($Yes) { $argsList += "--yes" }
if ($DeployOnly) { $argsList += "--deploy-only" }

Write-Host "Deploying admin-web → PRODUCTION via $BashScript $($argsList -join ' ')" -ForegroundColor Yellow
& $gitBash -lc "cd `"$Root`" && ./scripts/deploy-admin-web.sh $($argsList -join ' ')"
if ($LASTEXITCODE -ne 0) { throw "admin-web prod deploy failed (exit $LASTEXITCODE)" }
