# ============================================================================
# Deploy Customer-Web to PRODUCTION (separate from admin/vendor)
# Wraps scripts/deploy-customer-web.sh --prod
# ============================================================================
# Usage (from repo root, requires Git Bash):
#   powershell -ExecutionPolicy Bypass -File scripts/prodWebDeploy/deploy-customer-web-prod.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/prodWebDeploy/deploy-customer-web-prod.ps1 -Yes
# ============================================================================

param(
    [switch]$Yes,
    [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$gitBash = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $gitBash) {
    throw "Git Bash not found. Install Git for Windows or run: ./scripts/deploy-customer-web.sh --prod"
}

$argsList = @("--prod")
if ($Yes) { $argsList += "--yes" }
if ($DeployOnly) { $argsList += "--deploy-only" }

Write-Host "Deploying customer-web → PRODUCTION via ./scripts/deploy-customer-web.sh $($argsList -join ' ')" -ForegroundColor Yellow
& $gitBash -lc "cd `"$Root`" && ./scripts/deploy-customer-web.sh $($argsList -join ' ')"
if ($LASTEXITCODE -ne 0) { throw "customer-web prod deploy failed (exit $LASTEXITCODE)" }
