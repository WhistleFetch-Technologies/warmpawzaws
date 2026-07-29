# ============================================================================
# DEPRECATED — do not use for normal dev API deployments
# ============================================================================
# This script previously uploaded handler.js-only (~2.9 MB) and caused Commerce
# Switch (and other routes) to disappear from warmpawz-dev-api-handler.
#
# Use instead:
#   Git Bash/WSL:  ./scripts/deploy-lambda-direct.sh
#   Windows:       powershell -File scripts/deploy-dev-windows.ps1
#   Fast dev:      powershell -File scripts/_deploy-dev-fast.ps1
# ============================================================================

param(
    [switch]$AllowUnsafeHandlerOnly,
    [string]$Region = "ap-south-1",
    [string]$DevApiId = "z0b3obweb6",
    [string]$LambdaFunctionName = ""
)

$ErrorActionPreference = "Stop"

if (-not $AllowUnsafeHandlerOnly) {
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Red
    Write-Host " BLOCKED: deploy-lambda-dev.ps1 uploads an INCOMPLETE Lambda package" -ForegroundColor Red
    Write-Host "============================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "This script zips only dist/handler.js (~2–3 MB) and skips npm run package." -ForegroundColor Yellow
    Write-Host "That overwrites warmpawz-dev-api-handler without Commerce Switch routes." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Use the official full deploy path instead:" -ForegroundColor Cyan
    Write-Host "  ./scripts/deploy-lambda-direct.sh" -ForegroundColor White
    Write-Host "  powershell -File scripts/deploy-dev-windows.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "If you truly need the legacy handler-only path (NOT for shared dev):" -ForegroundColor DarkYellow
    Write-Host "  powershell -File scripts/deploy-lambda-dev-UNSAFE-handler-only.ps1 -AllowUnsafeHandlerOnly" -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}

Write-Host "Redirecting to UNSAFE handler-only deploy script..." -ForegroundColor Yellow
$unsafe = Join-Path $PSScriptRoot "deploy-lambda-dev-UNSAFE-handler-only.ps1"
if (-not (Test-Path $unsafe)) {
    Write-Host "Missing: $unsafe" -ForegroundColor Red
    exit 1
}
& $unsafe -AllowUnsafeHandlerOnly -Region $Region -DevApiId $DevApiId -LambdaFunctionName $LambdaFunctionName
