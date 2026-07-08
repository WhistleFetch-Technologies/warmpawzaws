$ErrorActionPreference = "Stop"
$Api = "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
$Region = "ap-south-1"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-RuntimeConfig($AppPath, $Uat) {
  $uatJs = if ($Uat) { "true" } else { "false" }
  $content = @"
// Runtime Configuration (dev deploy)
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "$Api",
    uatMode: $uatJs,
    environment: "development",
    firebaseApiKey: "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
    firebaseAuthDomain: "warmpawz-b9baf.firebaseapp.com",
    firebaseProjectId: "warmpawz-b9baf",
    firebaseStorageBucket: "warmpawz-b9baf.firebasestorage.app",
    firebaseMessagingSenderId: "771876271254",
    firebaseAppId: "1:771876271254:web:3191a5c001b269f2f1beb7",
    firebaseMeasurementId: "G-PYF54Y34BP"
  };
})();
"@
  Set-Content -Path (Join-Path $AppPath "dist\runtime-config.js") -Value $content -Encoding UTF8
}

function Deploy-App($Name, $Bucket, $CfId, $BuildEnv) {
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  $appDir = Join-Path $Root "apps\$Name"
  Push-Location $appDir
  if (Test-Path dist) { Remove-Item -Recurse -Force dist }
  if (Test-Path .next) { Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue }
  $env:NODE_ENV = "production"
  foreach ($kv in $BuildEnv.GetEnumerator()) { Set-Item -Path "env:$($kv.Key)" -Value $kv.Value }
  npm ci --include=dev
  npm run build
  if (-not (Test-Path dist)) { throw "dist missing after $Name build" }
  if ($Name -ne "customer-web") { Write-RuntimeConfig $appDir $true }
  Pop-Location
  $distPath = Join-Path $Root "apps\$Name\dist"
  aws s3 sync "$distPath/" "s3://$Bucket/" --delete --exclude "*.map" --region $Region
  if (Test-Path (Join-Path $distPath "runtime-config.js")) {
    aws s3 cp (Join-Path $distPath "runtime-config.js") "s3://$Bucket/runtime-config.js" --cache-control "public, max-age=0, must-revalidate" --content-type "application/javascript" --region $Region
  }
  Get-ChildItem $distPath -Filter *.html -Recurse | ForEach-Object {
    $rel = $_.FullName.Substring((Join-Path $distPath "").Length).Replace('\','/')
    aws s3 cp $_.FullName "s3://$Bucket/$rel" --cache-control "public, max-age=0, must-revalidate" --content-type "text/html" --region $Region | Out-Null
  }
  $inv = aws cloudfront create-invalidation --distribution-id $CfId --paths "/*" --region $Region --query Invalidation.Id --output text
  Write-Host "CloudFront invalidation: $inv" -ForegroundColor Green
}

Write-Host "=== Lambda ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend\lambda")
npm run build
aws lambda update-function-code --function-name warmpawz-dev-api-handler --zip-file fileb://api-handler.zip --region $Region --output text --query LastModified
if (Test-Path loyalty-consumer.zip) {
  aws lambda update-function-code --function-name warmpawz-dev-loyalty-events-consumer --zip-file fileb://loyalty-consumer.zip --region $Region --output text --query LastModified
}
$envFile = Join-Path $Root "scripts\_lambda-env-update.json"
node -e @"
const { execSync } = require('child_process');
const fs = require('fs');
const fn = 'warmpawz-dev-api-handler';
const envFile = process.argv[1];
const r = execSync('aws lambda get-function-configuration --function-name ' + fn + ' --region ap-south-1 --output json', { encoding: 'utf8' });
const v = JSON.parse(r).Environment.Variables;
v.FINANCE_FUNDING_AWARE_SETTLEMENT = 'SHADOW';
v.DISCOUNT_ENGINE_V2_RESOLVER_MODE = 'AUTHORITATIVE';
v.DISCOUNT_ENGINE_V2_STACK_MODE = 'AUTHORITATIVE';
v.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'AUTHORITATIVE';
v.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE = 'AUTHORITATIVE';
v.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = v.DISCOUNT_ENGINE_V2_ANALYTICS_MODE || 'AUTHORITATIVE';
v.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = v.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE || 'AUTHORITATIVE';
v.COMMERCIAL_AI_COPILOT_ENABLED = v.COMMERCIAL_AI_COPILOT_ENABLED || 'true';
// Prefer Terraform as source of truth for CAMPAIGN_MODE (OFF -> SHADOW -> AUTHORITATIVE).
// This deploy script only fills a default if the variable is missing on the function.
fs.writeFileSync(envFile, JSON.stringify({ Variables: v }));
execSync('aws lambda update-function-configuration --function-name ' + fn + ' --region ap-south-1 --environment file://' + envFile.replace(/\\\\/g, '/'), { stdio: 'inherit' });
console.log('Dev Lambda V2 modes: RESOLVER/STACK/PRIORITY/SETTLEMENT/ANALYTICS/CAMPAIGN (Terraform-aligned defaults)');
"@ $envFile
Pop-Location

$common = @{
  "NEXT_PUBLIC_API_BASE_URL" = $Api
  "NEXT_PUBLIC_ENVIRONMENT" = "development"
}

Deploy-App "admin-web" "warmpawz-dev-admin-frontend-ap-south-1" "E1WPXL8WBOWOE8" ($common.Clone())
Deploy-App "vendor-web" "warmpawz-dev-vendor-frontend-ap-south-1" "E95171GX1I6HN" ($common.Clone())
$cust = $common.Clone()
$cust["NEXT_PUBLIC_UAT_MODE"] = "true"
$cust["NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED"] = "true"
$cust["NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED"] = "true"
Deploy-App "customer-web" "warmpawz-dev-customer-frontend-ap-south-1" "E2RDORGXSWJJ87" $cust

Write-Host "`nAll dev deploys complete." -ForegroundColor Green
