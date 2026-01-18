# ============================================================================
# LOCAL SETUP SCRIPT FOR WINDOWS POWERSHELL
# ============================================================================
# This script sets up the backend for local development
# ============================================================================

Write-Host "🚀 Setting up Warmpawz Backend for Local Development..." -ForegroundColor Cyan

# Change to lambda directory
Set-Location $PSScriptRoot

# Check if Node.js is installed
Write-Host "`n📦 Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Node version (should be 18+)
$majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($majorVersion -lt 18) {
    Write-Host "✗ Node.js version must be 18 or higher. Current: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  node_modules already exists, skipping npm install" -ForegroundColor Gray
} else {
    # Check if .npmrc exists (for legacy-peer-deps)
    if (Test-Path ".npmrc") {
        Write-Host "  Using .npmrc configuration (legacy-peer-deps enabled)" -ForegroundColor Gray
        npm install
    } else {
        Write-Host "  Installing with --legacy-peer-deps (resolves serverless version conflict)" -ForegroundColor Gray
        npm install --legacy-peer-deps
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        Write-Host "  Try: npm install --legacy-peer-deps" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
}

# Check if .env.local exists
Write-Host "`n🔧 Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "✓ .env.local file exists" -ForegroundColor Green
} else {
    Write-Host "⚠ .env.local not found. Creating from template..." -ForegroundColor Yellow
    # The .env.local file should already be created
    if (-not (Test-Path ".env.local")) {
        Write-Host "✗ Failed to create .env.local" -ForegroundColor Red
        exit 1
    }
}

# Check if dist/handler.js exists
Write-Host "`n🔨 Checking build artifacts..." -ForegroundColor Yellow
if (Test-Path "dist\handler.js") {
    Write-Host "✓ dist/handler.js exists" -ForegroundColor Green
} else {
    Write-Host "⚠ Building handler..." -ForegroundColor Yellow
    npm run build:bundle
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Build completed" -ForegroundColor Green
}

# Summary
Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Review .env.local and update database credentials if needed" -ForegroundColor White
Write-Host "  2. Ensure PostgreSQL is running (if using local database)" -ForegroundColor White
Write-Host "  3. Run: npm run start:local" -ForegroundColor White
Write-Host "`n🌐 Server will start on: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`n📚 For more info, see: LOCAL_TESTING_GUIDE.md" -ForegroundColor Gray
