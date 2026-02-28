# ============================================================================
# TEST LOCAL SETUP SCRIPT
# ============================================================================
# Tests the local backend setup with local PostgreSQL
# ============================================================================

Write-Host "=== Testing Local Backend Setup ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check PostgreSQL Connection
Write-Host "[TEST 1] Checking PostgreSQL connection..." -ForegroundColor Yellow
$env:PGPASSWORD = 'postgres'
$pgTest = psql -U postgres -h localhost -d postgres -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] PostgreSQL is running and accessible" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Cannot connect to PostgreSQL" -ForegroundColor Red
    Write-Host "  Make sure PostgreSQL is running on localhost:5432" -ForegroundColor Yellow
    exit 1
}

# Test 2: Check if warmpawz database exists
Write-Host ""
Write-Host "[TEST 2] Checking if warmpawz database exists..." -ForegroundColor Yellow
$dbCheck = psql -U postgres -h localhost -d postgres -c "\l" 2>&1 | Select-String -Pattern "^\s+warmpawz\s"
if ($dbCheck) {
    Write-Host "[OK] Database 'warmpawz' exists" -ForegroundColor Green
} else {
    Write-Host "[WARN] Database 'warmpawz' does not exist" -ForegroundColor Yellow
    Write-Host "  Creating database..." -ForegroundColor Gray
    psql -U postgres -h localhost -d postgres -c "CREATE DATABASE warmpawz;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database 'warmpawz' created" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to create database" -ForegroundColor Red
    }
}

# Test 3: Test database connection with credentials from .env.local
Write-Host ""
Write-Host "[TEST 3] Testing connection with .env.local credentials..." -ForegroundColor Yellow
$dbTest = psql -U postgres -h localhost -d warmpawz -c "SELECT current_database(), current_user;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Successfully connected to warmpawz database" -ForegroundColor Green
    $dbTest | Select-String -Pattern "warmpawz|postgres" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "[ERROR] Cannot connect to warmpawz database" -ForegroundColor Red
    Write-Host "  Check your .env.local configuration" -ForegroundColor Yellow
}

# Test 4: Check if dist/handler.js exists
Write-Host ""
Write-Host "[TEST 4] Checking build artifacts..." -ForegroundColor Yellow
if (Test-Path "dist\handler.js") {
    Write-Host "[OK] Build artifacts exist" -ForegroundColor Green
} else {
    Write-Host "[WARN] Build artifacts not found" -ForegroundColor Yellow
    Write-Host "  Run: npm run build:bundle" -ForegroundColor Gray
}

# Test 5: Check .env.local file
Write-Host ""
Write-Host "[TEST 5] Checking .env.local configuration..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "[OK] .env.local file exists" -ForegroundColor Green
    $dbHost = (Get-Content .env.local | Select-String -Pattern "^DB_HOST=").ToString().Split('=')[1]
    $dbUser = (Get-Content .env.local | Select-String -Pattern "^DB_USER=").ToString().Split('=')[1]
    Write-Host "  DB_HOST: $dbHost" -ForegroundColor Gray
    Write-Host "  DB_USER: $dbUser" -ForegroundColor Gray
    if ($dbHost -eq "localhost" -and $dbUser -eq "postgres") {
        Write-Host "[OK] Configuration is set for local PostgreSQL" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Configuration may not be set for local PostgreSQL" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERROR] .env.local file not found" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "If all tests passed, you can now run:" -ForegroundColor White
Write-Host "  npm run start:local" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then test the health endpoint:" -ForegroundColor White
Write-Host "  curl http://localhost:3000/health" -ForegroundColor Yellow
Write-Host "  or" -ForegroundColor Gray
Write-Host "  Invoke-WebRequest -Uri http://localhost:3000/health" -ForegroundColor Yellow
