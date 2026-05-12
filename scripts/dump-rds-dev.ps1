#Requires -Version 5.1
<#
  Logical dump of dev RDS (PostgreSQL) using credentials from SSM Parameter Store.
  Prereqs: AWS CLI configured, pg_dump (PostgreSQL client) on PATH or standard install path.
  Network: The RDS instance must be reachable (same VPC, VPN, or public SG rule). A timeout
  from your laptop usually means the DB is private—run this script on a bastion/EC2 in the VPC.
  Usage:
    ./scripts/dump-rds-dev.ps1
    ./scripts/dump-rds-dev.ps1 -Region ap-south-1 -OutDir C:\data\db-dumps
#>
param(
  [string] $Region = 'ap-south-1',
  [string] $Stage = 'dev',
  [string] $OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'db-dumps')
)

$ErrorActionPreference = 'Stop'
$names = @(
  "/warmpawz/$Stage/db/host",
  "/warmpawz/$Stage/db/port",
  "/warmpawz/$Stage/db/name",
  "/warmpawz/$Stage/db/user",
  "/warmpawz/$Stage/db/password"
)

$raw = aws ssm get-parameters --names $names --with-decryption --region $Region --output json
if ($LASTEXITCODE -ne 0) { throw "aws ssm get-parameters failed" }

$resp = $raw | ConvertFrom-Json
if ($resp.InvalidParameters.Count -gt 0) {
  throw "Missing SSM parameters: $($resp.InvalidParameters -join ', ')"
}

function Get-Param($paramName) {
  $p = $resp.Parameters | Where-Object { $_.Name -eq $paramName }
  if (-not $p) { throw "Parameter not found: $paramName" }
  return $p.Value
}

$hostName = Get-Param "/warmpawz/$Stage/db/host"
$port = Get-Param "/warmpawz/$Stage/db/port"
$dbName = Get-Param "/warmpawz/$Stage/db/name"
$user = Get-Param "/warmpawz/$Stage/db/user"
$password = Get-Param "/warmpawz/$Stage/db/password"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $OutDir "warmpawz-$Stage-$stamp.dump"

$candidates = @(
  (Join-Path ${env:ProgramFiles} 'PostgreSQL\18\bin\pg_dump.exe'),
  (Join-Path ${env:ProgramFiles} 'PostgreSQL\17\bin\pg_dump.exe'),
  (Join-Path ${env:ProgramFiles} 'PostgreSQL\16\bin\pg_dump.exe'),
  'pg_dump'
)
$pgDump = $candidates | Where-Object { $_ -eq 'pg_dump' -or (Test-Path $_) } | Select-Object -First 1
if (-not $pgDump) { throw 'pg_dump not found. Install PostgreSQL client tools or add pg_dump to PATH.' }

$env:PGPASSWORD = $password
$env:PGSSLMODE = 'require'
try {
  Write-Host "Dumping to $outFile ..."
  & $pgDump `
    --host=$hostName `
    --port=$port `
    --username=$user `
    --dbname=$dbName `
    --format=custom `
    --no-owner `
    --no-acl `
    --file=$outFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with $LASTEXITCODE" }
  Get-Item $outFile | Format-List FullName, Length, LastWriteTime
  Write-Host 'Done. Restore with: pg_restore --clean --if-exists -d <localdb> <this-file>'
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
