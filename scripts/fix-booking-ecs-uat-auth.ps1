#Requires -Version 5.1
<#
.SYNOPSIS
  Fix booking-service ECS auth: enable JWT resource server + UAT secret (matches Lambda dev issuer).

  With APP_SECURITY_ENABLED=false, Spring never parses Bearer tokens and OTP endpoints return 403.
#>
param(
  [string] $Region = 'ap-south-1',
  [string] $Cluster = 'warmpawz-dev-booking-cluster',
  [string] $Service = 'warmpawz-dev-booking-svc',
  [string] $TaskFamily = 'warmpawz-dev-booking-task',
  [string] $Container = 'booking-service',
  [string] $UatSecret = 'uat-secret-key-change-in-production'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"
$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

$tdArn = (Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'ecs', 'describe-services', '--cluster', $Cluster, '--services', $Service,
  '--region', $Region, '--query', 'services[0].taskDefinition', '--output', 'text'
)).StdOut.Trim()

if (-not $tdArn -or $tdArn -eq 'None') { throw "Could not resolve task definition for $Service" }

$jsonPath = Join-Path $env:TEMP "booking-task-def-$([Guid]::NewGuid().ToString('N')).json"
(Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'ecs', 'describe-task-definition', '--task-definition', $tdArn,
  '--region', $Region, '--query', 'taskDefinition', '--output', 'json'
)).StdOut | Out-File -FilePath $jsonPath -Encoding utf8NoBOM

$outPath = Join-Path $env:TEMP "booking-task-register-$([Guid]::NewGuid().ToString('N')).json"
node -e @"
const fs = require('fs');
const task = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']) {
  delete task[k];
}
task.family = process.argv[2];
const c = task.containerDefinitions.find(x => x.name === process.argv[3]) || task.containerDefinitions[0];
c.environment = Array.isArray(c.environment) ? c.environment : [];
const upsert = (n, v) => {
  const e = c.environment.find(x => x.name === n);
  if (e) e.value = v; else c.environment.push({ name: n, value: v });
};
upsert('APP_SECURITY_ENABLED', 'true');
upsert('APP_SECURITY_UAT_JWT_ENABLED', 'true');
upsert('UAT_JWT_SECRET', process.argv[4]);
fs.writeFileSync(process.argv[5], JSON.stringify(task));
"@ $jsonPath $TaskFamily $Container $UatSecret $outPath

$newArn = (Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'ecs', 'register-task-definition', '--cli-input-json', "file://$($outPath -replace '\\','/')",
  '--region', $Region, '--query', 'taskDefinition.taskDefinitionArn', '--output', 'text'
)).StdOut.Trim()

Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'ecs', 'update-service', '--cluster', $Cluster, '--service', $Service,
  '--task-definition', $newArn, '--force-new-deployment', '--region', $Region
) | Out-Null

Write-Host "Registered: $newArn"
Write-Host "Waiting for service stable (up to ~3 min)..."
$deadline = (Get-Date).AddMinutes(4)
do {
  Start-Sleep -Seconds 15
  $st = (Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'ecs', 'describe-services', '--cluster', $Cluster, '--services', $Service,
    '--region', $Region, '--query', 'services[0].deployments[?status==``PRIMARY``].[runningCount,desiredCount,rolloutState]', '--output', 'text'
  )).StdOut.Trim()
  Write-Host "  deployment: $st"
  if ($st -match '^\d+\s+\d+\s+COMPLETED$') { break }
} while ((Get-Date) -lt $deadline)

Remove-Item -Force $jsonPath, $outPath -ErrorAction SilentlyContinue
Write-Host "Done. Retry POST /bookings/generate-otp with your UAT Bearer token."
