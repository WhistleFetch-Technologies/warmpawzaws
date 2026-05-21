#Requires -Version 5.1
<#
.SYNOPSIS
  Point /bookings/* and /booking/* at Lambda instead of Java booking-service.

.PARAMETER ApiId
  API Gateway ID (dev default: z0b3obweb6)

.PARAMETER LambdaIntegrationId
  Lambda integration ID (dev default: jrsc8v3 = warmpawz-dev-api-handler)

.PARAMETER BookingServiceIntegrationId
  When -Revert is set, use this integration (dev default: bsttuan)

.EXAMPLE
  .\scripts\route-bookings-to-lambda.ps1

.EXAMPLE
  .\scripts\route-bookings-to-lambda.ps1 -Revert
#>
param(
  [string] $ApiId = 'z0b3obweb6',
  [string] $LambdaIntegrationId = 'jrsc8v3',
  [string] $BookingServiceIntegrationId = 'bsttuan',
  [string] $Region = 'ap-south-1',
  [switch] $Revert
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

$targetIntegration = if ($Revert) { $BookingServiceIntegrationId } else { $LambdaIntegrationId }
Write-Host "API: $ApiId  -> integrations/$targetIntegration  ($Region)"

$routesJson = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
)
$routes = ($routesJson.StdOut | ConvertFrom-Json).Items

foreach ($key in @('ANY /bookings/{proxy+}', 'ANY /booking/{proxy+}')) {
  $route = $routes | Where-Object { $_.RouteKey -eq $key } | Select-Object -First 1
  if (-not $route) {
    Write-Warning "Route not found: $key"
    continue
  }
  Write-Host "Updating $key ($($route.RouteId))"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'update-route',
    '--api-id', $ApiId,
    '--route-id', $route.RouteId,
    '--target', "integrations/$targetIntegration",
    '--region', $Region,
    '--output', 'json'
  ) | Out-Null
}

Write-Host "`nBooking routes:"
Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region,
  '--query', "Items[?contains(RouteKey, 'booking')].[RouteKey,Target]",
  '--output', 'table'
)

Write-Host "`nSmoke test POST /bookings/create:"
curl.exe -s -X POST "https://$ApiId.execute-api.$Region.amazonaws.com/bookings/create" `
  -H "Content-Type: application/json" -d "{}"
