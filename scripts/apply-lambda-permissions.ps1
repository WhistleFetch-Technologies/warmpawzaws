# ============================================================================
# Apply Lambda Permissions Policy to User
# ============================================================================
# This script helps apply the Lambda permissions policy to the user 'shivangtiwari'
# Follow the steps below or use AWS CLI commands provided
# ============================================================================

param(
    [string]$UserName = "shivangtiwari",
    [string]$PolicyName = "WarmpawzLambdaFullAccess",
    [string]$PolicyFile = "lambda-full-permissions-policy.json"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Apply Lambda Permissions Policy" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$policyPath = Join-Path $scriptDir $PolicyFile

if (-not (Test-Path $policyPath)) {
    Write-Host "❌ Policy file not found: $policyPath" -ForegroundColor Red
    Write-Host "   Please ensure the policy JSON file exists" -ForegroundColor Yellow
    exit 1
}

Write-Host "Policy File: $policyPath" -ForegroundColor Gray
Write-Host "User: $UserName" -ForegroundColor Gray
Write-Host "Policy Name: $PolicyName" -ForegroundColor Gray
Write-Host ""

# Read and validate policy JSON
Write-Host "[1/3] Validating policy JSON..." -ForegroundColor Yellow
try {
    $policyContent = Get-Content -Path $policyPath -Raw
    $policyJson = $policyContent | ConvertFrom-Json
    Write-Host "  ✅ Policy JSON is valid" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Invalid JSON in policy file" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "[2/3] Checking if user exists..." -ForegroundColor Yellow
try {
    $userInfo = aws iam get-user --user-name $UserName --output json 2>&1 | ConvertFrom-Json
    if ($userInfo.User) {
        Write-Host "  ✅ User found: $UserName" -ForegroundColor Green
        Write-Host "    ARN: $($userInfo.User.Arn)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ User not found or cannot access: $UserName" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Please verify:" -ForegroundColor Yellow
    Write-Host "    1. User name is correct" -ForegroundColor White
    Write-Host "    2. You have IAM permissions to read users" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "[3/3] Applying inline policy..." -ForegroundColor Yellow
Write-Host "  Policy Name: $PolicyName" -ForegroundColor Gray
Write-Host ""

# Convert policy to single-line JSON for AWS CLI
$policyJsonSingleLine = ($policyJson | ConvertTo-Json -Depth 10 -Compress).Replace('"', '\"')

try {
    Write-Host "  Attempting to put inline policy..." -ForegroundColor Gray
    $result = aws iam put-user-policy `
        --user-name $UserName `
        --policy-name $PolicyName `
        --policy-document "file://$($policyPath -replace '\\', '/')" `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  ✅ Inline policy applied successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "============================================================================" -ForegroundColor Cyan
        Write-Host "SUCCESS - Policy Applied" -ForegroundColor Green
        Write-Host "============================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "The policy '$PolicyName' has been attached to user '$UserName'" -ForegroundColor White
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Yellow
        Write-Host "  1. Wait 1-2 minutes for IAM propagation" -ForegroundColor White
        Write-Host "  2. Test Lambda access:" -ForegroundColor White
        Write-Host "     aws lambda list-functions --region ap-south-1" -ForegroundColor Cyan
        Write-Host "  3. If still denied, try logging out and back into AWS Console" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "  ❌ Failed to apply policy" -ForegroundColor Red
        Write-Host "    Error output: $result" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  Common issues:" -ForegroundColor Yellow
        Write-Host "    - Missing iam:PutUserPolicy permission" -ForegroundColor White
        Write-Host "    - Policy size limit exceeded (inline policies have size limits)" -ForegroundColor White
        Write-Host "    - Invalid policy syntax" -ForegroundColor White
        Write-Host ""
        Write-Host "  Manual Steps:" -ForegroundColor Cyan
        Write-Host "    1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
        Write-Host "    2. Navigate to Users > $UserName > Permissions" -ForegroundColor White
        Write-Host "    3. Click 'Add permissions' > 'Create inline policy'" -ForegroundColor White
        Write-Host "    4. Switch to JSON view" -ForegroundColor White
        Write-Host "    5. Copy contents from: $policyPath" -ForegroundColor White
        Write-Host "    6. Paste into policy editor and save" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "  ❌ Error applying policy" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Please apply the policy manually using AWS Console" -ForegroundColor Yellow
    Write-Host "  See manual steps above" -ForegroundColor Yellow
    exit 1
}
