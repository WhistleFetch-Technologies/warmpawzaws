# ============================================================================
# Delete All Vendor and Customer Data from DEV RDS
# ============================================================================
# This script completely removes ALL vendor and customer related data from DEV RDS
# 
# WARNING: This is a destructive operation and cannot be undone!
# WARNING: This script ONLY targets DEV RDS database!
# 
# Deletion Order (handles foreign key constraints):
#   1. Child tables with foreign keys first
#   2. Parent tables last
# 
# Usage:
#   .\scripts\db-crud\delete-all-vendor-customer-data-dev.ps1 [-Force]
#
# Example:
#   .\scripts\db-crud\delete-all-vendor-customer-data-dev.ps1
#   .\scripts\db-crud\delete-all-vendor-customer-data-dev.ps1 -Force
# ============================================================================

param(
    [string]$Region = "ap-south-1",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Red
Write-Host "DELETE ALL VENDOR & CUSTOMER DATA (DEV)" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will permanently delete ALL vendor and customer data from DEV RDS!" -ForegroundColor Yellow
Write-Host "This operation CANNOT be undone!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Target: DEV RDS ONLY" -ForegroundColor Cyan
Write-Host ""

if (-not $Force) {
    Write-Host "This will delete ALL data from the following categories:" -ForegroundColor Yellow
    Write-Host "  - All vendors and vendor-related data" -ForegroundColor White
    Write-Host "  - All customers and customer-related data" -ForegroundColor White
    Write-Host "  - All bookings, payments, orders" -ForegroundColor White
    Write-Host "  - All services, products, reviews" -ForegroundColor White
    Write-Host "  - All staff, prescriptions, packages" -ForegroundColor White
    Write-Host ""
    $confirmation = Read-Host "Type 'DELETE ALL DEV DATA' to confirm"
    if ($confirmation -ne "DELETE ALL DEV DATA") {
        Write-Host "Deletion cancelled." -ForegroundColor Green
        exit 0
    }
}

# Get DEV RDS connection info
$Environment = "dev"
$ClusterInfo = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-$Environment-cluster" --region $Region --output json | ConvertFrom-Json
$RdsArn = $ClusterInfo.DBClusters[0].DBClusterArn
$DbName = $ClusterInfo.DBClusters[0].DatabaseName

# Get credentials - DEV secret
$SecretArn = "arn:aws:secretsmanager:$Region`:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI"

Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Database: $DbName" -ForegroundColor Cyan
Write-Host "RDS ARN: $RdsArn" -ForegroundColor Cyan
Write-Host ""

# Define deletion steps in correct order (child tables first, parent tables last)
$DeletionSteps = @(
    # ===== PAYMENT RELATED (must be deleted first as they reference bookings/orders) =====
    @{ Name = "Payment History"; Sql = "DELETE FROM payment_history"; Optional = $true },
    @{ Name = "Payment Status History"; Sql = "DELETE FROM payment_status_history"; Optional = $true },
    @{ Name = "Payment Retry Log"; Sql = "DELETE FROM payment_retry_log"; Optional = $true },
    @{ Name = "Post Service Payments"; Sql = "DELETE FROM post_service_payments"; Optional = $true },
    @{ Name = "Subscription Payments"; Sql = "DELETE FROM subscription_payments"; Optional = $true },
    @{ Name = "Payments"; Sql = "DELETE FROM payments"; Optional = $false },
    
    # ===== BOOKING RELATED (references services, vendors, customers) =====
    @{ Name = "Booking Staff Assignments"; Sql = "TRUNCATE TABLE booking_staff_assignments CASCADE"; Optional = $true },
    @{ Name = "Booking Services"; Sql = "TRUNCATE TABLE booking_services CASCADE"; Optional = $true },
    @{ Name = "Booking Status History"; Sql = "TRUNCATE TABLE booking_status_history CASCADE"; Optional = $true },
    @{ Name = "Emergency Booking Queue"; Sql = "TRUNCATE TABLE emergency_booking_queue CASCADE"; Optional = $true },
    @{ Name = "Diagnostic Bookings"; Sql = "TRUNCATE TABLE diagnostic_bookings CASCADE"; Optional = $true },
    @{ Name = "Home Service Sessions"; Sql = "TRUNCATE TABLE home_service_sessions CASCADE"; Optional = $true },
    @{ Name = "Bookings"; Sql = "TRUNCATE TABLE bookings CASCADE"; Optional = $false },
    
    # ===== ORDER RELATED (references customers, vendors, products) =====
    @{ Name = "Order Items"; Sql = "DELETE FROM order_items"; Optional = $true },
    @{ Name = "Order Status History"; Sql = "DELETE FROM order_status_history"; Optional = $true },
    @{ Name = "Pharmacy Order Broadcasts"; Sql = "DELETE FROM pharmacy_order_broadcasts"; Optional = $true },
    @{ Name = "Pharmacy Orders"; Sql = "DELETE FROM pharmacy_orders"; Optional = $true },
    @{ Name = "Meal Orders"; Sql = "TRUNCATE TABLE meal_orders CASCADE"; Optional = $true },
    @{ Name = "Medicine Orders"; Sql = "DELETE FROM medicine_orders"; Optional = $true },
    @{ Name = "Orders"; Sql = "DELETE FROM orders"; Optional = $false },
    
    # ===== CART RELATED =====
    @{ Name = "Cart Items"; Sql = "DELETE FROM cart_items"; Optional = $true },
    @{ Name = "Shopping Carts"; Sql = "DELETE FROM shopping_carts"; Optional = $true },
    
    # ===== PACKAGE RELATED =====
    @{ Name = "Package Usage Log"; Sql = "DELETE FROM package_usage_log"; Optional = $true },
    @{ Name = "Package Scheduled Sessions"; Sql = "DELETE FROM package_scheduled_sessions"; Optional = $true },
    @{ Name = "Package Sessions"; Sql = "DELETE FROM package_sessions"; Optional = $true },
    @{ Name = "Package Milestones"; Sql = "DELETE FROM package_milestones"; Optional = $true },
    @{ Name = "Training Package Progress"; Sql = "DELETE FROM training_package_progress"; Optional = $true },
    @{ Name = "Package Purchases"; Sql = "DELETE FROM package_purchases"; Optional = $true },
    
    # ===== REVIEW RELATED =====
    @{ Name = "Review Helpful Votes"; Sql = "DELETE FROM review_helpful_votes"; Optional = $true },
    @{ Name = "Product Reviews"; Sql = "DELETE FROM product_reviews"; Optional = $true },
    @{ Name = "Reviews"; Sql = "DELETE FROM reviews"; Optional = $true },
    
    # ===== PRESCRIPTION RELATED =====
    @{ Name = "Prescription Submissions"; Sql = "DELETE FROM prescription_submissions"; Optional = $true },
    @{ Name = "Prescriptions"; Sql = "DELETE FROM prescriptions"; Optional = $true },
    
    # ===== PRODUCT RELATED =====
    @{ Name = "Product Views"; Sql = "DELETE FROM product_views"; Optional = $true },
    @{ Name = "Product Variation Options"; Sql = "DELETE FROM product_variation_options"; Optional = $true },
    @{ Name = "Product Variations"; Sql = "DELETE FROM product_variations"; Optional = $true },
    @{ Name = "Product Policies"; Sql = "DELETE FROM product_policies"; Optional = $true },
    @{ Name = "Products"; Sql = "DELETE FROM products"; Optional = $false },
    
    # ===== STAFF RELATED =====
    @{ Name = "Staff Slot Services"; Sql = "DELETE FROM staff_slot_services"; Optional = $true },
    @{ Name = "Staff Slot Breaks"; Sql = "DELETE FROM staff_slot_breaks"; Optional = $true },
    @{ Name = "Staff Specializations"; Sql = "DELETE FROM staff_specializations"; Optional = $true },
    @{ Name = "Staff Services"; Sql = "DELETE FROM staff_services"; Optional = $true },
    @{ Name = "Staff Certifications"; Sql = "DELETE FROM staff_certifications"; Optional = $true },
    @{ Name = "Staff Tele Availability"; Sql = "DELETE FROM staff_tele_availability"; Optional = $true },
    @{ Name = "Staff Availability Slots"; Sql = "DELETE FROM staff_availability_slots"; Optional = $true },
    @{ Name = "Staff Availability Per Style"; Sql = "DELETE FROM staff_availability_per_style"; Optional = $true },
    @{ Name = "Staff Availability"; Sql = "DELETE FROM staff_availability"; Optional = $true },
    @{ Name = "Staff Schedules"; Sql = "DELETE FROM staff_schedules"; Optional = $true },
    @{ Name = "Staff"; Sql = "TRUNCATE TABLE staff CASCADE"; Optional = $true },
    
    # ===== SERVICE RELATED =====
    @{ Name = "Service Packages"; Sql = "TRUNCATE TABLE service_packages CASCADE"; Optional = $true },
    @{ Name = "Service Style Mappings"; Sql = "TRUNCATE TABLE service_style_mappings CASCADE"; Optional = $true },
    @{ Name = "Services"; Sql = "TRUNCATE TABLE services CASCADE"; Optional = $false },
    
    # ===== VENDOR RELATED (detailed) =====
    @{ Name = "Vendor Wallet Transactions"; Sql = "DELETE FROM vendor_wallet_transactions"; Optional = $true },
    @{ Name = "Vendor Wallets"; Sql = "DELETE FROM vendor_wallets"; Optional = $true },
    @{ Name = "Vendor Tier Subscriptions"; Sql = "DELETE FROM vendor_tier_subscriptions"; Optional = $true },
    @{ Name = "Vendor Tier Acceptances"; Sql = "DELETE FROM vendor_tier_acceptances"; Optional = $true },
    @{ Name = "Vendor Settlements"; Sql = "DELETE FROM vendor_settlements"; Optional = $true },
    @{ Name = "Vendor Referrals"; Sql = "DELETE FROM vendor_referrals"; Optional = $true },
    @{ Name = "Vendor Loyalty Transactions"; Sql = "DELETE FROM vendor_loyalty_transactions"; Optional = $true },
    @{ Name = "Vendor Loyalty Points"; Sql = "DELETE FROM vendor_loyalty_points"; Optional = $true },
    @{ Name = "Vendor Live Locations"; Sql = "DELETE FROM vendor_live_locations"; Optional = $true },
    @{ Name = "Vendor Earnings"; Sql = "DELETE FROM vendor_earnings"; Optional = $true },
    @{ Name = "Vendor Slot Services"; Sql = "DELETE FROM vendor_slot_services"; Optional = $true },
    @{ Name = "Vendor Slot Breaks"; Sql = "DELETE FROM vendor_slot_breaks"; Optional = $true },
    @{ Name = "Vendor Service Promotions"; Sql = "DELETE FROM vendor_service_promotions"; Optional = $true },
    @{ Name = "Vendor Service Areas"; Sql = "DELETE FROM vendor_service_areas"; Optional = $true },
    @{ Name = "Vendor Services"; Sql = "DELETE FROM vendor_services"; Optional = $true },
    @{ Name = "Vendor Specializations"; Sql = "DELETE FROM vendor_specializations"; Optional = $true },
    @{ Name = "Vendor Promotions"; Sql = "DELETE FROM vendor_promotions"; Optional = $true },
    @{ Name = "Vendor Portfolio"; Sql = "DELETE FROM vendor_portfolio"; Optional = $true },
    @{ Name = "Vendor Policies"; Sql = "DELETE FROM vendor_policies"; Optional = $true },
    @{ Name = "Vendor Payment Rules"; Sql = "DELETE FROM vendor_payment_rules"; Optional = $true },
    @{ Name = "Vendor Onboarding Transitions"; Sql = "DELETE FROM vendor_onboarding_transitions"; Optional = $true },
    @{ Name = "Vendor Onboarding Steps"; Sql = "DELETE FROM vendor_onboarding_steps"; Optional = $true },
    @{ Name = "Vendor Onboarding Comments"; Sql = "DELETE FROM vendor_onboarding_comments"; Optional = $true },
    @{ Name = "Vendor Onboarding Applications"; Sql = "DELETE FROM vendor_onboarding_applications"; Optional = $true },
    @{ Name = "Vendor KYC Verifications"; Sql = "DELETE FROM vendor_kyc_verifications"; Optional = $true },
    @{ Name = "Vendor Holidays Enhanced"; Sql = "DELETE FROM vendor_holidays_enhanced"; Optional = $true },
    @{ Name = "Vendor Holidays"; Sql = "DELETE FROM vendor_holidays"; Optional = $true },
    @{ Name = "Vendor Distance Pricing"; Sql = "DELETE FROM vendor_distance_pricing"; Optional = $true },
    @{ Name = "Vendor Discounts"; Sql = "DELETE FROM vendor_discounts"; Optional = $true },
    @{ Name = "Vendor Documents"; Sql = "DELETE FROM vendor_documents"; Optional = $true },
    @{ Name = "Vendor Declarations"; Sql = "DELETE FROM vendor_declarations"; Optional = $true },
    @{ Name = "Vendor Breaks"; Sql = "DELETE FROM vendor_breaks"; Optional = $true },
    @{ Name = "Vendor Bank Details"; Sql = "DELETE FROM vendor_bank_details"; Optional = $true },
    @{ Name = "Vendor Bank Accounts"; Sql = "DELETE FROM vendor_bank_accounts"; Optional = $true },
    @{ Name = "Vendor Availability V2"; Sql = "DELETE FROM vendor_availability_v2"; Optional = $true },
    @{ Name = "Vendor Availability Full"; Sql = "TRUNCATE TABLE vendor_availability_full CASCADE"; Optional = $true },
    @{ Name = "Vendor Segment Assignments"; Sql = "DELETE FROM vendor_segment_assignments"; Optional = $true },
    @{ Name = "Vendor Setup Completion"; Sql = "DELETE FROM vendor_setup_completion"; Optional = $true },
    @{ Name = "Vendor Settings"; Sql = "DELETE FROM vendor_settings"; Optional = $true },
    @{ Name = "Vendor Stats"; Sql = "DELETE FROM vendor_stats"; Optional = $true },
    @{ Name = "Vendor Support Requests"; Sql = "DELETE FROM vendor_support_requests"; Optional = $true },
    @{ Name = "Featured Vendors"; Sql = "DELETE FROM featured_vendors"; Optional = $true },
    @{ Name = "Vendors"; Sql = "TRUNCATE TABLE vendors CASCADE"; Optional = $false },
    @{ Name = "Vendor Identity"; Sql = "TRUNCATE TABLE vendor_identity CASCADE"; Optional = $false },
    
    # ===== CUSTOMER RELATED =====
    @{ Name = "Customer Wishlist"; Sql = "DELETE FROM customer_wishlist"; Optional = $true },
    @{ Name = "Customer Wallets"; Sql = "TRUNCATE TABLE customer_wallets CASCADE"; Optional = $true },
    @{ Name = "Customer Subscriptions"; Sql = "DELETE FROM customer_subscriptions"; Optional = $true },
    @{ Name = "Customer Segment Assignments"; Sql = "DELETE FROM customer_segment_assignments"; Optional = $true },
    @{ Name = "Customer Search History"; Sql = "DELETE FROM customer_search_history"; Optional = $true },
    @{ Name = "Customer Referrals"; Sql = "DELETE FROM customer_referrals"; Optional = $true },
    @{ Name = "Customer Questionnaires"; Sql = "DELETE FROM customer_questionnaires"; Optional = $true },
    @{ Name = "Customer Provider History"; Sql = "DELETE FROM customer_provider_history"; Optional = $true },
    @{ Name = "Customer Profile Completion"; Sql = "DELETE FROM customer_profile_completion"; Optional = $true },
    @{ Name = "Customer Preferences"; Sql = "DELETE FROM customer_preferences"; Optional = $true },
    @{ Name = "Customer Notification Settings"; Sql = "DELETE FROM customer_notification_settings"; Optional = $true },
    @{ Name = "Customer Loyalty Points"; Sql = "DELETE FROM customer_loyalty_points"; Optional = $true },
    @{ Name = "Customer Favorites"; Sql = "DELETE FROM customer_favorites"; Optional = $true },
    @{ Name = "Customer Addresses"; Sql = "DELETE FROM customer_addresses"; Optional = $true },
    @{ Name = "Customers"; Sql = "TRUNCATE TABLE customers CASCADE"; Optional = $false },
    @{ Name = "Customer Identity"; Sql = "TRUNCATE TABLE customer_identity CASCADE"; Optional = $false },
    
    # ===== USER RELATED =====
    @{ Name = "User Subscriptions"; Sql = "DELETE FROM user_subscriptions"; Optional = $true },
    @{ Name = "User Roles"; Sql = "DELETE FROM user_roles"; Optional = $true },
    @{ Name = "User Devices"; Sql = "DELETE FROM user_devices"; Optional = $true }
)

Write-Host "Starting deletion of ALL vendor and customer data..." -ForegroundColor Yellow
Write-Host "Total steps: $($DeletionSteps.Count)" -ForegroundColor Cyan
Write-Host "Note: Using TRUNCATE CASCADE for better performance (bypasses triggers)" -ForegroundColor Gray
Write-Host ""

$DeletedCounts = @{}
$FailedSteps = @()
$SkippedSteps = @()

foreach ($step in $DeletionSteps) {
    Write-Host "Deleting: $($step.Name)..." -ForegroundColor Yellow -NoNewline
    
    $success = $false
    $errorMsg = ""
    
    try {
        $result = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $step.Sql --region $Region --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $resultObj = $result | ConvertFrom-Json
            # TRUNCATE doesn't return numberOfRecordsUpdated, so we'll show success
            $affectedRows = if ($resultObj.numberOfRecordsUpdated) { $resultObj.numberOfRecordsUpdated } else { "completed" }
            $DeletedCounts[$step.Name] = $affectedRows
            Write-Host " SUCCESS" -ForegroundColor Green
            $success = $true
        } else {
            $errorMsg = $result.ToString()
        }
    } catch {
        $errorMsg = $_.Exception.Message
    }
    
    # If TRUNCATE failed and it's not an optional table, try DELETE as fallback
    if (-not $success) {
        # Check if it's a "table does not exist" error for optional steps
        if ($step.Optional -and $errorMsg -match "does not exist") {
            Write-Host " SKIPPED (table does not exist)" -ForegroundColor Gray
            $SkippedSteps += $step.Name
        } elseif ($step.Sql -match "TRUNCATE") {
            # Try DELETE as fallback for TRUNCATE failures
            $deleteSql = $step.Sql -replace "TRUNCATE TABLE (.+) CASCADE", "DELETE FROM `$1"
            Write-Host " (trying DELETE fallback...)" -ForegroundColor Yellow -NoNewline
            try {
                $deleteResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $deleteSql --region $Region --output json 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $deleteObj = $deleteResult | ConvertFrom-Json
                    $affectedRows = if ($deleteObj.numberOfRecordsUpdated) { $deleteObj.numberOfRecordsUpdated } else { 0 }
                    $DeletedCounts[$step.Name] = $affectedRows
                    Write-Host " SUCCESS (via DELETE): $affectedRows records" -ForegroundColor Green
                    $success = $true
                } else {
                    Write-Host " FAILED" -ForegroundColor Red
                    Write-Host "  Error: $errorMsg" -ForegroundColor Red
                    $FailedSteps += @{ Name = $step.Name; Error = $errorMsg }
                }
            } catch {
                Write-Host " FAILED" -ForegroundColor Red
                Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
                $FailedSteps += @{ Name = $step.Name; Error = $_.Exception.Message }
            }
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "  Error: $errorMsg" -ForegroundColor Red
            $FailedSteps += @{ Name = $step.Name; Error = $errorMsg }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DELETION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$totalDeleted = 0
foreach ($key in $DeletedCounts.Keys) {
    $count = $DeletedCounts[$key]
    if ($count -is [int]) {
        $totalDeleted += $count
        if ($count -gt 0) {
            Write-Host "$key : $count records" -ForegroundColor White
        }
    } else {
        # TRUNCATE was used (shows "completed")
        Write-Host "$key : completed (TRUNCATE)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Total records deleted: $totalDeleted" -ForegroundColor Green

if ($SkippedSteps.Count -gt 0) {
    Write-Host ""
    Write-Host "Skipped (optional tables that don't exist): $($SkippedSteps.Count)" -ForegroundColor Gray
}

if ($FailedSteps.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed steps: $($FailedSteps.Count)" -ForegroundColor Red
    foreach ($failed in $FailedSteps) {
        Write-Host "  - $($failed.Name)" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "All deletion steps completed successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verifying deletion..." -ForegroundColor Cyan

# Verify key tables are empty
$VerifyTables = @("vendors", "vendor_identity", "customers", "customer_identity", "bookings", "orders", "payments", "services", "products")
$AllEmpty = $true

foreach ($table in $VerifyTables) {
    try {
        $countSql = "SELECT COUNT(*) FROM $table"
        $countResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $countSql --region $Region --output json | ConvertFrom-Json
        $count = [int]$countResult.records[0][0].longValue
        if ($count -eq 0) {
            Write-Host "  [OK] $table : 0 records" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $table : $count records (NOT EMPTY!)" -ForegroundColor Red
            $AllEmpty = $false
        }
    } catch {
        Write-Host "  ? $table : Could not verify" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($AllEmpty) {
    Write-Host "SUCCESS: All vendor and customer data has been deleted from DEV RDS!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Some tables still contain data. Please review the output above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Script completed." -ForegroundColor Cyan
