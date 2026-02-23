param(
    [string]$MigrationFile = "559_add_vendors_specializations_column.sql",
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Running migration via Lambda..." -ForegroundColor Cyan
Write-Host "Migration: $MigrationFile" -ForegroundColor Yellow
Write-Host ""

# Read migration file using .NET methods to avoid PowerShell parsing issues
$MigrationPath = "db\migrations\$MigrationFile"
if (-not (Test-Path $MigrationPath)) {
    Write-Host "ERROR: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

# Read file as bytes then convert to string to avoid encoding issues
$MigrationBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $MigrationPath).Path)
$MigrationSql = [System.Text.Encoding]::UTF8.GetString($MigrationBytes)

Write-Host "Migration SQL loaded: $($MigrationSql.Length) characters" -ForegroundColor Green
Write-Host ""

# Create event payload
$Event = @{
    migrationSQL = $MigrationSql
} | ConvertTo-Json -Depth 10 -Compress

# Save to temp file
$EventFile = [System.IO.Path]::GetTempFileName() + ".json"
$Event | Out-File -FilePath $EventFile -Encoding utf8 -NoNewline

Write-Host "Event file created: $EventFile" -ForegroundColor Green
Write-Host ""

# Check if prod migration runner exists, if not use dev or create one
$LambdaName = "warmpawz-prod-migration-runner"
$LambdaExists = aws lambda get-function --function-name $LambdaName --region $Region 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Production migration runner not found. Checking dev..." -ForegroundColor Yellow
    $LambdaName = "warmpawz-dev-migration-runner"
    $LambdaExists = aws lambda get-function --function-name $LambdaName --region $Region 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: No migration runner Lambda found. Creating one..." -ForegroundColor Red
        Write-Host "This requires deploying the Lambda migration runner first." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Using Lambda: $LambdaName" -ForegroundColor Green
Write-Host "Invoking Lambda..." -ForegroundColor Yellow

# Invoke Lambda
$Response = aws lambda invoke `
    --function-name $LambdaName `
    --region $Region `
    --payload "file://$EventFile" `
    --cli-binary-format raw-in-base64-out `
    --output json `
    /tmp/lambda-response.json 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Lambda invoked successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Read response
    $ResponseContent = Get-Content /tmp/lambda-response.json -Raw | ConvertFrom-Json
    
    if ($ResponseContent.PSObject.Properties.Name -contains "FunctionError") {
        Write-Host "ERROR: Lambda execution failed" -ForegroundColor Red
        Write-Host $ResponseContent | ConvertTo-Json -Depth 10
        Remove-Item $EventFile -Force
        exit 1
    }
    
    # Parse response body
    if ($ResponseContent.PSObject.Properties.Name -contains "Payload") {
        $Payload = $ResponseContent.Payload | ConvertFrom-Json
        Write-Host "Response:" -ForegroundColor Cyan
        Write-Host ($Payload | ConvertTo-Json -Depth 10)
        
        if ($Payload.statusCode -eq 200) {
            Write-Host ""
            Write-Host "SUCCESS: Migration completed!" -ForegroundColor Green
            Remove-Item $EventFile -Force
            exit 0
        } else {
            Write-Host ""
            Write-Host "ERROR: Migration failed" -ForegroundColor Red
            Remove-Item $EventFile -Force
            exit 1
        }
    } else {
        Write-Host "Response:" -ForegroundColor Cyan
        Write-Host ($ResponseContent | ConvertTo-Json -Depth 10)
    }
} else {
    Write-Host "ERROR: Failed to invoke Lambda" -ForegroundColor Red
    Write-Host $Response
    Remove-Item $EventFile -Force
    exit 1
}

Remove-Item $EventFile -Force
