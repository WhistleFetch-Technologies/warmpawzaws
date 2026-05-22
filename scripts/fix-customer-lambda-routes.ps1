#Requires -Version 5.1
<#
.SYNOPSIS
  After customer-service ECS deploy, restore Lambda routing for /customer paths
  that Java does not implement (notifications, banners, bookings/active, etc.).

  Keeps explicit routes on customer-service Java for profile, by-phone, pets, etc.

.EXAMPLE
  .\scripts\fix-customer-lambda-routes.ps1
#>
param(
  [string] $ApiId = 'z0b3obweb6',
  [string] $LambdaIntegrationId = 'jrsc8v3',
  [string] $CustomerJavaIntegrationId = 'hv286ua',
  [string] $Region = 'ap-south-1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

$lambdaTarget = "integrations/$LambdaIntegrationId"
$javaTarget = "integrations/$CustomerJavaIntegrationId"

# Paths implemented in services/customer-service (keep on Java when a dedicated route exists).
$keepOnJava = @(
  'GET /customer/by-phone',
  'GET /customer/profile',
  'GET /customer/pets',
  'GET /customer/{customerId}',
  'PUT /customer/{customerId}',
  'POST /customer/profile',
  'ANY /customers/{proxy+}',
  'ANY /pets/{proxy+}',
  'ANY /customers',
  'ANY /pets'
)

# Lambda-only convenience / discovery / inbox routes (must not hit Java).
$forceLambda = @(
  'GET /customer/notifications',
  'POST /customer/notifications',
  'GET /customer/bookings/active',
  'GET /customer/bookings',
  'GET /customer/announcements',
  'GET /customer/discover-services',
  'GET /customer/search-suggestions',
  'GET /customer/banners',
  'GET /customer/payment-methods',
  'GET /customer/articles',
  'GET /customer/adoption-stats',
  'GET /customer/wallet',
  'GET /customer/refund-policy',
  'GET /customer/delivery-fee-policy',
  'POST /customer/delivery-fee/calculate',
  'GET /customer/featured-vendors',
  'POST /customer/change-password',
  'POST /customer/set-password',
  'POST /customer/profile/set-password',
  'GET /customer/password-status',
  'GET /customer/profile/password-status',
  'DELETE /customer/{customerId}',
  'ANY /customer/{proxy+}',
  'ANY /customer'
)

Write-Host "API: $ApiId  Lambda=$LambdaIntegrationId  Java=$CustomerJavaIntegrationId  ($Region)"

$routesJson = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
)
$routes = ($routesJson.StdOut | ConvertFrom-Json).Items

function Update-RouteTarget([string]$RouteKey, [string]$Target) {
  $route = $routes | Where-Object { $_.RouteKey -eq $RouteKey } | Select-Object -First 1
  if (-not $route) { return $false }
  if ($route.Target -eq $Target) {
    Write-Host "OK (unchanged): $RouteKey"
    return $true
  }
  Write-Host "Update: $RouteKey -> $Target"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'update-route',
    '--api-id', $ApiId,
    '--route-id', $route.RouteId,
    '--target', $Target,
    '--region', $Region,
    '--output', 'json'
  ) | Out-Null
  return $true
}

function Ensure-Route([string]$RouteKey, [string]$Target) {
  $route = $routes | Where-Object { $_.RouteKey -eq $RouteKey } | Select-Object -First 1
  if ($route) {
    Update-RouteTarget $RouteKey $Target | Out-Null
    return
  }
  Write-Host "Create: $RouteKey -> $Target"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'create-route',
    '--api-id', $ApiId,
    '--route-key', $RouteKey,
    '--target', $Target,
    '--authorization-type', 'NONE',
    '--region', $Region,
    '--output', 'json'
  ) | Out-Null
}

foreach ($key in $forceLambda) {
  Ensure-Route $key $lambdaTarget
}

foreach ($key in $keepOnJava) {
  if (-not (Update-RouteTarget $key $javaTarget)) {
    Write-Warning "Java route not found (optional): $key"
  }
}

Write-Host "`nSmoke tests:"
$tests = @(
  @{ Path = '/customer/notifications?phone=9399893220&limit=5'; Want = '200' },
  @{ Path = '/customer/bookings/active?phone=9399893220'; Want = '200' },
  @{ Path = '/customer/banners'; Want = '200' },
  @{ Path = '/customer/by-phone?phone=9399893220'; Want = '200' }
)
foreach ($t in $tests) {
  $code = curl.exe -s -o NUL -w '%{http_code}' "https://$ApiId.execute-api.$Region.amazonaws.com$($t.Path)"
  $ok = if ($code -eq $t.Want) { 'OK' } else { 'FAIL' }
  Write-Host "  $ok $($t.Path) -> HTTP $code (want $($t.Want))"
}
