# ============================================================================
# Delete Vendor Script
# ============================================================================
# This script completely removes a vendor and all related data from the database
# 
# WARNING: This is a destructive operation and cannot be undone!
# 
# Usage:
#   .\scripts\delete-vendor.ps1 -VendorId <vendor-uuid> [-Environment prod] [-Force]
#
# Example:
#   .\scripts\delete-vendor.ps1 -VendorId "666f0a18-8b01-40f3-81a5-1705a53c9a40"
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
Write-Host "Verifying vendor exists..." -ForegroundColor Yellow
$VerifySql = "SELECT id, business_name, owner_name, phone, email, status, created_at FROM vendors WHERE id = '$VendorId'"
$VendorInfo = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifySql --region $Region --output json | ConvertFrom-Json

if (-not $VendorInfo.records -or $VendorInfo.records.Count -eq 0) {
    Write-Host "ERROR: Vendor not found with ID: $VendorId" -ForegroundColor Red
    exit 1
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

# Delete in order (tables without CASCADE first, then vendor)
# Note: Most tables have ON DELETE CASCADE, but we'll handle bookings and other critical tables manually

$DeletionSteps = @(
    @{
        Name = "Bookings (set vendor_id to NULL to preserve booking history)"
        Sql = "UPDATE bookings SET vendor_id = NULL WHERE vendor_id = '$VendorId'"
        Type = "Update"
    },
    @{
        Name = "Vendor Services"
        Sql = "DELETE FROM vendor_services WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor Specializations"
        Sql = "DELETE FROM vendor_specializations WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor Service Areas"
        Sql = "DELETE FROM vendor_service_areas WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor Promotions"
        Sql = "DELETE FROM vendor_promotions WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor Capabilities"
        Sql = "DELETE FROM vendor_capabilities WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Staff (cascades to staff_specializations, staff_certifications, staff_services)"
        Sql = "DELETE FROM staff WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Services (cascades to staff_services)"
        Sql = "DELETE FROM services WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Reviews"
        Sql = "DELETE FROM reviews WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Package Purchases"
        Sql = "DELETE FROM package_purchases WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Prescriptions"
        Sql = "DELETE FROM prescriptions WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor (main record - deletes all remaining CASCADE relationships)"
        Sql = "DELETE FROM vendors WHERE id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor Identity (if linked)"
        Sql = "DELETE FROM vendor_identity WHERE vendor_id = '$VendorId'"
        Type = "Delete"
    },
    @{
        Name = "Vendor Onboarding Applications (if linked via vendor_identity)"
        Sql = "DELETE FROM vendor_onboarding_applications WHERE vendor_identity_id IN (SELECT id FROM vendor_identity WHERE vendor_id = '$VendorId')"
        Type = "Delete"
    }
)

$DeletedCounts = @{}
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
            Write-Host "  ERROR: $result" -ForegroundColor Red
            # Continue with next step
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "DELETION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Verify vendor is deleted
Write-Host "Verifying deletion..." -ForegroundColor Yellow
$VerifySql = "SELECT COUNT(*) FROM vendors WHERE id = '$VendorId'"
$VerifyResult = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifySql --region $Region --output json | ConvertFrom-Json
$RemainingCount = 0
if ($VerifyResult.records -and $VerifyResult.records.Count -gt 0) {
    $RemainingCount = [int]$VerifyResult.records[0][0].longValue
}

if ($RemainingCount -eq 0) {
    Write-Host "SUCCESS: Vendor has been completely deleted from the database!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary of deletions:" -ForegroundColor Cyan
    foreach ($key in $DeletedCounts.Keys) {
        Write-Host "  $key : $($DeletedCounts[$key]) records" -ForegroundColor White
    }
} else {
    Write-Host "WARNING: Vendor still exists in database. Deletion may have failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Script completed." -ForegroundColor Green
