# Dev deploy for Lambda + admin/vendor/customer web (Windows — mirrors deploy-*.sh)
$ErrorActionPreference = 'Stop'
$Region = 'ap-south-1'
$ApiBase = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Deploy-Lambda {
  Write-Host "`n=== Lambda (warmpawz-dev-api-handler) ===" -ForegroundColor Cyan
  Set-Location "$Root\backend\lambda"
  npm run build
  if (-not (Test-Path 'api-handler.zip')) { throw 'api-handler.zip missing after build' }
  aws lambda update-function-code --function-name warmpawz-dev-api-handler --zip-file fileb://api-handler.zip --region $Region --output text | Out-Null
  aws lambda wait function-updated --function-name warmpawz-dev-api-handler --region $Region
  Write-Host 'Lambda deployed.' -ForegroundColor Green
  Set-Location $Root
}

function Write-RuntimeConfig {
  param([string]$AppPath, [string]$Content)
  $dist = Join-Path $AppPath 'dist'
  if (-not (Test-Path $dist)) { throw "dist missing: $dist" }
  Set-Content -Path (Join-Path $dist 'runtime-config.js') -Value $Content -Encoding UTF8
}

function Sync-S3AndInvalidate {
  param([string]$DistPath, [string]$Bucket, [string]$CfId)
  aws s3 sync $DistPath "s3://$Bucket/" --delete --exclude '*.map' --region $Region
  $inv = aws cloudfront create-invalidation --distribution-id $CfId --paths '/*' --query 'Invalidation.Id' --output text
  Write-Host "S3 sync + CF invalidation $inv" -ForegroundColor Green
}

function Deploy-AdminWeb {
  Write-Host "`n=== admin-web ===" -ForegroundColor Cyan
  Set-Location "$Root\apps\admin-web"
  npm run build
  Write-RuntimeConfig (Get-Location) @"
// Runtime Configuration for Warmpawz admin-web
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "$ApiBase",
    uatMode: true
  };
  console.log('Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
"@
  Sync-S3AndInvalidate (Join-Path (Get-Location) 'dist') 'warmpawz-dev-admin-frontend-ap-south-1' 'E1WPXL8WBOWOE8'
  Set-Location $Root
}

function Deploy-VendorWeb {
  Write-Host "`n=== vendor-web ===" -ForegroundColor Cyan
  Set-Location "$Root\apps\vendor-web"
  $env:ENABLE_STATIC_EXPORT = 'true'
  npm run build
  Remove-Item Env:ENABLE_STATIC_EXPORT -ErrorAction SilentlyContinue
  Write-RuntimeConfig (Get-Location) @"
// Runtime Configuration for Warmpawz vendor-web
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "$ApiBase",
    uatMode: true,
    firebaseApiKey: "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
    firebaseAuthDomain: "warmpawz-b9baf.firebaseapp.com",
    firebaseProjectId: "warmpawz-b9baf",
    firebaseStorageBucket: "warmpawz-b9baf.firebasestorage.app",
    firebaseMessagingSenderId: "771876271254",
    firebaseAppId: "1:771876271254:web:3191a5c001b269f2f1beb7",
    firebaseMeasurementId: "G-PYF54Y34BP"
  };
  console.log('Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
"@
  $dist = Join-Path (Get-Location) 'dist'
  Sync-S3AndInvalidate $dist 'warmpawz-dev-vendor-frontend-ap-south-1' 'E95171GX1I6HN'
  Set-Location $Root
}

function Deploy-CustomerWeb {
  Write-Host "`n=== customer-web ===" -ForegroundColor Cyan
  Set-Location "$Root\apps\customer-web"
  Remove-Item -Recurse -Force .next, dist, node_modules\.cache -ErrorAction SilentlyContinue
  $env:NEXT_PUBLIC_ENVIRONMENT = 'development'
  $env:NEXT_PUBLIC_API_BASE_URL = $ApiBase
  $env:NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED = 'false'
  $env:NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED = 'true'
  $env:NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'BBYvLo7VKgqxQf5reB_dduYQlMYt8447__prjBMxQxfgROeLHYzLuHkKkA99FO2G0fzC4MlG2VbvVNSS-PnnYMw'
  npm run build
  Remove-Item Env:NEXT_PUBLIC_ENVIRONMENT, Env:NEXT_PUBLIC_API_BASE_URL, Env:NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED, Env:NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED, Env:NEXT_PUBLIC_FIREBASE_VAPID_KEY -ErrorAction SilentlyContinue
  $dist = Join-Path (Get-Location) 'dist'
  if (-not (Test-Path $dist)) { throw 'customer-web dist missing' }
  Write-RuntimeConfig (Get-Location) @"
// Runtime Configuration for Warmpawz customer-web (DEV)
(function() {
  'use strict';
  var existing = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
  window.__WARMPAWZ_RUNTIME_CONFIG__ = Object.assign(existing, {
    apiBaseUrl: "$ApiBase",
    uatMode: true,
    environment: "development",
    firebaseApiKey: "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
    firebaseAuthDomain: "warmpawz-b9baf.firebaseapp.com",
    firebaseProjectId: "warmpawz-b9baf",
    firebaseStorageBucket: "warmpawz-b9baf.firebasestorage.app",
    firebaseMessagingSenderId: "771876271254",
    firebaseAppId: "1:771876271254:web:3191a5c001b269f2f1beb7",
    firebaseMeasurementId: "G-PYF54Y34BP",
    customerEcommerceEnabled: false,
    customerMealPlansEnabled: true
  });
  console.log('Runtime config loaded (DEV):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
"@
  Get-ChildItem $dist -Filter '*.html' -Recurse -File | ForEach-Object {
    if ($_.Name -eq 'index.html' -and $_.DirectoryName -eq $dist) { return }
    $alias = Join-Path $_.DirectoryName $_.BaseName
    Copy-Item $_.FullName $alias -Force
  }
  $bucket = 'warmpawz-dev-customer-frontend-ap-south-1'
  aws s3 sync $dist "s3://$bucket/" --delete --exclude '*.map' --region $Region
  Get-ChildItem $dist -Recurse -File | Where-Object { $_.Extension -eq '' } | ForEach-Object {
    $rel = $_.FullName.Substring($dist.Length + 1).Replace('\', '/')
    aws s3 cp $_.FullName "s3://$bucket/$rel" --content-type 'text/html; charset=utf-8' --region $Region | Out-Null
  }
  $inv = aws cloudfront create-invalidation --distribution-id E2RDORGXSWJJ87 --paths '/*' --query 'Invalidation.Id' --output text
  Write-Host "customer-web S3 sync + CF invalidation $inv" -ForegroundColor Green
  Set-Location $Root
}

Deploy-Lambda
Deploy-AdminWeb
Deploy-VendorWeb
Deploy-CustomerWeb

Write-Host "`n=== All dev deploys complete ===" -ForegroundColor Green
Write-Host "API:    $ApiBase"
Write-Host "Admin:  https://dfof7mguaa0a5.cloudfront.net"
Write-Host "Vendor: https://d1s6ykkj381k58.cloudfront.net"
Write-Host "Customer: https://d2aoyjj8ine0wk.cloudfront.net"
