#Requires -Version 5.1
<#
.SYNOPSIS
  Adds support_tickets.attachments on RDS using AWS CLI only (no Node).
  Fixes: column "attachments" of relation "support_tickets" does not exist

.DESCRIPTION
  Uses: aws rds describe-db-clusters + aws rds-data execute-statement
  Requires: AWS CLI v2, credentials configured, RDS Data API enabled on cluster.

.PARAMETER Environment
  dev -> warmpawz-dev-cluster | prod -> warmpawz-prod-cluster

.EXAMPLE
  cd scripts
  .\run-migration-617-aws-cli.ps1 -Environment dev
  $env:AWS_REGION = "eu-west-1"; .\run-migration-617-aws-cli.ps1 -Environment prod
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Environment = 'dev',
  [string] $ClusterId = '',
  [string] $Database = 'warmpawz'
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\_aws-cli-helpers.ps1"

$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) {
  Write-Host 'AWS CLI v2 not found (PATH or Program Files). Install from:' -ForegroundColor Yellow
  Write-Host '  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' -ForegroundColor Gray
  Write-Host 'Or run the same migration with Node (no aws.exe needed):' -ForegroundColor Yellow
  Write-Host '  cd scripts' -ForegroundColor Gray
  Write-Host '  npm install' -ForegroundColor Gray
  Write-Host '  $env:ENVIRONMENT = "dev"; $env:AWS_REGION = "ap-south-1"; npm run migrate:617' -ForegroundColor Gray
  throw 'aws: command not found'
}
Write-Host "Using AWS CLI: $AwsExe" -ForegroundColor DarkGray

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }
if (-not $ClusterId) {
  $ClusterId = if ($Environment -eq 'prod') { 'warmpawz-prod-cluster' } else { 'warmpawz-dev-cluster' }
}

Write-Host "Region: $Region  Cluster: $ClusterId  Database: $Database" -ForegroundColor Cyan
Write-Host "Scope: only adds support_tickets.attachments (IF NOT EXISTS). No other tables." -ForegroundColor DarkGray

$d = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'rds', 'describe-db-clusters',
  '--db-cluster-identifier', $ClusterId,
  '--region', $Region,
  '--output', 'json'
)
if ($d.ExitCode -ne 0) {
  $msg = if ($d.StdErr) { $d.StdErr } elseif ($d.StdOut) { $d.StdOut } else { 'unknown error' }
  if ($msg -match 'NoCredentials|Unable to locate credentials') {
    Write-Host ''
    Write-Host 'No AWS credentials. Option A: run first in this terminal:' -ForegroundColor Yellow
    Write-Host '  aws configure' -ForegroundColor White
    Write-Host 'Or: $env:AWS_PROFILE = "your-profile"; aws sso login --profile your-profile' -ForegroundColor White
    Write-Host ''
  }
  throw "describe-db-clusters failed: $msg"
}
$clusterJson = $d.StdOut | ConvertFrom-Json
if (-not $clusterJson.DBClusters -or $clusterJson.DBClusters.Count -eq 0) { throw "Cluster not found: $ClusterId" }
$cluster = $clusterJson.DBClusters[0]
if (-not $cluster) { throw "Cluster not found: $ClusterId" }

$resourceArn = $cluster.DBClusterArn
if (-not $cluster.HttpEndpointEnabled) {
  throw "Data API is disabled on this cluster (HttpEndpointEnabled=false). Enable it or use psql/Query Editor."
}

$secretArn = $cluster.MasterUserSecret.SecretArn
if (-not $secretArn) {
  if ($Environment -eq 'prod') {
    $secretName = 'warmpawz-prod-rds-master-20260207201049162400000001'
  } else {
    $secretName = 'warmpawz-dev-rds-master-20260106164510791100000002'
  }
  $s = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'secretsmanager', 'describe-secret',
    '--secret-id', $secretName,
    '--region', $Region,
    '--output', 'json'
  )
  if ($s.ExitCode -ne 0) {
    throw "describe-secret failed: $(if ($s.StdErr) { $s.StdErr } else { $s.StdOut })"
  }
  $secJson = $s.StdOut | ConvertFrom-Json
  $secretArn = $secJson.ARN
}

# Windows PowerShell Start-Process -ArgumentList does not quote --sql values; spaces break argv.
# Use --cli-input-json (temp file) so the full SQL is one payload.
function Invoke-RdsDataExecuteStatementFromJson {
  param(
    [string]$Sql,
    [switch]$OutputJson
  )
  $tmp = Join-Path $env:TEMP ('rds-data-exec-' + [Guid]::NewGuid().ToString('n') + '.json')
  $payload = @{
    resourceArn = $resourceArn
    secretArn   = $secretArn
    database    = $Database
    sql         = $Sql
  }
  $jsonText = $payload | ConvertTo-Json -Compress
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, $jsonText, $utf8NoBom)
  # Windows AWS CLI expects file://C:\path (not file:///C:/...) for paramfile loading
  $fileUri = 'file://' + $tmp
  $argList = @(
    'rds-data', 'execute-statement',
    '--cli-input-json', $fileUri,
    '--region', $Region
  )
  if ($OutputJson) { $argList += @('--output', 'json') }
  try {
    return (Invoke-AwsCli -AwsExe $AwsExe -Arguments $argList)
  } finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}

Write-Host "Executing ALTER TABLE (idempotent)..." -ForegroundColor Cyan
$sql1 = "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb"
$e1 = Invoke-RdsDataExecuteStatementFromJson -Sql $sql1
if ($e1.ExitCode -ne 0) {
  throw "execute-statement (ALTER) failed: $(if ($e1.StdErr) { $e1.StdErr } else { $e1.StdOut })"
}

Write-Host "Executing COMMENT..." -ForegroundColor Cyan
$sql2 = "COMMENT ON COLUMN support_tickets.attachments IS 'Optional attachment URLs or metadata (JSON array)'"
$e2 = Invoke-RdsDataExecuteStatementFromJson -Sql $sql2
if ($e2.ExitCode -ne 0) {
  throw "execute-statement (COMMENT) failed: $(if ($e2.StdErr) { $e2.StdErr } else { $e2.StdOut })"
}

Write-Host "Verifying column..." -ForegroundColor Cyan
$sql3 = "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'attachments'"
$e3 = Invoke-RdsDataExecuteStatementFromJson -Sql $sql3 -OutputJson
if ($e3.ExitCode -ne 0) {
  throw "execute-statement (verify) failed: $(if ($e3.StdErr) { $e3.StdErr } else { $e3.StdOut })"
}
$result = $e3.StdOut | ConvertFrom-Json

if ($result.records -and $result.records.Count -gt 0) {
  Write-Host "OK: column attachments exists on support_tickets." -ForegroundColor Green
} else {
  Write-Host "WARN: verification query returned no rows. Check database name and schema." -ForegroundColor Yellow
}

Write-Host "Done. Retry Submit in Help & Support." -ForegroundColor Green
