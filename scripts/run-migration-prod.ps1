# ============================================================================
# Run Production Migration via AWS Systems Manager
# ============================================================================
# This script uses AWS Systems Manager Run Command to execute migrations
# on an EC2 instance in the production VPC
# ============================================================================

param(
    [string]$MigrationFile = "559_add_vendors_specializations_column.sql",
    [string]$InstanceId = "",
    [string]$Environment = "prod",
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Production Migration via Systems Manager" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment"
Write-Host "Region: $Region"
Write-Host "Migration: $MigrationFile"
Write-Host ""

# Check if migration file exists
$MigrationPath = "db\migrations\$MigrationFile"
if (-not (Test-Path $MigrationPath)) {
    Write-Host "ERROR ERROR: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

# Find EC2 instance if not provided
if ([string]::IsNullOrEmpty($InstanceId)) {
    Write-Host "INFO Finding EC2 instance in production VPC..." -ForegroundColor Yellow
    $VpcId = "vpc-02a4893e5e582c4d8"
    
    $InstanceId = aws ec2 describe-instances `
        --region $Region `
        --filters "Name=vpc-id,Values=$VpcId" "Name=instance-state-name,Values=running" `
        --query 'Reservations[0].Instances[0].InstanceId' `
        --output text 2>$null
    
    if ([string]::IsNullOrEmpty($InstanceId) -or $InstanceId -eq "None" -or $InstanceId -eq "null") {
        Write-Host "ERROR ERROR: No running EC2 instance found in VPC $VpcId" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please provide an instance ID:"
        Write-Host "  .\run-migration-prod.ps1 -MigrationFile $MigrationFile -InstanceId INSTANCE_ID"
        exit 1
    }
}

Write-Host "SUCCESS Using instance: $InstanceId" -ForegroundColor Green
Write-Host ""

# Get RDS connection info
Write-Host "INFO Getting RDS connection information..." -ForegroundColor Yellow
$RdsEndpoint = aws rds describe-db-clusters `
    --db-cluster-identifier "warmpawz-prod-cluster" `
    --region $Region `
    --query 'DBClusters[0].Endpoint' `
    --output text

$RdsPort = aws rds describe-db-clusters `
    --db-cluster-identifier "warmpawz-prod-cluster" `
    --region $Region `
    --query 'DBClusters[0].Port' `
    --output text

$RdsDb = aws rds describe-db-clusters `
    --db-cluster-identifier "warmpawz-prod-cluster" `
    --region $Region `
    --query 'DBClusters[0].DatabaseName' `
    --output text

$RdsUser = aws rds describe-db-clusters `
    --db-cluster-identifier "warmpawz-prod-cluster" `
    --region $Region `
    --query 'DBClusters[0].MasterUsername' `
    --output text

Write-Host "SUCCESS RDS Endpoint: $RdsEndpoint" -ForegroundColor Green
Write-Host "SUCCESS Database: $RdsDb" -ForegroundColor Green
Write-Host "SUCCESS Username: $RdsUser" -ForegroundColor Green
Write-Host ""

# Get password from Secrets Manager
Write-Host "SECRET Getting RDS password from Secrets Manager..." -ForegroundColor Yellow
$SecretName = "warmpawz-prod-rds-master-20260207201049162400000001"
$SecretValue = aws secretsmanager get-secret-value `
    --secret-id $SecretName `
    --region $Region `
    --query 'SecretString' `
    --output text | ConvertFrom-Json

$DbPassword = $SecretValue.password
if (-not $DbPassword) {
    $DbPassword = $SecretValue.Password
}
if (-not $DbPassword) {
    $DbPassword = $SecretValue.secret
}
if (-not $DbPassword) {
    $DbPassword = $SecretValue.Secret
}

if ([string]::IsNullOrEmpty($DbPassword)) {
    Write-Host "ERROR ERROR: Could not extract password from secret" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS Password retrieved" -ForegroundColor Green
Write-Host ""

# Read migration file
Write-Host "FILE Reading migration file..." -ForegroundColor Yellow
$MigrationSql = Get-Content $MigrationPath -Raw

# Escape password for shell
$EscapedPassword = $DbPassword -replace "'", "'\''"

# Create temporary bash script file
$TempBashScript = [System.IO.Path]::GetTempFileName() + ".sh"

# Build bash script content line by line to avoid PowerShell parsing issues
$BashLines = @()
$BashLines += '#!/bin/bash'
$BashLines += 'set -e'
$BashLines += "export PGPASSWORD='$EscapedPassword'"
$BashLines += '# Install psql if not available'
$BashLines += 'if ! command -v psql > /dev/null 2>&1; then'
$BashLines += "    echo 'Installing PostgreSQL client...'"
$BashLines += '    sudo yum install -y postgresql15 2>/dev/null || sudo yum install -y postgresql 2>/dev/null'
$BashLines += 'fi'
$BashLines += '# Run migration'
# Write SQL to temp file and execute with psql to avoid quote escaping issues
$MigrationFileName = '/tmp/migration_' + [System.Guid]::NewGuid().ToString() + '.sql'
$BashLines += "MIGRATION_FILE='$MigrationFileName'"
$BashLines += 'cat > $MIGRATION_FILE <<MIGRATION_EOF'
# Add SQL content line by line
$SqlLines = $MigrationSql -split "`n"
foreach ($line in $SqlLines) {
    $BashLines += $line
}
$BashLines += 'MIGRATION_EOF'
$BashLines += "psql -h $RdsEndpoint -p $RdsPort -U $RdsUser -d $RdsDb -f `$MIGRATION_FILE"
$BashLines += 'rm -f $MIGRATION_FILE'
$BashLines += "echo 'Migration completed successfully'"

$BashScriptContent = $BashLines -join "`n"
Set-Content -Path $TempBashScript -Value $BashScriptContent

# Base64 encode the bash script
$Bytes = [System.IO.File]::ReadAllBytes($TempBashScript)
$EncodedCommand = [Convert]::ToBase64String($Bytes)

Write-Host "Sending migration command to instance via Systems Manager..." -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────"

# Create temporary JSON file for command parameters
$TempJson = [System.IO.Path]::GetTempFileName() + ".json"
$CommandParams = @{
    commands = @("echo '$EncodedCommand' | base64 -d | bash")
} | ConvertTo-Json -Compress

Set-Content -Path $TempJson -Value $CommandParams

try {
    # Send command via Systems Manager
    $CommandOutput = aws ssm send-command `
        --instance-ids $InstanceId `
        --document-name "AWS-RunShellScript" `
        --parameters "file://$TempJson" `
        --region $Region `
        --timeout-seconds 300 `
        --output json | ConvertFrom-Json

    $CommandId = $CommandOutput.Command.CommandId
    Write-Host "SUCCESS Command sent successfully" -ForegroundColor Green
    Write-Host "Command ID: $CommandId" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "WAIT Waiting for command to complete..." -ForegroundColor Yellow

    # Poll for completion
    $Status = "InProgress"
    $Attempts = 0
    $MaxAttempts = 60

    while ($Status -eq "InProgress" -and $Attempts -lt $MaxAttempts) {
        Start-Sleep -Seconds 5
        $Invocation = aws ssm get-command-invocation `
            --command-id $CommandId `
            --instance-id $InstanceId `
            --region $Region `
            --output json 2>$null | ConvertFrom-Json
        
        if ($Invocation) {
            $Status = $Invocation.Status
            if ($Status -eq "InProgress") {
                Write-Host "." -NoNewline
                $Attempts++
            }
        }
    }

    Write-Host ""
    Write-Host ""

    # Get final status
    $FinalInvocation = aws ssm get-command-invocation `
        --command-id $CommandId `
        --instance-id $InstanceId `
        --region $Region `
        --output json | ConvertFrom-Json

    Write-Host "Command Status: $($FinalInvocation.Status)" -ForegroundColor $(if ($FinalInvocation.Status -eq "Success") { "Green" } else { "Red" })
    Write-Host ""

    if ($FinalInvocation.StandardOutputContent) {
        Write-Host "OUTPUT Output:" -ForegroundColor Cyan
        Write-Host $FinalInvocation.StandardOutputContent
        Write-Host ""
    }

    if ($FinalInvocation.StandardErrorContent) {
        Write-Host "WARN  Errors:" -ForegroundColor Yellow
        Write-Host $FinalInvocation.StandardErrorContent
        Write-Host ""
    }

    if ($FinalInvocation.Status -eq "Success") {
        Write-Host 'SUCCESS Migration completed successfully!' -ForegroundColor Green
        exit 0
    } else {
        $FailMsg = 'Migration failed with status: ' + $FinalInvocation.Status
        Write-Host ('ERROR: ' + $FailMsg) -ForegroundColor Red
        exit 1
    }
} finally {
    # Clean up temp files
    if (Test-Path $TempJson) {
        Remove-Item $TempJson -Force
    }
    if (Test-Path $TempBashScript) {
        Remove-Item $TempBashScript -Force
    }
}


