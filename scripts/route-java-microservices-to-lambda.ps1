#Requires -Version 5.1
<#
.SYNOPSIS
  Point all customer-service and booking-service Java ECS routes at the Lambda monolith.

  Frontend apps keep a single API base URL (e.g. z0b3obweb6.execute-api.ap-south-1.amazonaws.com).
  During strangler cutover, API Gateway may route explicit /customer/* and /booking(s)/* paths to
  Java HTTP_PROXY integrations. This script restores full Lambda routing for dev.

.PARAMETER ApiId
  API Gateway ID (dev default: z0b3obweb6)

.PARAMETER LambdaIntegrationId
  Lambda integration ID (dev default: jrsc8v3 = warmpawz-dev-api-handler)

.PARAMETER JavaIntegrationIds
  Integration IDs to replace (dev defaults: customer 17hs4nn/hv286ua, booking bsttuan)

.EXAMPLE
  .\scripts\route-java-microservices-to-lambda.ps1
#>
param(
  [string] $ApiId = 'z0b3obweb6',
  [string] $LambdaIntegrationId = 'jrsc8v3',
  [string[]] $JavaIntegrationIds = @('bsttuan', '17hs4nn', 'hv286ua'),
  [string] $Region = 'ap-south-1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

$lambdaTarget = "integrations/$LambdaIntegrationId"
$javaTargets = $JavaIntegrationIds | ForEach-Object { "integrations/$_" }

Write-Host "API: $ApiId  -> $lambdaTarget  ($Region)"
Write-Host "Replacing Java targets: $($javaTargets -join ', ')"

$routesJson = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
)
$routes = ($routesJson.StdOut | ConvertFrom-Json).Items

$toUpdate = @($routes | Where-Object { $javaTargets -contains $_.Target })
Write-Host "Routes to update: $($toUpdate.Count)"

$updated = 0
foreach ($route in $toUpdate) {
  Write-Host "  $($route.RouteKey)  ($($route.RouteId))"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'update-route',
    '--api-id', $ApiId,
    '--route-id', $route.RouteId,
    '--target', $lambdaTarget,
    '--region', $Region,
    '--output', 'json'
  ) | Out-Null
  $updated += 1
}

# Ensure catch-all proxy routes also target Lambda (explicit routes win over these, but keep consistent).
foreach ($key in @(
    'ANY /bookings/{proxy+}',
    'ANY /booking/{proxy+}',
    'ANY /customer/{proxy+}',
    'ANY /customers/{proxy+}',
    'ANY /pets/{proxy+}'
  )) {
  $route = $routes | Where-Object { $_.RouteKey -eq $key } | Select-Object -First 1
  if (-not $route) { continue }
  if ($route.Target -eq $lambdaTarget) {
    Write-Host "OK (unchanged): $key"
    continue
  }
  Write-Host "Updating catch-all $key ($($route.RouteId))"
  Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'apigatewayv2', 'update-route',
    '--api-id', $ApiId,
    '--route-id', $route.RouteId,
    '--target', $lambdaTarget,
    '--region', $Region,
    '--output', 'json'
  ) | Out-Null
  $updated += 1
}

Write-Host "`nUpdated $updated route(s). Remaining Java targets:"
Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'apigatewayv2', 'get-routes', '--api-id', $ApiId, '--region', $Region, '--output', 'json'
) | ForEach-Object {
  $remaining = ($_.StdOut | ConvertFrom-Json).Items | Where-Object { $javaTargets -contains $_.Target }
  if ($remaining.Count -eq 0) {
    Write-Host '  (none — all customer/booking routes on Lambda)'
  } else {
    $remaining | ForEach-Object { Write-Host "  $($_.RouteKey) -> $($_.Target)" }
  }
}
