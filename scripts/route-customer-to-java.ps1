#Requires -Version 5.1
<#
.SYNOPSIS
  Point /customer/*, /customers/*, /pets/* at Java customer-service (VPC link).
  Keeps /customer/bookings/* on Java booking-service.

.PARAMETER Revert
  Send customer proxy routes back to Lambda (jrsc8v3).

.EXAMPLE
  .\scripts\route-customer-to-java.ps1

.EXAMPLE
  .\scripts\route-customer-to-java.ps1 -Revert
#>
param(
  [string] $ApiId = 'z0b3obweb6',
  [string] $LambdaIntegrationId = 'jrsc8v3',
  [string] $CustomerServiceIntegrationId = '',
  [string] $BookingServiceIntegrationId = 'bsttuan',
  [string] $Region = 'ap-south-1',
  [switch] $Revert
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

if (-not $CustomerServiceIntegrationId) {
  $integrationsJson = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'get-integrations', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
  )
  $items = ($integrationsJson.StdOut | ConvertFrom-Json).Items
  $customer = $items | Where-Object {
    $_.IntegrationType -eq 'HTTP_PROXY' -and $_.IntegrationUri -match 'warmpawz-dev-customer'
  } | Select-Object -First 1
  if (-not $customer) {
    throw 'Customer Java integration not found (ALB URI must contain warmpawz-dev-customer). Run apply-customer-stack-dev.ps1 first.'
  }
  $CustomerServiceIntegrationId = $customer.IntegrationId
  Write-Host "Resolved customer integration: $CustomerServiceIntegrationId"
}

$customerTarget = if ($Revert) { $LambdaIntegrationId } else { $CustomerServiceIntegrationId }
$bookingTarget = "integrations/$BookingServiceIntegrationId"

Write-Host "API: $ApiId  customer -> integrations/$customerTarget  ($Region)"

$routesJson = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
)
$routes = ($routesJson.StdOut | ConvertFrom-Json).Items

function Update-RouteTarget([string]$RouteKey, [string]$Target) {
  $route = $routes | Where-Object { $_.RouteKey -eq $RouteKey } | Select-Object -First 1
  if (-not $route) {
    Write-Warning "Route not found: $RouteKey"
    return
  }
  Write-Host "Updating $RouteKey ($($route.RouteId)) -> $Target"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'update-route',
    '--api-id', $ApiId,
    '--route-id', $route.RouteId,
    '--target', $Target,
    '--region', $Region,
    '--output', 'json'
  ) | Out-Null
}

function Ensure-Route([string]$RouteKey, [string]$Target) {
  $route = $routes | Where-Object { $_.RouteKey -eq $RouteKey } | Select-Object -First 1
  if ($route) {
    Update-RouteTarget $RouteKey $Target
    return
  }
  if ($Revert) { return }
  Write-Host "Creating $RouteKey -> $Target"
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

# Booking paths under /customer/* stay on booking-service Java
if (-not $Revert) {
  Ensure-Route 'ANY /customer/bookings/{proxy+}' $bookingTarget
}

foreach ($key in @(
    'ANY /customer/{proxy+}',
    'ANY /customers/{proxy+}',
    'ANY /pets/{proxy+}',
    'ANY /customer',
    'ANY /customers',
    'ANY /pets'
  )) {
  Update-RouteTarget $key "integrations/$customerTarget"
}

# Legacy per-path GET/POST routes (more specific than proxy) — point at customer Java unless reverting
$prefixes = @('/customer/', '/customers/', '/pets/')
foreach ($route in $routes) {
  $rk = $route.RouteKey
  if ($rk -notmatch '^(GET|POST|PUT|PATCH|DELETE|ANY) ') { continue }
  $path = ($rk -split ' ', 2)[1]
  if ($path -match '^/customer/bookings') { continue }
  $hit = $false
  foreach ($p in $prefixes) {
    if ($path.StartsWith($p)) { $hit = $true; break }
  }
  if (-not $hit) { continue }
  if ($rk -in @('ANY /customer/{proxy+}', 'ANY /customers/{proxy+}', 'ANY /pets/{proxy+}')) { continue }
  Update-RouteTarget $rk "integrations/$customerTarget"
}

Write-Host "`nCustomer-related routes:"
Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
) | ForEach-Object {
  ($_.StdOut | ConvertFrom-Json).Items |
    Where-Object { $_.RouteKey -match 'customer|/pets' } |
    Sort-Object RouteKey |
    ForEach-Object { Write-Host $_.RouteKey '->' $_.Target }
}
