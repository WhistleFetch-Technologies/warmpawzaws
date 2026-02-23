# Test verify-otp endpoint and monitor CloudWatch logs
# Usage: .\scripts\test-verify-otp-prod.ps1

$ErrorActionPreference = "Stop"

Write-Host "🧪 Testing verify-otp endpoint in production..." -ForegroundColor Blue
Write-Host ""

$API_ENDPOINT = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
$REGION = "ap-south-1"
$LOG_GROUP = "/aws/lambda/warmpawz-prod-api-handler"

# Test phone and OTP (you'll need to send OTP first)
$TEST_PHONE = Read-Host "Enter phone number to test (e.g., +919326977987)"
$TEST_OTP = Read-Host "Enter OTP code"

Write-Host ""
Write-Host "📤 Sending verify-otp request..." -ForegroundColor Blue

try {
    $body = @{
        phone = $TEST_PHONE
        otp = $TEST_OTP
        role = "vendor"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_ENDPOINT/auth/verify-otp" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -ErrorAction Stop

    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
    
    # Check CloudWatch logs
    Write-Host ""
    Write-Host "📊 Checking CloudWatch logs for errors..." -ForegroundColor Blue
    
    $logs = aws logs filter-log-events `
        --log-group-name $LOG_GROUP `
        --region $REGION `
        --filter-pattern "ERROR" `
        --max-items 20 `
        --output json | ConvertFrom-Json
    
    if ($logs.events) {
        Write-Host "Recent errors:" -ForegroundColor Yellow
        $logs.events | Select-Object -Last 10 | ForEach-Object {
            Write-Host "  $($_.message)" -ForegroundColor Gray
        }
    }
    
    # Check for AUTH logs
    Write-Host ""
    Write-Host "📊 Checking AUTH logs..." -ForegroundColor Blue
    
    $authLogs = aws logs filter-log-events `
        --log-group-name $LOG_GROUP `
        --region $REGION `
        --filter-pattern "AUTH" `
        --max-items 30 `
        --output json | ConvertFrom-Json
    
    if ($authLogs.events) {
        Write-Host "Recent AUTH logs:" -ForegroundColor Yellow
        $authLogs.events | Select-Object -Last 15 | ForEach-Object {
            if ($_.message -like "*verify-otp*" -or $_.message -like "*Production Mode*" -or $_.message -like "*timeout*") {
                Write-Host "  $($_.message)" -ForegroundColor Gray
            }
        }
    }
}

Write-Host ""
Write-Host "✅ Test complete" -ForegroundColor Green
