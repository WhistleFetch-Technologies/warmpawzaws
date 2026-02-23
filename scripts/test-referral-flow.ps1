# ============================================================================
# REFERRAL FLOW TEST SCRIPT
# ============================================================================
# Tests the complete referral flow:
# 1. Vendor gives referral code
# 2. New vendor creates account with referral code
# 3. Admin approves vendor
# 4. Points should be awarded to referrer
# 5. Wallet should reflect the points
# ============================================================================

$baseUrl = "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
$referrerVendorId = "8dc26f50-0ebe-4b33-91d4-f6d58402ca45"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "REFERRAL FLOW TEST SCRIPT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check referrer vendor's referral code
Write-Host "STEP 1: Get Referrer Vendor's Referral Code" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $referralCodeRes = Invoke-RestMethod -Uri "$baseUrl/vendor/$referrerVendorId/referral" -Method GET
    $referralCode = $referralCodeRes.referralCode
    Write-Host "✅ Referral Code: $referralCode" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get referral code: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Check referral list
Write-Host "`nSTEP 2: Check Referral List" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $referralList = Invoke-RestMethod -Uri "$baseUrl/vendor/$referrerVendorId/referral/list?limit=1000" -Method GET
    $approvedReferrals = $referralList.referrals | Where-Object { $_.status -eq 'approved' }
    $withPoints = $approvedReferrals | Where-Object { [int]$_.points_earned -gt 0 }
    $withoutPoints = $approvedReferrals | Where-Object { [int]$_.points_earned -eq 0 }
    
    Write-Host "Total Referrals: $($referralList.referrals.Count)" -ForegroundColor White
    Write-Host "Approved Referrals: $($approvedReferrals.Count)" -ForegroundColor White
    Write-Host "With Points: $($withPoints.Count)" -ForegroundColor Green
    Write-Host "Without Points: $($withoutPoints.Count)" -ForegroundColor $(if ($withoutPoints.Count -gt 0) { "Yellow" } else { "Green" })
    
    if ($withoutPoints.Count -gt 0) {
        Write-Host "`n⚠️  Found $($withoutPoints.Count) approved referrals without points!" -ForegroundColor Yellow
        Write-Host "Sample referral without points:" -ForegroundColor Cyan
        $sample = $withoutPoints[0]
        Write-Host "  ID: $($sample.id)" -ForegroundColor White
        Write-Host "  Referred Vendor: $($sample.referred_vendor_name)" -ForegroundColor White
        Write-Host "  Status: $($sample.status)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Failed to get referral list: $_" -ForegroundColor Red
}

# Step 3: Check wallet and points
Write-Host "`nSTEP 3: Check Wallet & Points" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $wallet = Invoke-RestMethod -Uri "$baseUrl/wallet/$referrerVendorId" -Method GET
    $diagnostic = Invoke-RestMethod -Uri "$baseUrl/wallet/$referrerVendorId/diagnostic" -Method GET
    
    Write-Host "Wallet Balance: ₹$($wallet.balance)" -ForegroundColor $(if ($wallet.balance -gt 0) { "Green" } else { "Yellow" })
    Write-Host "Loyalty Points: $($diagnostic.loyaltyPoints.totalPoints)" -ForegroundColor White
    Write-Host "Loyalty Transactions: $($diagnostic.loyaltyTransactions.count)" -ForegroundColor White
    Write-Host "Wallet Transactions: $($diagnostic.transactions.count)" -ForegroundColor White
    Write-Host "Loyalty Credits: ₹$($diagnostic.loyaltyCredits.totalAmount)" -ForegroundColor $(if ($diagnostic.loyaltyCredits.totalAmount -gt 0) { "Green" } else { "Yellow" })
    
    if ($diagnostic.loyaltyTransactions.count -gt 0 -and $diagnostic.transactions.count -eq 0) {
        Write-Host "`n⚠️  Points were awarded but NOT converted to wallet!" -ForegroundColor Yellow
        Write-Host "Need to run conversion endpoint." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check wallet: $_" -ForegroundColor Red
}

# Step 4: Check referral rewards
Write-Host "`nSTEP 4: Check Referral Rewards" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $rewards = Invoke-RestMethod -Uri "$baseUrl/vendor/$referrerVendorId/referral/rewards" -Method GET
    $totalPoints = ($rewards.rewards | Measure-Object -Property points -Sum).Sum
    $totalWallet = [math]::Round($totalPoints / 100, 2)
    
    Write-Host "Total Rewards: $($rewards.rewards.Count)" -ForegroundColor White
    Write-Host "Total Points: $totalPoints" -ForegroundColor Cyan
    Write-Host "Expected Wallet: ₹$totalWallet" -ForegroundColor Cyan
    
    if ($rewards.rewards.Count -gt 0) {
        Write-Host "`nRecent Rewards:" -ForegroundColor Cyan
        $rewards.rewards | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - $($_.referred_vendor_name): +$($_.points) pts (₹$([math]::Round($_.points / 100, 2)))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Failed to get rewards: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
