$ErrorActionPreference = "Stop"
$Api = "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
$Region = "ap-south-1"
$Root = Split-Path -Parent $PSScriptRoot
$Name = "customer-web"
$Bucket = "warmpawz-dev-customer-frontend-ap-south-1"
$CfId = "E2RDORGXSWJJ87"

Write-Host "=== customer-web (dev) ===" -ForegroundColor Cyan
$appDir = Join-Path $Root "apps\$Name"
Push-Location $appDir
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
if (Test-Path .next) { Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue }
$env:NODE_ENV = "production"
$env:NEXT_PUBLIC_API_BASE_URL = $Api
$env:NEXT_PUBLIC_ENVIRONMENT = "development"
$env:NEXT_PUBLIC_UAT_MODE = "true"
$env:NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED = "true"
$env:NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED = "true"
npm ci --include=dev
npm run build
if (-not (Test-Path dist)) { throw "dist missing after customer-web build" }
Pop-Location

$distPath = Join-Path $Root "apps\$Name\dist"
aws s3 sync "$distPath/" "s3://$Bucket/" --delete --exclude "*.map" --region $Region
Get-ChildItem $distPath -Filter *.html -Recurse | ForEach-Object {
  $rel = $_.FullName.Substring((Join-Path $distPath "").Length).Replace('\','/')
  aws s3 cp $_.FullName "s3://$Bucket/$rel" --cache-control "public, max-age=0, must-revalidate" --content-type "text/html" --region $Region | Out-Null
}
$inv = aws cloudfront create-invalidation --distribution-id $CfId --paths "/*" --region $Region --query Invalidation.Id --output text
Write-Host "customer-web CloudFront invalidation: $inv" -ForegroundColor Green
