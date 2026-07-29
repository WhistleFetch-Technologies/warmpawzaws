# ============================================================================
# UNSAFE — handler.js-only Lambda deploy (NOT for shared dev / warmpawz-dev-api-handler)
# ============================================================================
# Uploads dist/lambda-dev.zip containing ONLY handler.js (~2–3 MB).
# Missing firebase-admin, sharp, and full runtime deps. Caused Commerce Switch 404
# regression when used against warmpawz-dev-api-handler.
#
# Required flag: -AllowUnsafeHandlerOnly
# Official deploy: ./scripts/deploy-lambda-direct.sh
# ============================================================================

param(
    [switch]$AllowUnsafeHandlerOnly,
    [string]$Region = "ap-south-1",
    [string]$DevApiId = "z0b3obweb6",
    [string]$LambdaFunctionName = ""
)

$ErrorActionPreference = "Stop"

if (-not $AllowUnsafeHandlerOnly) {
    Write-Host "Refusing to run without -AllowUnsafeHandlerOnly" -ForegroundColor Red
    exit 1
}

Write-Host "WARNING: UNSAFE handler-only deploy — do not use on shared dev API handler" -ForegroundColor Red

# Step 1: Identify Dev Lambda Function
Write-Host "Step 1: Identifying Dev Lambda Function..." -ForegroundColor Yellow
Write-Host "  API Gateway ID: $DevApiId" -ForegroundColor Gray

$lambdaName = $null
if ($LambdaFunctionName) {
    $lambdaName = $LambdaFunctionName
    Write-Host "  Using explicit function name: $lambdaName" -ForegroundColor Green
}

if (-not $lambdaName) {
    try {
        $integrations = aws apigatewayv2 get-integrations --api-id $DevApiId --region $Region --output json 2>&1 | ConvertFrom-Json
        if ($integrations.Items -and $integrations.Items.Count -gt 0) {
            foreach ($item in $integrations.Items) {
                $uri = $item.IntegrationUri
                if ($uri -notmatch 'function:([^/]+)') { continue }
                $candidate = $matches[1]
                aws lambda get-function --function-name $candidate --region $Region --output json 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $lambdaName = $candidate
                    Write-Host "  Found Lambda Function: $lambdaName" -ForegroundColor Green
                    break
                }
            }
        }
    } catch {
        Write-Host "  Could not auto-detect Lambda from API Gateway" -ForegroundColor Yellow
    }
}

if (-not $lambdaName) {
    $lambdaName = "warmpawz-dev-api-handler"
    Write-Host "  Defaulting to: $lambdaName" -ForegroundColor Yellow
}

$lambdaDir = Join-Path $PSScriptRoot "..\backend\lambda"
Set-Location $lambdaDir

Write-Host "Step 2: npm run build:bundle (NOT full npm run build)" -ForegroundColor Yellow
$buildProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run build:bundle" `
    -WorkingDirectory $lambdaDir `
    -Wait -PassThru -NoNewWindow
if ($buildProc.ExitCode -ne 0) { exit 1 }

$handlerPath = Join-Path $lambdaDir "dist\handler.js"
$zipPath = Join-Path $lambdaDir "dist\lambda-dev.zip"
Compress-Archive -Path $handlerPath -DestinationPath $zipPath -Force
$zipSizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "UNSAFE package size: $zipSizeMb MB (handler.js only)" -ForegroundColor Red

aws lambda update-function-code `
    --function-name $lambdaName `
    --zip-file "fileb://$zipPath" `
    --region $Region `
    --output json | Out-Null

Write-Host "UNSAFE deploy complete — verify Commerce Switch manually if this was not intentional" -ForegroundColor Yellow
