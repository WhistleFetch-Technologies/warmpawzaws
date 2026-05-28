<#
.SYNOPSIS
  Create or update warmpawz/{stage}/aftership in AWS Secrets Manager and grant Lambda read access.

.PARAMETER Stage
  dev (default) or prod

.PARAMETER SecretFile
  Path to JSON with api_key and api_secret (AfterShip api_key.json export).
  Stored as: { "api_key", "api_secret", "webhook_secret" } where webhook_secret = api_secret.

.PARAMETER LambdaRoleName
  Optional. If omitted, resolved from warmpawz-{stage}-api-handler function config.

.EXAMPLE
  .\scripts\setup-aftership-secret.ps1 -Stage dev -SecretFile "C:\path\api_key.json"
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Stage = 'dev',

  [Parameter(Mandatory = $true)]
  [string] $SecretFile,

  [string] $Region = 'ap-south-1',

  [string] $LambdaRoleName = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $SecretFile)) {
  throw "Secret file not found: $SecretFile"
}

$raw = Get-Content $SecretFile -Raw | ConvertFrom-Json
if (-not $raw.api_key) { throw 'Secret file must contain api_key' }
if (-not $raw.api_secret) { throw 'Secret file must contain api_secret' }

$secretName = "warmpawz/$Stage/aftership"
$payload = @{
  api_key        = $raw.api_key
  api_secret     = $raw.api_secret
  webhook_secret = $raw.api_secret
} | ConvertTo-Json -Compress

$payloadPath = Join-Path $env:TEMP "warmpawz-aftership-$Stage.json"
# UTF-8 without BOM — Set-Content -Encoding UTF8 adds BOM and breaks Lambda JSON.parse
[System.IO.File]::WriteAllText($payloadPath, $payload, [System.Text.UTF8Encoding]::new($false))
$payloadUri = 'file://' + ($payloadPath -replace '\\', '/')

Write-Host "Secret name: $secretName"

$existing = aws secretsmanager describe-secret --secret-id $secretName --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existing) {
  Write-Host "Updating existing secret..."
  aws secretsmanager put-secret-value --secret-id $secretName --secret-string $payloadUri --region $Region | Out-Null
  $secretArn = ($existing | ConvertFrom-Json).ARN
} else {
  Write-Host "Creating secret..."
  $created = aws secretsmanager create-secret `
    --name $secretName `
    --description "AfterShip tracking API credentials (vendor-managed shipping)" `
    --secret-string $payloadUri `
    --region $Region `
    --tags "Key=Environment,Value=$Stage" "Key=Name,Value=warmpawz-$Stage-aftership" `
    --output json | ConvertFrom-Json
  $secretArn = $created.ARN
}

Remove-Item -Force $payloadPath -ErrorAction SilentlyContinue
Write-Host "Secret ARN: $secretArn"

if (-not $LambdaRoleName) {
  $fn = if ($Stage -eq 'prod') { 'warmpawz-prod-api-handler' } else { 'warmpawz-dev-api-handler' }
  $roleArn = aws lambda get-function-configuration --function-name $fn --region $Region --query Role --output text
  $LambdaRoleName = ($roleArn -split '/')[-1]
}

Write-Host "Lambda role: $LambdaRoleName"

$policyName = (aws iam list-role-policies --role-name $LambdaRoleName --output json | ConvertFrom-Json).PolicyNames |
  Where-Object { $_ -like 'warmpawz-*-lambda-custom-*' } | Select-Object -First 1

if (-not $policyName) {
  Write-Warning "Could not find warmpawz-*-lambda-custom-* inline policy. Add this ARN to secretsmanager GetSecretValue manually:"
  Write-Host "  $secretArn"
  exit 0
}

$pol = aws iam get-role-policy --role-name $LambdaRoleName --policy-name $policyName --output json | ConvertFrom-Json
$doc = $pol.PolicyDocument
$secretsStmt = $doc.Statement | Where-Object { $_.Action -contains 'secretsmanager:GetSecretValue' } | Select-Object -First 1
$resources = @($secretsStmt.Resource)
if ($resources -notcontains $secretArn) {
  $resources += $secretArn
  $secretsStmt.Resource = $resources
  $outPath = Join-Path $env:TEMP "warmpawz-lambda-policy-$Stage.json"
  ($doc | ConvertTo-Json -Depth 12) | Set-Content $outPath -Encoding UTF8
  aws iam put-role-policy --role-name $LambdaRoleName --policy-name $policyName --policy-document "file://$($outPath -replace '\\','/')" | Out-Null
  Remove-Item -Force $outPath -ErrorAction SilentlyContinue
  Write-Host "Added AfterShip secret to IAM policy $policyName"
} else {
  Write-Host "Lambda role already has access to AfterShip secret."
}

Write-Host "Done."
