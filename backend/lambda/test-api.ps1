# ============================================================================
# QUICK API TEST SCRIPT
# ============================================================================
# Tests the local API endpoints
# ============================================================================

$baseUrl = "http://localhost:3000"

Write-Host "=== Testing Local API ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Health Check
Write-Host "[TEST 1] Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Health check passed" -ForegroundColor Green
    Write-Host "  Status: $($content.status)" -ForegroundColor Gray
    if ($content.database) {
        Write-Host "  Database: $($content.database.connected)" -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERROR] Health check failed: $_" -ForegroundColor Red
    Write-Host "  Make sure the server is running: npm run start:local" -ForegroundColor Yellow
    exit 1
}

# Test 2: Send OTP (UAT Mode)
Write-Host ""
Write-Host "[TEST 2] Send OTP (UAT Mode)..." -ForegroundColor Yellow
try {
    $body = @{
        phone = "+919876543210"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$baseUrl/auth/send-otp" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] OTP sent successfully" -ForegroundColor Green
    if ($content.message) {
        Write-Host "  Message: $($content.message)" -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERROR] Send OTP failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Gray
    }
}

# Test 3: Verify OTP (UAT Mode - always "123456")
Write-Host ""
Write-Host "[TEST 3] Verify OTP (UAT Mode - use '123456')..." -ForegroundColor Yellow
try {
    $body = @{
        phone = "+919876543210"
        otp = "123456"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$baseUrl/auth/verify-otp" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] OTP verified successfully" -ForegroundColor Green
    if ($content.token) {
        Write-Host "  Token received: $($content.token.Substring(0, 20))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERROR] Verify OTP failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host "If all tests passed, your local setup is working correctly!" -ForegroundColor Green
