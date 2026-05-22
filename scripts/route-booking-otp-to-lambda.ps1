#Requires -Version 5.1
<#
.SYNOPSIS
  Route booking OTP endpoints to Lambda (UAT JWT already works there) ahead of Java /bookings/{proxy+}.
#>
param(
  [string] $ApiId = 'z0b3obweb6',
  [string] $LambdaIntegrationId = 'jrsc8v3',
  [string] $Region = 'ap-south-1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

$target = "integrations/$LambdaIntegrationId"
$routesJson = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
)
$routes = ($routesJson.StdOut | ConvertFrom-Json).Items

function Ensure-Route([string]$RouteKey) {
  $route = $routes | Where-Object { $_.RouteKey -eq $RouteKey } | Select-Object -First 1
  if ($route) {
    Write-Host "Update $RouteKey -> $target"
    Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
      'apigatewayv2', 'update-route', '--api-id', $ApiId, '--route-id', $route.RouteId,
      '--target', $target, '--region', $Region
    ) | Out-Null
    return
  }
  Write-Host "Create $RouteKey -> $target"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'create-route', '--api-id', $ApiId, '--route-key', $RouteKey,
    '--target', $target, '--authorization-type', 'NONE', '--region', $Region
  ) | Out-Null
}

foreach ($key in @('POST /bookings/generate-otp', 'POST /bookings/verify-otp')) {
  Ensure-Route $key
}

Write-Host "`nBooking OTP routes:"
(Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
)).StdOut | ConvertFrom-Json | Select-Object -ExpandProperty Items |
  Where-Object { $_.RouteKey -match 'generate-otp|verify-otp' } |
  ForEach-Object { Write-Host "$($_.RouteKey) -> $($_.Target)" }
