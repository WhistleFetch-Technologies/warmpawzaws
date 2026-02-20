param(
    [string]$MigrationFile = "559_add_vendors_specializations_column.sql",
    [string]$InstanceId = "i-07275f90fc2053eef",
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Running production migration..." -ForegroundColor Cyan
Write-Host "Migration: $MigrationFile"
Write-Host "Instance: $InstanceId"
Write-Host ""

# Get RDS info
$RdsEndpoint = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --query 'DBClusters[0].Endpoint' --output text
$RdsPort = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --query 'DBClusters[0].Port' --output text
$RdsDb = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --query 'DBClusters[0].DatabaseName' --output text
$RdsUser = aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region $Region --query 'DBClusters[0].MasterUsername' --output text

# Get password
$SecretName = "warmpawz-prod-rds-master-20260207201049162400000001"
$SecretValue = aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --query 'SecretString' --output text | ConvertFrom-Json
$DbPassword = $SecretValue.password

# Read migration
$MigrationPath = "db\migrations\$MigrationFile"
$MigrationSql = Get-Content $MigrationPath -Raw

# Create bash script
$BashScript = @"
#!/bin/bash
export PGPASSWORD='$DbPassword'
if ! command -v psql > /dev/null 2>&1; then
    sudo yum install -y postgresql15 || sudo yum install -y postgresql
fi
cat > /tmp/mig.sql <<'EOF'
$MigrationSql
EOF
psql -h $RdsEndpoint -p $RdsPort -U $RdsUser -d $RdsDb -f /tmp/mig.sql
rm -f /tmp/mig.sql
echo "Migration completed"
"@

# Base64 encode
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($BashScript)
$Encoded = [Convert]::ToBase64String($Bytes)

# Create JSON for SSM
$JsonFile = [System.IO.Path]::GetTempFileName() + ".json"
$Json = @"
{"commands":["echo '$Encoded' | base64 -d | bash"]}
"@
Set-Content -Path $JsonFile -Value $Json

# Send command
Write-Host "Sending command to instance..." -ForegroundColor Yellow
$CmdOutput = aws ssm send-command --instance-ids $InstanceId --document-name "AWS-RunShellScript" --parameters "file://$JsonFile" --region $Region --timeout-seconds 300 --output json | ConvertFrom-Json
$CmdId = $CmdOutput.Command.CommandId

Write-Host "Command ID: $CmdId" -ForegroundColor Cyan
Write-Host "Waiting for completion..." -ForegroundColor Yellow

# Wait and check
Start-Sleep -Seconds 10
$Status = "InProgress"
$Attempts = 0
while ($Status -eq "InProgress" -and $Attempts -lt 60) {
    Start-Sleep -Seconds 5
    $Inv = aws ssm get-command-invocation --command-id $CmdId --instance-id $InstanceId --region $Region --output json 2>$null | ConvertFrom-Json
    if ($Inv) { $Status = $Inv.Status }
    Write-Host "." -NoNewline
    $Attempts++
}

Write-Host ""
$Final = aws ssm get-command-invocation --command-id $CmdId --instance-id $InstanceId --region $Region --output json | ConvertFrom-Json

Write-Host "Status: $($Final.Status)" -ForegroundColor $(if ($Final.Status -eq "Success") { "Green" } else { "Red" })
if ($Final.StandardOutputContent) { Write-Host $Final.StandardOutputContent }
if ($Final.StandardErrorContent) { Write-Host $Final.StandardErrorContent -ForegroundColor Yellow }

Remove-Item $JsonFile -Force
if ($Final.Status -eq "Success") { exit 0 } else { exit 1 }
