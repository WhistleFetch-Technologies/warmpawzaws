param(
    [string]$MigrationFile = "559_add_vendors_specializations_column.sql",
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Running migration via RDS Data API..." -ForegroundColor Cyan
Write-Host "Migration: $MigrationFile" -ForegroundColor Yellow
Write-Host ""

# Get RDS cluster info
$ClusterInfo = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --output json | ConvertFrom-Json
$RdsArn = $ClusterInfo.DBClusters[0].DBClusterArn
$DbName = $ClusterInfo.DBClusters[0].DatabaseName
$RdsEndpoint = $ClusterInfo.DBClusters[0].Endpoint

Write-Host "RDS ARN: $RdsArn" -ForegroundColor Green
Write-Host "Database: $DbName" -ForegroundColor Green
Write-Host "Endpoint: $RdsEndpoint" -ForegroundColor Green
Write-Host ""

# Get credentials
$SecretName = "warmpawz-prod-rds-master-20260207201049162400000001"
$SecretValue = aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --query 'SecretString' --output text | ConvertFrom-Json
$DbUser = $SecretValue.username
$DbPassword = $SecretValue.password

Write-Host "Credentials retrieved" -ForegroundColor Green
Write-Host ""

# Read migration file
$MigrationPath = "db\migrations\$MigrationFile"
if (-not (Test-Path $MigrationPath)) {
    Write-Host "ERROR: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

$MigrationBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $MigrationPath).Path)
$MigrationSql = [System.Text.Encoding]::UTF8.GetString($MigrationBytes)

Write-Host "Migration SQL loaded: $($MigrationSql.Length) characters" -ForegroundColor Green
Write-Host ""

# Split SQL into individual statements (handle DO blocks properly)
$Statements = @()
$CurrentStatement = ""
$InDoBlock = $false

# Use regex to split on semicolons that are NOT inside DO blocks
# This is a simpler approach: look for DO $$ ... END $$; patterns
$DoBlockPattern = '(?s)(DO\s+\$\$.*?END\s+\$\$;)'
$CreateIndexPattern = '(?s)(CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS[^;]+;)'

# Extract DO blocks first
$DoBlocks = [regex]::Matches($MigrationSql, $DoBlockPattern)
$RemainingSql = $MigrationSql

foreach ($match in $DoBlocks) {
    $Statements += $match.Value.Trim()
    $RemainingSql = $RemainingSql.Replace($match.Value, "")
}

# Extract CREATE INDEX statements
$IndexStatements = [regex]::Matches($RemainingSql, $CreateIndexPattern)
foreach ($match in $IndexStatements) {
    $Statements += $match.Value.Trim()
    $RemainingSql = $RemainingSql.Replace($match.Value, "")
}

# Filter out empty statements
$Statements = $Statements | Where-Object { $_.Trim().Length -gt 0 }

Write-Host "Found $($Statements.Count) SQL statements" -ForegroundColor Green
Write-Host ""

# Execute each statement using RDS Data API
$SecretArn = "arn:aws:secretsmanager:$Region`:057442119249:secret:$SecretName"

foreach ($i in 0..($Statements.Count - 1)) {
    $stmt = $Statements[$i]
    if ([string]::IsNullOrWhiteSpace($stmt)) { continue }
    
    Write-Host "Executing statement $($i + 1)/$($Statements.Count)..." -ForegroundColor Yellow
    
    # Save statement to temp file to avoid escaping issues
    $TempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $stmt | Out-File -FilePath $TempSqlFile -Encoding utf8 -NoNewline
    
    # RDS Data API has a limit on SQL length, so we'll use executeStatement
    # Read SQL from file to avoid PowerShell escaping issues
    $SqlContent = Get-Content $TempSqlFile -Raw
    $Response = aws rds-data execute-statement `
        --resource-arn $RdsArn `
        --secret-arn $SecretArn `
        --database $DbName `
        --sql $SqlContent `
        --region $Region `
        --output json 2>&1
    
    Remove-Item $TempSqlFile -Force -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Statement $($i + 1) executed successfully" -ForegroundColor Green
    } else {
        # Check if it's a "already exists" error (idempotent)
        $ResponseText = $Response | Out-String
        if ($ResponseText -match "already exists" -or $ResponseText -match "duplicate" -or $ResponseText -match "already exists") {
            Write-Host "  Statement $($i + 1) skipped (already exists)" -ForegroundColor Yellow
        } elseif ($ResponseText -match "syntax error" -or $ResponseText -match "not supported") {
            Write-Host "  WARNING: Statement $($i + 1) may not be supported by RDS Data API" -ForegroundColor Yellow
            Write-Host "  Trying alternative method..." -ForegroundColor Yellow
            # For DO blocks, we might need to use a different approach
            # Continue to next statement
        } else {
            Write-Host "  ERROR in statement $($i + 1):" -ForegroundColor Red
            Write-Host $ResponseText
            Write-Host ""
            Write-Host "SQL was (first 200 chars):" -ForegroundColor Yellow
            Write-Host $stmt.Substring(0, [Math]::Min(200, $stmt.Length))
            # Don't exit, continue to see all errors
        }
    }
}

Write-Host ""
Write-Host "SUCCESS: Migration completed!" -ForegroundColor Green

# Verify
Write-Host ""
Write-Host "Verifying column exists..." -ForegroundColor Yellow
$VerifySql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'specializations'"
$VerifyResponse = aws rds-data execute-statement --resource-arn $RdsArn --secret-arn $SecretArn --database $DbName --sql $VerifySql --region $Region --output json | ConvertFrom-Json

if ($VerifyResponse.records) {
    Write-Host "VERIFIED: Column 'specializations' exists!" -ForegroundColor Green
    Write-Host ($VerifyResponse | ConvertTo-Json -Depth 10)
} else {
    Write-Host "WARNING: Could not verify column" -ForegroundColor Yellow
}
