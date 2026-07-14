$ErrorActionPreference = 'Stop'
$Region = 'ap-south-1'
$ApiBase = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
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
$rc = @"
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
Set-Content -Path (Join-Path $dist 'runtime-config.js') -Value $rc -Encoding UTF8
Get-ChildItem $dist -Filter '*.html' -Recurse -File | ForEach-Object {
  if ($_.Name -eq 'index.html' -and $_.DirectoryName -eq $dist) { return }
  Copy-Item $_.FullName (Join-Path $_.DirectoryName $_.BaseName) -Force
}
$bucket = 'warmpawz-dev-customer-frontend-ap-south-1'
aws s3 sync $dist "s3://$bucket/" --delete --exclude '*.map' --region $Region
Get-ChildItem $dist -Recurse -File | Where-Object { $_.Extension -eq '' } | ForEach-Object {
  $rel = $_.FullName.Substring($dist.Length + 1).Replace('\', '/')
  aws s3 cp $_.FullName "s3://$bucket/$rel" --content-type 'text/html; charset=utf-8' --region $Region | Out-Null
}
$inv = aws cloudfront create-invalidation --distribution-id E2RDORGXSWJJ87 --paths '/*' --query 'Invalidation.Id' --output text
Write-Host "customer-web deployed. CF invalidation: $inv"
