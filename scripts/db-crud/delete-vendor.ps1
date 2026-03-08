# ============================================================================
# Delete Vendor Script
# ============================================================================
# This script completely removes a SINGLE vendor and all related data from the database
# 
# WARNING: This is a destructive operation and cannot be undone!
# 
# Deletion Order (handles foreign key constraints):
#   1. Payments (references bookings)
#   2. Bookings (references services and vendor)
#   3. Vendor Services, Specializations, Service Areas, Staff
#   4. Services (must be deleted after bookings)
#   5. Products (references vendor)
#   6. Reviews, Package Purchases, Prescriptions
#   7. Vendor (main record)
#   8. Vendor Onboarding Applications
#   9. Vendor Identity
# 
# Usage:
#   .\scripts\db-crud\delete-vendor.ps1 -VendorId <vendor-uuid> [-Environment prod] [-Force]
#
# Example:
#   .\scripts\db-crud\delete-vendor.ps1 -VendorId "666f0a18-8b01-40f3-81a5-1705a53c9a40"
#   .\scripts\db-crud\delete-vendor.ps1 -VendorId "666f0a18-8b01-40f3-81a5-1705a53c9a40" -Force
# 
# Note: The script accepts either vendors.id or vendor_identity.id and will resolve
#       to the correct vendors.id for deletion.
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$VendorId,
    
    [string]$Environment = "prod",
    [string]$Region = "ap-south-1",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Red
Write-Host "DELETE VENDOR SCRIPT" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will permanently delete the vendor and ALL related data!" -ForegroundColor Yellow
Write-Host "This operation CANNOT be undone!" -ForegroundColor Yellow
Write-Host ""

# Get RDS connection info
$ClusterInfo = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-$Environment-cluster" --region $Region --output json | ConvertFrom-Json
$RdsArn = $ClusterInfo.DBClusters[0].DBClusterArn
$DbName = $ClusterInfo.DBClusters[0].DatabaseName

# Get credentials
$SecretName = "warmpawz-$Environment-rds-master-20260207201049162400000001"
if ($Environment -eq "prod") {
    $SecretName = "warmpawz-prod-rds-master-20260207201049162400000001"
}
$SecretArn = "arn:aws:secretsmanager:$Region`:057442119249:secret:$SecretName"

Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Vendor ID: $VendorId" -ForegroundColor Cyan
Write-Host "Database: $DbName" -ForegroundColor Cyan
Write-Host ""

# Verify vendor exists and get info
# First try as vendors.id, then try as vendor_identity.id
Write-Host "Verifying vendor exists..." -ForegroundColor Yellow
$VerifySql = "SELECT id, business_name, owner_name, phone, email, status, created_at FROM vendors WHERE id = '$VendorId'"
$VendorInfo = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifySql --region $Region --output json | ConvertFrom-Json

# If not found in vendors, try vendor_identity and resolve to vendors by phone
if (-not $VendorInfo.records -or $VendorInfo.records.Count -eq 0) {
    Write-Host "Not found in vendors table, checking vendor_identity..." -ForegroundColor Yellow
    $ViCheckSql = "SELECT id, phone FROM vendor_identity WHERE id = '$VendorId'"
    $ViCheck = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $ViCheckSql --region $Region --output json | ConvertFrom-Json
    
    if ($ViCheck.records -and $ViCheck.records.Count -gt 0) {
        $ViPhone = $ViCheck.records[0][1].stringValue
        Write-Host "Found vendor_identity with phone: $ViPhone" -ForegroundColor Cyan
        Write-Host "Resolving to vendors table by phone..." -ForegroundColor Yellow
        
        $ResolveSql = "SELECT id, business_name, owner_name, phone, email, status, created_at FROM vendors WHERE phone = '$ViPhone'"
        $VendorInfo = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $ResolveSql --region $Region --output json | ConvertFrom-Json
        
        if ($VendorInfo.records -and $VendorInfo.records.Count -gt 0) {
            $VendorId = $VendorInfo.records[0][0].stringValue
            Write-Host "Resolved to vendor ID: $VendorId" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Vendor identity found but no corresponding vendor record in vendors table" -ForegroundColor Red
            Write-Host "This vendor_identity exists but has no vendors record. Cannot delete using this script." -ForegroundColor Yellow
            exit 1
        }
    } else {
    Write-Host "ERROR: Vendor not found with ID: $VendorId" -ForegroundColor Red
        Write-Host "Checked both vendors and vendor_identity tables." -ForegroundColor Yellow
    exit 1
    }
}

$VendorData = $VendorInfo.records[0]
$BusinessName = $VendorData[1].stringValue
$OwnerName = $VendorData[2].stringValue
$Phone = $VendorData[3].stringValue
$Email = $VendorData[4].stringValue
$Status = $VendorData[5].stringValue
$CreatedAt = $VendorData[6].stringValue

Write-Host "Vendor Information:" -ForegroundColor Green
Write-Host "  Business Name: $BusinessName" -ForegroundColor White
Write-Host "  Owner Name: $OwnerName" -ForegroundColor White
Write-Host "  Phone: $Phone" -ForegroundColor White
Write-Host "  Email: $Email" -ForegroundColor White
Write-Host "  Status: $Status" -ForegroundColor White
Write-Host "  Created: $CreatedAt" -ForegroundColor White
Write-Host ""

# Count related data
Write-Host "Counting related data that will be deleted..." -ForegroundColor Yellow

$CountQueries = @{
    "Staff" = "SELECT COUNT(*) FROM staff WHERE vendor_id = '$VendorId'"
    "Services" = "SELECT COUNT(*) FROM services WHERE vendor_id = '$VendorId'"
    "Bookings" = "SELECT COUNT(*) FROM bookings WHERE vendor_id = '$VendorId'"
    "Vendor Services" = "SELECT COUNT(*) FROM vendor_services WHERE vendor_id = '$VendorId'"
    "Vendor Specializations" = "SELECT COUNT(*) FROM vendor_specializations WHERE vendor_id = '$VendorId'"
    "Reviews" = "SELECT COUNT(*) FROM reviews WHERE vendor_id = '$VendorId'"
    "Package Purchases" = "SELECT COUNT(*) FROM package_purchases WHERE vendor_id = '$VendorId'"
    "Prescriptions" = "SELECT COUNT(*) FROM prescriptions WHERE vendor_id = '$VendorId'"
    "Products" = "SELECT COUNT(*) FROM products WHERE vendor_id = '$VendorId'"
    "Vendor Service Areas" = "SELECT COUNT(*) FROM vendor_service_areas WHERE vendor_id = '$VendorId'"
    "Vendor Promotions" = "SELECT COUNT(*) FROM vendor_promotions WHERE vendor_id = '$VendorId'"
    "Vendor Capabilities" = "SELECT COUNT(*) FROM vendor_capabilities WHERE vendor_id = '$VendorId'"
}

$RelatedData = @{}
foreach ($key in $CountQueries.Keys) {
    $sql = $CountQueries[$key]
    $result = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $sql --region $Region --output json | ConvertFrom-Json
    $count = 0
    if ($result.records -and $result.records.Count -gt 0) {
        $count = [int]$result.records[0][0].longValue
    }
    $RelatedData[$key] = $count
    if ($count -gt 0) {
        Write-Host "  $key : $count records" -ForegroundColor Yellow
    }
}

$TotalRelated = ($RelatedData.Values | Measure-Object -Sum).Sum
Write-Host ""
Write-Host "Total related records: $TotalRelated" -ForegroundColor Yellow
Write-Host ""

# Confirmation
if (-not $Force) {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "CONFIRMATION REQUIRED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "You are about to DELETE:" -ForegroundColor Yellow
    Write-Host "  - Vendor: $BusinessName ($VendorId)" -ForegroundColor Yellow
    Write-Host "  - $TotalRelated related records" -ForegroundColor Yellow
    Write-Host ""
    $confirmation = Read-Host "Type 'DELETE' to confirm (case-sensitive)"
    
    if ($confirmation -ne "DELETE") {
        Write-Host "Deletion cancelled." -ForegroundColor Green
        exit 0
    }
}

Write-Host ""
Write-Host "Starting deletion..." -ForegroundColor Red
Write-Host ""
Write-Host "NOTE: Deletion follows proper order to handle foreign key constraints" -ForegroundColor Cyan
Write-Host ""

# Get vendor_identity ID by phone (in case vendor_id column doesn't exist in vendor_identity)
$VendorIdentityId = $null
try {
    $viSql = "SELECT id FROM vendor_identity WHERE phone = '$Phone' ORDER BY updated_at DESC LIMIT 1"
    $viResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $viSql --region $Region --output json | ConvertFrom-Json
    if ($viResult.records -and $viResult.records.Count -gt 0) {
        $VendorIdentityId = $viResult.records[0][0].stringValue
        Write-Host "Found vendor_identity ID: $VendorIdentityId" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Could not find vendor_identity (may not exist)" -ForegroundColor Yellow
}

Write-Host ""

# Delete in correct order to handle foreign key constraints
# Order: Payments → Bookings → Services → Other vendor data → Vendor → Vendor Identity

$DeletionSteps = @(
    @{
        Name = "Payments (references bookings)"
        Sql = "DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE vendor_id = '$VendorId' OR service_id IN (SELECT id FROM services WHERE vendor_id = '$VendorId'))"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Bookings (references services and vendor)"
        Sql = "DELETE FROM bookings WHERE vendor_id = '$VendorId' OR service_id IN (SELECT id FROM services WHERE vendor_id = '$VendorId')"
        Type = "Delete"
        Optional = $false
    },
    @{
        Name = "Vendor Services"
        Sql = "DELETE FROM vendor_services WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Vendor Specializations"
        Sql = "DELETE FROM vendor_specializations WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Vendor Service Areas"
        Sql = "DELETE FROM vendor_service_areas WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Staff (cascades to staff_specializations, staff_certifications, staff_services)"
        Sql = "DELETE FROM staff WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Services (must be deleted after bookings)"
        Sql = "DELETE FROM services WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $false
    },
    @{
        Name = "Reviews"
        Sql = "DELETE FROM reviews WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Package Purchases"
        Sql = "DELETE FROM package_purchases WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Prescriptions"
        Sql = "DELETE FROM prescriptions WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Products (references vendor)"
        Sql = "DELETE FROM products WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Vendor Promotions (if table exists)"
        Sql = "DELETE FROM vendor_promotions WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Vendor Capabilities (if table exists)"
        Sql = "DELETE FROM vendor_capabilities WHERE vendor_id = '$VendorId'"
        Type = "Delete"
        Optional = $true
    },
    @{
        Name = "Vendor (main record)"
        Sql = "DELETE FROM vendors WHERE id = '$VendorId'"
        Type = "Delete"
        Optional = $false
    }
)

# Add vendor_identity deletion if we found the ID
if ($VendorIdentityId) {
    $DeletionSteps += @{
        Name = "Vendor Onboarding Applications (if linked via vendor_identity)"
        Sql = "DELETE FROM vendor_onboarding_applications WHERE vendor_identity_id = '$VendorIdentityId'"
        Type = "Delete"
        Optional = $true
    }
    $DeletionSteps += @{
        Name = "Vendor Identity"
        Sql = "DELETE FROM vendor_identity WHERE id = '$VendorIdentityId'"
        Type = "Delete"
        Optional = $true
    }
}

$DeletedCounts = @{}
$CriticalErrors = @()

foreach ($step in $DeletionSteps) {
    Write-Host "Deleting: $($step.Name)..." -ForegroundColor Yellow
    
    try {
        $result = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $step.Sql --region $Region --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $resultObj = $result | ConvertFrom-Json
            $count = 0
            if ($resultObj.numberOfRecordsUpdated) {
                $count = $resultObj.numberOfRecordsUpdated
            }
            $DeletedCounts[$step.Name] = $count
            Write-Host "  SUCCESS: $count records affected" -ForegroundColor Green
        } else {
            $errorMsg = $result | Out-String
            # Check if it's a "table does not exist" error (optional tables)
            if ($errorMsg -match "does not exist" -and $step.Optional) {
                Write-Host "  SKIPPED: Table does not exist (optional)" -ForegroundColor Yellow
            } elseif ($step.Optional) {
                Write-Host "  WARNING: $errorMsg" -ForegroundColor Yellow
            } else {
                Write-Host "  ERROR: $errorMsg" -ForegroundColor Red
                $CriticalErrors += "$($step.Name): $errorMsg"
            }
        }
    } catch {
        if ($step.Optional) {
            Write-Host "  WARNING: $_ (optional step)" -ForegroundColor Yellow
        } else {
        Write-Host "  ERROR: $_" -ForegroundColor Red
            $CriticalErrors += "$($step.Name): $_"
        }
    }
}

# Report critical errors
if ($CriticalErrors.Count -gt 0) {
    Write-Host ""
    Write-Host "CRITICAL ERRORS occurred during deletion:" -ForegroundColor Red
    foreach ($error in $CriticalErrors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "DELETION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Verify vendor is deleted
Write-Host ""
Write-Host "Verifying deletion..." -ForegroundColor Yellow
$VerifyVendorSql = "SELECT COUNT(*) FROM vendors WHERE id = '$VendorId'"
$VerifyVendorResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifyVendorSql --region $Region --output json | ConvertFrom-Json
$VendorRemainingCount = 0
if ($VerifyVendorResult.records -and $VerifyVendorResult.records.Count -gt 0) {
    $VendorRemainingCount = [int]$VerifyVendorResult.records[0][0].longValue
}

# Verify vendor_identity if we had one
$ViRemainingCount = 0
if ($VendorIdentityId) {
    $VerifyViSql = "SELECT COUNT(*) FROM vendor_identity WHERE id = '$VendorIdentityId'"
    $VerifyViResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifyViSql --region $Region --output json | ConvertFrom-Json
    if ($VerifyViResult.records -and $VerifyViResult.records.Count -gt 0) {
        $ViRemainingCount = [int]$VerifyViResult.records[0][0].longValue
    }
}

if ($VendorRemainingCount -eq 0 -and $ViRemainingCount -eq 0) {
    Write-Host "SUCCESS: Vendor has been completely deleted from the database!" -ForegroundColor Green
    Write-Host "  - Vendor record: Deleted" -ForegroundColor Green
    if ($VendorIdentityId) {
        Write-Host "  - Vendor Identity: Deleted" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Summary of deletions:" -ForegroundColor Cyan
    foreach ($key in $DeletedCounts.Keys) {
        Write-Host "  $key : $($DeletedCounts[$key]) records" -ForegroundColor White
    }
    
    if ($CriticalErrors.Count -gt 0) {
        Write-Host ""
        Write-Host "NOTE: Some optional steps had errors but vendor was successfully deleted." -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: Some records still exist in database." -ForegroundColor Red
    if ($VendorRemainingCount -gt 0) {
        Write-Host "  - Vendor record still exists" -ForegroundColor Red
    }
    if ($ViRemainingCount -gt 0) {
        Write-Host "  - Vendor Identity still exists" -ForegroundColor Red
    }
    if ($CriticalErrors.Count -gt 0) {
        Write-Host ""
        Write-Host "Critical errors prevented complete deletion:" -ForegroundColor Red
        foreach ($error in $CriticalErrors) {
            Write-Host "  - $error" -ForegroundColor Red
        }
    }
    exit 1
}

Write-Host ""
Write-Host "Script completed." -ForegroundColor Green
