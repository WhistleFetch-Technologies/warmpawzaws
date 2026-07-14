# ============================================================================
# Deploy API Lambda to PRODUCTION (code + zip)
# Wraps: LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh
# ============================================================================
# Usage (from repo root, requires Git Bash):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-lambda-prod.ps1
#
# Env-only (no code): use scripts/apply-prod-discount-engine-env.js instead.
# ============================================================================

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

$gitBash = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $gitBash) {
    throw "Git Bash not found. Install Git for Windows or run with bash: LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh"
}

Write-Host "Deploying Lambda → warmpawz-prod-api-handler (PRODUCTION)" -ForegroundColor Yellow
Write-Host "This uploads NEW code. Ctrl+C now if you only wanted env/schema prep." -ForegroundColor DarkYellow
& $gitBash -lc "cd `"$Root`" && LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh"
if ($LASTEXITCODE -ne 0) { throw "lambda prod deploy failed (exit $LASTEXITCODE)" }
