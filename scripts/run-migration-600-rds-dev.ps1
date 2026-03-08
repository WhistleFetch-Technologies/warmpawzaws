# ============================================================================
# Script to run migration 600 (available_for_instant_tele) on RDS Dev
# ============================================================================
# 
# This script connects to AWS RDS Dev and runs the migration to add
# available_for_instant_tele column to vendors table.
#
# Prerequisites:
# - AWS CLI configured with appropriate credentials
# - psql client installed (can be installed via: choco install postgresql)
# - Network access to RDS (via VPN, EC2 bastion, or direct if in VPC)
#
# Usage:
#   .\scripts\run-migration-600-rds-dev.ps1
#
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Running Migration 600: Add available_for_instant_tele to vendors table" -ForegroundColor Cyan
Write-Host "Target: RDS Dev (warmpawz-dev-cluster)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Get RDS credentials from AWS Secrets Manager
Write-Host "📋 Fetching RDS credentials from AWS Secrets Manager..." -ForegroundColor Yellow
$secretJson = aws secretsmanager get-secret-value `
  --secret-id warmpawz-dev-rds-master-20260106164510791100000002 `
  --query SecretString `
  --output text | ConvertFrom-Json

$dbHost = $secretJson.host
$dbPort = $secretJson.port
$dbName = $secretJson.dbname
$dbUser = $secretJson.username
$dbPassword = $secretJson.password

Write-Host "✅ Credentials retrieved" -ForegroundColor Green
Write-Host "   Host: $dbHost"
Write-Host "   Port: $dbPort"
Write-Host "   Database: $dbName"
Write-Host "   User: $dbUser"
Write-Host ""

# Check if column already exists
Write-Host "🔍 Checking if column 'available_for_instant_tele' exists..." -ForegroundColor Yellow
$env:PGPASSWORD = $dbPassword
$columnExists = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c `
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'available_for_instant_tele';"

$columnExists = $columnExists.Trim()

if ($columnExists -eq "1") {
    Write-Host "✅ Column 'available_for_instant_tele' already exists in vendors table" -ForegroundColor Green
    Write-Host "   Migration 600 has already been applied. Skipping..." -ForegroundColor Yellow
    exit 0
}

Write-Host "⚠️  Column 'available_for_instant_tele' does not exist. Running migration..." -ForegroundColor Yellow

# Get the migration file path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationFile = Join-Path $scriptDir "..\db\migrations\600_add_vendor_available_for_instant_tele.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found at: $migrationFile" -ForegroundColor Red
    exit 1
}

# Run the migration
Write-Host "🚀 Executing migration 600..." -ForegroundColor Yellow
$env:PGPASSWORD = $dbPassword
psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration 600 completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifying column was added..." -ForegroundColor Yellow
    $env:PGPASSWORD = $dbPassword
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c `
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'available_for_instant_tele';"
} else {
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Migration 600 completed successfully!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
