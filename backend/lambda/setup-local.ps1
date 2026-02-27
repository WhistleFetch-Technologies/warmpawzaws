# ============================================================================
# LOCAL SETUP SCRIPT FOR WINDOWS POWERSHELL
# ============================================================================
# This script sets up the backend for local development
# ============================================================================

Write-Host "Setting up Warmpawz Backend for Local Development..." -ForegroundColor Cyan

# Change to lambda directory
Set-Location $PSScriptRoot

# Check if Node.js is installed
Write-Host ""
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = $null
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCheck) {
    Write-Host "[ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
if ($null -eq $nodeVersion) {
    Write-Host "[ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Node.js $nodeVersion found" -ForegroundColor Green

# Check Node version (should be 18+)
$majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($majorVersion -lt 18) {
    Write-Host "[ERROR] Node.js version must be 18 or higher. Current: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Yellow
$depsExist = Test-Path "node_modules"
if ($depsExist -eq $true) {
    Write-Host "[OK] Dependencies installed (node_modules exists)" -ForegroundColor Green
}
if ($depsExist -eq $false) {
    Write-Host "[WARN] Dependencies not found, installing..." -ForegroundColor Yellow
    $npmrcExists = Test-Path ".npmrc"
    if ($npmrcExists -eq $true) {
        Write-Host "  Using .npmrc configuration (legacy-peer-deps enabled)" -ForegroundColor Gray
        npm install
    }
    if ($npmrcExists -eq $false) {
        Write-Host "  Installing with --legacy-peer-deps (resolves serverless version conflict)" -ForegroundColor Gray
        npm install --legacy-peer-deps
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Write-Host "  Try: npm install --legacy-peer-deps" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] Dependencies installed successfully" -ForegroundColor Green
}

# Check if .env.local exists
Write-Host ""
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
$envExists = Test-Path ".env.local"
if ($envExists -eq $true) {
    Write-Host "[OK] .env.local file exists" -ForegroundColor Green
}
if ($envExists -eq $false) {
    Write-Host "[WARN] .env.local not found. Creating from template..." -ForegroundColor Yellow
    $envStillMissing = -not (Test-Path ".env.local")
    if ($envStillMissing -eq $true) {
        Write-Host "[ERROR] Failed to create .env.local" -ForegroundColor Red
        exit 1
    }
}

# Check if dist/handler.js exists
Write-Host ""
Write-Host "Checking build artifacts..." -ForegroundColor Yellow
$buildExists = Test-Path "dist\handler.js"
if ($buildExists -eq $true) {
    Write-Host "[OK] Build exists (dist/handler.js found)" -ForegroundColor Green
}
if ($buildExists -eq $false) {
    Write-Host "[WARN] Build artifacts not found, building handler..." -ForegroundColor Yellow
    npm run build:bundle
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed" -ForegroundColor Red
        Write-Host "  Check for TypeScript or build errors above" -ForegroundColor Yellow
        exit 1
    }
    $buildNowExists = Test-Path "dist\handler.js"
    if ($buildNowExists -eq $true) {
        Write-Host "[OK] Build completed successfully" -ForegroundColor Green
    }
    if ($buildNowExists -eq $false) {
        Write-Host "[ERROR] Build completed but dist/handler.js not found" -ForegroundColor Red
        exit 1
    }
}

# Summary
Write-Host ""
Write-Host "[SUCCESS] Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Review .env.local and update database credentials if needed" -ForegroundColor White
Write-Host "  2. Ensure PostgreSQL is running (if using local database)" -ForegroundColor White
Write-Host "  3. Run: npm run start:local" -ForegroundColor White
Write-Host ""
Write-Host "Server will start on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "For more info, see: LOCAL_TESTING_GUIDE.md" -ForegroundColor Gray
