# PowerShell script to run migration 313 for prescriptions created_by columns
# Usage: .\run-migration-313-prescriptions-created-by.ps1

param(
    [string]$Environment = "prod",
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "MIGRATION 313: Add created_by, created_by_role, is_active, medication_name" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Get RDS cluster ARN and secret ARN
$clusterArn = "arn:aws:rds:$Region`:057442119249:cluster:warmpawz-$Environment-cluster"
$secretArn = "arn:aws:secretsmanager:$Region`:057442119249:secret:warmpawz-$Environment-rds-master-*"

# Get the latest secret ARN
$secrets = aws secretsmanager list-secrets --region $Region --query "SecretList[?contains(Name, 'warmpawz-$Environment-rds-master')].ARN" --output json 2>&1 | ConvertFrom-Json
if ($secrets.Count -eq 0) {
    Write-Host "❌ No RDS secret found for environment: $Environment" -ForegroundColor Red
    exit 1
}
$secretArn = $secrets[0]

Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Cluster ARN: $clusterArn" -ForegroundColor Yellow
Write-Host "Secret ARN: $secretArn" -ForegroundColor Yellow
Write-Host ""

# Read migration file
$migrationFile = "db\migrations\313_add_prescriptions_created_by_columns.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $migrationFile -Raw
Write-Host "✅ Migration file loaded: $migrationFile" -ForegroundColor Green
Write-Host ""

# Split SQL into individual statements (split by semicolon followed by newline or DO $$ blocks)
# For DO $$ blocks, we need to keep them together
$statements = @()
$currentStatement = ""
$inDoBlock = $false
$doBlockDepth = 0

$lines = $sqlContent -split "`n"
foreach ($line in $lines) {
    $trimmed = $line.Trim()
    
    # Skip comments and empty lines
    if ($trimmed -match "^\s*--" -or $trimmed -eq "") {
        continue
    }
    
    # Check for DO $$ blocks
    if ($trimmed -match "DO\s+\$\$") {
        $inDoBlock = $true
        $doBlockDepth = 1
        $currentStatement = $line
    } elseif ($inDoBlock) {
        $currentStatement += "`n" + $line
        # Count $$ to detect end of DO block
        $doBlockDepth += ($line | Select-String -Pattern '\$\$' -AllMatches).Matches.Count
        if ($doBlockDepth -eq 0) {
            $inDoBlock = $false
            $statements += $currentStatement
            $currentStatement = ""
        }
    } elseif ($trimmed -match ";\s*$") {
        $currentStatement += "`n" + $line
        if ($currentStatement.Trim() -ne "") {
            $statements += $currentStatement
        }
        $currentStatement = ""
    } else {
        $currentStatement += "`n" + $line
    }
}

if ($currentStatement.Trim() -ne "") {
    $statements += $currentStatement
}

Write-Host "Found $($statements.Count) SQL statements to execute" -ForegroundColor Yellow
Write-Host ""

# Execute each statement
$successCount = 0
$failCount = 0

foreach ($statement in $statements) {
    $trimmed = $statement.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("--")) {
        continue
    }
    
    # Extract first few words for logging
    $preview = ($trimmed -split "`n" | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("--") } | Select-Object -First 1).Trim()
    if ($preview.Length -gt 60) {
        $preview = $preview.Substring(0, 60) + "..."
    }
    
    Write-Host "Executing: $preview" -ForegroundColor Cyan
    
    try {
        $result = aws rds-data execute-statement `
            --resource-arn $clusterArn `
            --secret-arn $secretArn `
            --database "warmpawz" `
            --sql $trimmed `
            --region $Region `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Success" -ForegroundColor Green
            $successCount++
        } else {
            $errorMsg = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($errorMsg -and $errorMsg.message) {
                # Check if it's a "already exists" error (which is OK)
                if ($errorMsg.message -like "*already exists*" -or $errorMsg.message -like "*duplicate*") {
                    Write-Host "  ⚠️  Already exists (OK)" -ForegroundColor Yellow
                    $successCount++
                } else {
                    Write-Host "  ❌ Error: $($errorMsg.message)" -ForegroundColor Red
                    $failCount++
                }
            } else {
                Write-Host "  ❌ Error: $result" -ForegroundColor Red
                $failCount++
            }
        }
    } catch {
        Write-Host "  ❌ Exception: $_" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "MIGRATION COMPLETE" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Migration completed with errors" -ForegroundColor Red
    exit 1
}
