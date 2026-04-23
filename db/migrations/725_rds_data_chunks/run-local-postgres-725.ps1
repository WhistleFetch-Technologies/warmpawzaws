# Runs Allyticas migration 725 chunks against local PostgreSQL (one statement file per chunk).
#
# Prerequisites: psql on PATH; Postgres listening (e.g. local install or Docker mapping 5432).
#
# Defaults match a typical local Postgres + database `warmpawz`:
#   Host localhost, DB warmpawz, user postgres, password postgres
# Docker Compose in this repo uses user warmpawz/warmpawz — override with -PgUser/-PgPassword if needed.
#
# Usage:
#   .\run-local-postgres-725.ps1
#   .\run-local-postgres-725.ps1 -PgUser warmpawz -PgPassword warmpawz

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

Write-Host "=== Migration 725 (local Postgres) ===" -ForegroundColor Cyan
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
& psql -h $PgHost -p $PgPort -U $PgUser -d $PgDatabase -c "\dt analytics_*"
Write-Host ""
Write-Host "Migration 725 applied successfully on local Postgres." -ForegroundColor Green
