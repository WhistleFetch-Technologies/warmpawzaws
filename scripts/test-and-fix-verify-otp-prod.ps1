# Test verify-otp endpoint, check logs, and deploy fixes
# Usage: .\scripts\test-and-fix-verify-otp-prod.ps1

$ErrorActionPreference = "Stop"

Write-Host "🧪 Testing verify-otp endpoint in production..." -ForegroundColor Blue
Write-Host ""

$API_ENDPOINT = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
$REGION = "ap-south-1"
$LOG_GROUP = "/aws/lambda/warmpawz-prod-api-handler"
$LAMBDA_FUNCTION = "warmpawz-prod-api-handler"

# Step 1: Test sending OTP first
Write-Host "Step 1: Testing send-otp..." -ForegroundColor Yellow
$testPhone = Read-Host "Enter phone number to test (e.g., +919326977987)"

try {
    $sendOtpBody = @{
        phone = $testPhone
        role = "vendor"
    } | ConvertTo-Json

    Write-Host "📤 Sending OTP request..." -ForegroundColor Blue
    $sendOtpResponse = Invoke-RestMethod -Uri "$API_ENDPOINT/auth/send-otp" `
        -Method POST `
        -Body $sendOtpBody `
        -ContentType "application/json" `
        -ErrorAction Stop

    Write-Host "✅ OTP sent successfully!" -ForegroundColor Green
    Write-Host ($sendOtpResponse | ConvertTo-Json -Depth 3)
    
    # In production, you'll need to get the OTP from SMS
    # For testing, if UAT_MODE is false, you need the actual OTP
    Write-Host ""
    Write-Host "⚠️  In production, check your SMS for the OTP code" -ForegroundColor Yellow
    $testOtp = Read-Host "Enter the OTP code you received"
    
} catch {
    Write-Host "❌ Error sending OTP:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

# Step 2: Test verify-otp
Write-Host ""
Write-Host "Step 2: Testing verify-otp..." -ForegroundColor Yellow

try {
    $verifyBody = @{
        phone = $testPhone
        otp = $testOtp
        role = "vendor"
    } | ConvertTo-Json

    Write-Host "📤 Sending verify-otp request..." -ForegroundColor Blue
    $verifyResponse = Invoke-RestMethod -Uri "$API_ENDPOINT/auth/verify-otp" `
        -Method POST `
        -Body $verifyBody `
        -ContentType "application/json" `
        -ErrorAction Stop

    Write-Host "✅ Verify OTP successful!" -ForegroundColor Green
    Write-Host ($verifyResponse | ConvertTo-Json -Depth 5)
    
    Write-Host ""
    Write-Host "✅✅✅ SUCCESS! verify-otp is working!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Verify OTP failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorDetails) {
            Write-Host "Error details:" -ForegroundColor Yellow
            Write-Host ($errorDetails | ConvertTo-Json -Depth 3) -ForegroundColor Gray
        }
    }
    
    # Step 3: Check CloudWatch logs
    Write-Host ""
    Write-Host "Step 3: Checking CloudWatch logs..." -ForegroundColor Yellow
    
    Write-Host "📊 Fetching recent ERROR logs..." -ForegroundColor Blue
    $errorLogs = aws logs filter-log-events `
        --log-group-name $LOG_GROUP `
        --region $REGION `
        --filter-pattern "ERROR" `
        --max-items 20 `
        --output json | ConvertFrom-Json
    
    if ($errorLogs.events -and $errorLogs.events.Count -gt 0) {
        Write-Host "Recent errors:" -ForegroundColor Yellow
        $errorLogs.events | Select-Object -Last 10 | ForEach-Object {
            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "  [$timestamp] $($_.message)" -ForegroundColor Gray
        }
    }
    
    # Check for AUTH/verify-otp specific logs
    Write-Host ""
    Write-Host "📊 Fetching AUTH/verify-otp logs..." -ForegroundColor Blue
    $authLogs = aws logs filter-log-events `
        --log-group-name $LOG_GROUP `
        --region $REGION `
        --filter-pattern "AUTH OR verify-otp OR timeout" `
        --max-items 30 `
        --output json | ConvertFrom-Json
    
    if ($authLogs.events -and $authLogs.events.Count -gt 0) {
        Write-Host "Recent AUTH logs:" -ForegroundColor Yellow
        $authLogs.events | Select-Object -Last 15 | ForEach-Object {
            if ($_.message -like "*verify-otp*" -or $_.message -like "*Production Mode*" -or $_.message -like "*timeout*" -or $_.message -like "*ERROR*") {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
                Write-Host "  [$timestamp] $($_.message)" -ForegroundColor Gray
            }
        }
    }
    
    # Check for database errors
    Write-Host ""
    Write-Host "📊 Checking for database errors..." -ForegroundColor Blue
    $dbLogs = aws logs filter-log-events `
        --log-group-name $LOG_GROUP `
        --region $REGION `
        --filter-pattern "column does not exist OR relation does not exist OR otp_tokens" `
        --max-items 20 `
        --output json | ConvertFrom-Json
    
    if ($dbLogs.events -and $dbLogs.events.Count -gt 0) {
        Write-Host "⚠️  Database errors found! The otp_tokens table may be missing or have missing columns." -ForegroundColor Yellow
        Write-Host "Recent database errors:" -ForegroundColor Yellow
        $dbLogs.events | Select-Object -Last 10 | ForEach-Object {
            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "  [$timestamp] $($_.message)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "🔧 To fix: Run the migration script:" -ForegroundColor Yellow
        Write-Host "   ENVIRONMENT=prod node scripts/run-migration-rds-node.js scripts/ensure-otp-tokens-table-prod.sql" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   Or manually run the SQL in scripts/ensure-otp-tokens-table-prod.sql" -ForegroundColor Cyan
    }
    
    exit 1
}

Write-Host ""
Write-Host "✅ Test complete!" -ForegroundColor Green
