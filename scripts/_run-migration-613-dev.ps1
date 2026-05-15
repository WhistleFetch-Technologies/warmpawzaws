$ErrorActionPreference = "Stop"
$Region = "ap-south-1"
$ClusterId = "warmpawz-dev-cluster"
$SecretName = "warmpawz-dev-rds-master-20260106164510791100000002"
$DbName = "warmpawz"

Write-Host "Running migration 613 via RDS Data API..." -ForegroundColor Cyan
Write-Host ""

# Get RDS cluster info
$ClusterInfo = aws rds describe-db-clusters --db-cluster-identifier $ClusterId --region $Region --output json | ConvertFrom-Json
$RdsArn = $ClusterInfo.DBClusters[0].DBClusterArn
$SecretArn = (aws secretsmanager describe-secret --secret-id $SecretName --region $Region --output json | ConvertFrom-Json).ARN

Write-Host "RDS ARN: $RdsArn" -ForegroundColor Green
Write-Host "Database: $DbName" -ForegroundColor Green
Write-Host "Secret ARN: $SecretArn" -ForegroundColor Green
Write-Host ""

# Read migration file
$MigrationPath = "db\migrations\613_change_bookings_service_id_to_vendor_services.sql"
if (-not (Test-Path $MigrationPath)) {
    Write-Host "ERROR: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

$MigrationSql = Get-Content $MigrationPath -Raw

Write-Host "Migration SQL loaded: $($MigrationSql.Length) characters" -ForegroundColor Green
Write-Host ""

# Extract DO blocks and other statements
$DoBlockPattern = '(?s)(DO\s+\$\$.*?END\s+\$\$;)'
$CreateIndexPattern = '(?s)(CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS[^;]+;)'
$UpdatePattern = '(?s)(UPDATE[^;]+;)'
$CommentPattern = '(?s)(COMMENT\s+ON\s+CONSTRAINT[^;]+;)'

$Statements = @()

# Extract DO blocks
$DoBlocks = [regex]::Matches($MigrationSql, $DoBlockPattern)
foreach ($match in $DoBlocks) {
    $Statements += $match.Value.Trim()
}

# Extract UPDATE statements
$Updates = [regex]::Matches($MigrationSql, $UpdatePattern)
foreach ($match in $Updates) {
    $Statements += $match.Value.Trim()
}

# Extract CREATE INDEX
$Indexes = [regex]::Matches($MigrationSql, $CreateIndexPattern)
foreach ($match in $Indexes) {
    $Statements += $match.Value.Trim()
}

# Extract COMMENT
$Comments = [regex]::Matches($MigrationSql, $CommentPattern)
foreach ($match in $Comments) {
    $Statements += $match.Value.Trim()
}

Write-Host "Found $($Statements.Count) SQL statements" -ForegroundColor Green
Write-Host ""

# Execute each statement
foreach ($i in 0..($Statements.Count - 1)) {
    $stmt = $Statements[$i]
    if ([string]::IsNullOrWhiteSpace($stmt)) { continue }
    
    Write-Host "Executing statement $($i + 1)/$($Statements.Count)..." -ForegroundColor Yellow
    
    # Save statement to temp file
    $TempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $stmt | Out-File -FilePath $TempSqlFile -Encoding utf8 -NoNewline
    
    try {
        $Response = aws rds-data execute-statement `
            --resource-arn $RdsArn `
            --secret-arn $SecretArn `
            --database $DbName `
            --sql file://$TempSqlFile `
            --region $Region `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  âœ… Statement $($i + 1) executed successfully" -ForegroundColor Green
        } else {
            $ResponseText = $Response | Out-String
            if ($ResponseText -match "already exists" -or $ResponseText -match "does not exist") {
                Write-Host "  âš ï¸  Statement $($i + 1) skipped (already exists/does not exist)" -ForegroundColor Yellow
            } else {
                Write-Host "  âŒ ERROR in statement $($i + 1):" -ForegroundColor Red
                Write-Host $ResponseText
            }
        }
    } catch {
        Write-Host "  âŒ ERROR in statement $($i + 1): $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Remove-Item $TempSqlFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "âœ… Migration completed!" -ForegroundColor Green
