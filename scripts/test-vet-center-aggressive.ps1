# Aggressive testing script for vet center discovery
# Tests multiple variations and monitors CloudWatch logs

$ErrorActionPreference = "Stop"

$API_BASE = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
$VENDOR_ID = "863d5f9f-2cec-4792-9ea8-64c98059061c"
$LAMBDA_FUNCTION = "warmpawz-prod-api-handler"
$AWS_REGION = "ap-south-1"

Write-Host "🧪 AGGRESSIVE VET CENTER DISCOVERY TESTING" -ForegroundColor Cyan
Write-Host "=" * 80
Write-Host ""

$testCount = 0
$passCount = 0
$failCount = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [bool]$ExpectVendor = $true
    )
    
    $global:testCount++
    Write-Host "[TEST $testCount] $Name" -ForegroundColor Yellow
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 30
        $data = $response.Content | ConvertFrom-Json
        
        $vendorFound = $false
        if ($data.vendors -and $data.vendors.Count -gt 0) {
            $vendorFound = $data.vendors | Where-Object { $_.id -eq $VENDOR_ID -or $_.vendorId -eq $VENDOR_ID } | Measure-Object | Select-Object -ExpandProperty Count -gt 0
        }
        
        if ($vendorFound -eq $ExpectVendor) {
            $global:passCount++
            Write-Host "   ✅ PASS - Found $($data.vendors.Count) vendor(s), expected vendor: $($vendorFound -eq $true)" -ForegroundColor Green
            if ($vendorFound) {
                $vendor = $data.vendors | Where-Object { $_.id -eq $VENDOR_ID -or $_.vendorId -eq $VENDOR_ID } | Select-Object -First 1
                Write-Host "      Vendor: $($vendor.businessName) ($($vendor.id))" -ForegroundColor Green
            }
            return $true
        } else {
            $global:failCount++
            Write-Host "   ❌ FAIL - Found $($data.vendors.Count) vendor(s), expected vendor: $($vendorFound -eq $true)" -ForegroundColor Red
            if ($data.vendors.Count -gt 0) {
                Write-Host "      Returned vendors:" -ForegroundColor Yellow
                $data.vendors | Select-Object -First 3 | ForEach-Object {
                    Write-Host "        - $($_.id): $($_.businessName)" -ForegroundColor Gray
                }
            }
            return $false
        }
    } catch {
        $global:failCount++
        Write-Host "   ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 500
}

# Test variations
Write-Host "📋 Running Test Suite..." -ForegroundColor Blue
Write-Host ""

# Basic test
$url1 = "$API_BASE/customer/discover-services?category=vet&serviceStyle=at_center"
Test-Endpoint -Name "Basic: category=vet&serviceStyle=at_center" -Url $url1

# With roleId
$url2 = "$API_BASE/customer/discover-services?category=vet&serviceStyle=at_center&roleId=vet_clinic"
Test-Endpoint -Name "With roleId: vet_clinic" -Url $url2

# With roleId only
$url3 = "$API_BASE/customer/discover-services?roleId=vet_clinic&serviceStyle=at_center"
Test-Endpoint -Name "roleId only: vet_clinic" -Url $url3

# Different category variations
$url4 = "$API_BASE/customer/discover-services?category=vet_clinic&serviceStyle=at_center"
Test-Endpoint -Name "Category: vet_clinic" -Url $url4

# No serviceStyle (should still work)
Test-Endpoint -Name "No serviceStyle" `
    -Url "$API_BASE/customer/discover-services?category=vet" `
    -ExpectVendor $false

# With sortBy
$url5 = "$API_BASE/customer/discover-services?category=vet&serviceStyle=at_center&sortBy=rating"
Test-Endpoint -Name "With sortBy=rating" -Url $url5

# With location (Bangalore)
$url6 = "$API_BASE/customer/discover-services?category=vet&serviceStyle=at_center&location=Bangalore"
Test-Endpoint -Name "With location=Bangalore" -Url $url6

# Direct vendor services check
Write-Host ""
Write-Host "[VERIFICATION] Checking vendor services directly..." -ForegroundColor Cyan
try {
    $servicesUrl = "$API_BASE/customer/vendor/$VENDOR_ID/services"
    $servicesResponse = Invoke-WebRequest -Uri $servicesUrl -Method GET -UseBasicParsing
    $servicesData = $servicesResponse.Content | ConvertFrom-Json
    
    $atCenterServices = $servicesData.services | Where-Object { 
        $style = ($_.serviceStyle -or $_.service_style -or "").ToLower()
        $style -in @('at_center', 'at_vendor', 'at_clinic', 'center', 'clinic')
    }
    
    Write-Host "   ✅ Vendor has $($atCenterServices.Count) at_center service(s)" -ForegroundColor Green
    $atCenterServices | ForEach-Object {
        Write-Host "      - $($_.name) (style: $($_.serviceStyle), published: $($_.publishStatus))" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error checking vendor services: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "=" * 80
Write-Host "📊 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "   Total Tests: $testCount"
Write-Host "   ✅ Passed: $passCount" -ForegroundColor Green
Write-Host "   ❌ Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Check CloudWatch logs for details:" -ForegroundColor Yellow
    Write-Host "   aws logs tail /aws/lambda/$LAMBDA_FUNCTION --follow --region $AWS_REGION" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Look for these log entries:" -ForegroundColor Yellow
    Write-Host "   - [discover-services] at_center: DEBUG vendor check" -ForegroundColor Gray
    Write-Host "   - [discover-services] at_center: ❌ DEBUG vendor NOT in query results" -ForegroundColor Gray
    Write-Host "   - [discover-services] at_center: ❌ DEBUG vendor filtered by roleConfigAllowsStyle" -ForegroundColor Gray
}

Write-Host ""
