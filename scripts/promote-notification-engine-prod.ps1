# Promote notification engine + native push web bundle to PRODUCTION (local).
# Run from repo root. Requires AWS CLI credentials with prod access.
#
# Order:
#   1) RDS migrations 1024 + 1025
#   2) Lambda warmpawz-prod-api-handler
#   3) admin-web, customer-web, vendor-web (--prod)
#   4) sanity-check-notification-engine-prod.js
#
# Usage:
#   .\scripts\promote-notification-engine-prod.ps1
#   .\scripts\promote-notification-engine-prod.ps1 -SkipMigrations
#   .\scripts\promote-notification-engine-prod.ps1 -SkipDeploy

param(
  [switch]$SkipMigrations,
  [switch]$SkipDeploy,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path -Parent $Root)

if (-not $Yes) {
  Write-Host 'WARNING: This updates PRODUCTION (RDS, Lambda, S3/CloudFront).'
  $confirm = Read-Host "Type yes to continue"
  if ($confirm -ne 'yes') {
    Write-Host 'Cancelled.'
    exit 1
  }
}

if (-not $SkipMigrations) {
  Write-Host "`n== 1) Prod RDS migrations (1024 + 1025, RDS Data API) =="
  $env:I_CONFIRM_PROD_MIGRATION_1024_1025 = 'YES'
  node scripts/run-migration-1024-1025-rds-data-api-prod-cli.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipDeploy) {
  Write-Host "`n== 2) Build + deploy Lambda (prod) =="
  Push-Location backend/lambda
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
  if (-not (Test-Path 'api-handler.zip')) {
    Write-Host 'api-handler.zip missing after build' -ForegroundColor Red
    Pop-Location
    exit 1
  }
  aws lambda update-function-code `
    --function-name warmpawz-prod-api-handler `
    --zip-file fileb://api-handler.zip `
    --region ap-south-1 `
    --output text | Out-Null
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
  aws lambda wait function-updated --function-name warmpawz-prod-api-handler --region ap-south-1
  Pop-Location
  Write-Host 'Lambda prod updated' -ForegroundColor Green

  Write-Host "`n== 3) Deploy customer-web (prod) =="
  $ProdScripts = Join-Path (Split-Path -Parent $Root) 'prodscripts'
  & (Join-Path $ProdScripts 'deploy-customer-web-prod.ps1') -SkipConfirm
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "`n== 4) Deploy vendor-web (prod) =="
  & (Join-Path $ProdScripts 'deploy-vendor-web-prod.ps1') --yes
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "`n== 5) Deploy admin-web (prod) =="
  $adminApi = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
  $adminBucket = 'warmpawz-prod-admin-frontend-ap-south-1'
  $adminCf = 'E2NHO6UUI5UIHW'
  Push-Location apps/admin-web
  if (Test-Path '.next') { Remove-Item -Recurse -Force '.next' }
  if (Test-Path 'dist') { Remove-Item -Recurse -Force 'dist' }
  $env:NEXT_PUBLIC_ENVIRONMENT = 'production'
  $env:NEXT_PUBLIC_API_BASE_URL = $adminApi
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
  Pop-Location
  $inlineCfg = "window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '$adminApi', uatMode: false, environment: 'production' };"
  $runtimeJs = @"
(function(){ window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '$adminApi', uatMode: false, environment: 'production' }; })();
"@
  Set-Content -Path apps/admin-web/dist/runtime-config.js -Value $runtimeJs -Encoding utf8
  Get-ChildItem apps/admin-web/dist -Filter '*.html' -Recurse | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    if ($c -match 'runtime-config-inline') {
      $c = $c -replace "window\.__WARMPAWZ_RUNTIME_CONFIG__ = \{[^}]+\};", $inlineCfg
      Set-Content $_.FullName -Value $c -NoNewline
    }
  }
  aws s3 sync apps/admin-web/dist/ "s3://$adminBucket/" --delete --exclude '*.map'
  aws s3 cp apps/admin-web/dist/runtime-config.js "s3://$adminBucket/runtime-config.js" `
    --content-type 'application/javascript' `
    --cache-control 'no-cache, no-store, must-revalidate' `
    --metadata-directive REPLACE
  aws cloudfront create-invalidation --distribution-id $adminCf --paths '/*' --query 'Invalidation.Id' --output text
  Write-Host 'admin-web prod deployed' -ForegroundColor Green
}

Write-Host "`n== 5) Prod API sanity =="
node scripts/sanity-check-notification-engine-prod.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDone. Test admin prod /notification-engine, then commit dev-abhi after verification."
