# Runs product error case migration 726 chunks against local PostgreSQL.
# Apply after 725; requires `analytics_events` and `admins` (from prior migrations).
#
# For Aurora dev/prod via AWS RDS Data API, use .\run-rds-data-api.ps1 -Environment dev|prod
#
# Usage:
#   .\run-local-postgres-726.ps1
#   .\run-local-postgres-726.ps1 -PgUser warmpawz -PgPassword warmpawz

param(
  [string]$PgHost = 'localhost',
  [int]$PgPort = 5432,
  [string]$PgUser = 'postgres',
  [string]$PgPassword = 'postgres',
  [string]$PgDatabase = 'warmpawz'
)

$ErrorActionPreference = 'Stop'
$env:PGPASSWORD = $PgPassword

$chunkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = Get-ChildItem -Path $chunkDir -Filter '*.sql' | Sort-Object Name

Write-Host "=== Migration 726 (error case chunks, local Postgres) ===" -ForegroundColor Cyan
Write-Host "Host: $PgHost:$PgPort  Database: $PgDatabase  User: $PgUser"
Write-Host ""

$i = 0
foreach ($file in $files) {
  $i++
  Write-Host "[$i/$($files.Count)] $($file.Name)..." -NoNewline
  & psql -h $PgHost -p $PgPort -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -f $file.FullName 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host " FAILED" -ForegroundColor Red
    & psql -h $PgHost -p $PgPort -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -f $file.FullName
    exit $LASTEXITCODE
  }
  Write-Host " OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "Tables:" -ForegroundColor Cyan
& psql -h $PgHost -p $PgPort -U $PgUser -d $PgDatabase -c "\dt product_error_cases" 2>$null
& psql -h $PgHost -p $PgPort -U $PgUser -d $PgDatabase -c "\dt error_case_occurrences" 2>$null
Write-Host ""
Write-Host "Migration 726 applied successfully on local Postgres." -ForegroundColor Green
