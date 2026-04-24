<#
.SYNOPSIS
  Create prod EventBridge daily settlement schedule the same way as dev: API Destination → HTTP API POST /settlements/calculate-daily.

.DESCRIPTION
  Dev reference (same account pattern):
    - Connection: API_KEY header X-Warmpawz-EventBridge-Cron (value in Secrets Manager; app does not require it today).
    - API destination: POST https://<apiId>.execute-api.ap-south-1.amazonaws.com/settlements/calculate-daily
    - IAM role: events.amazonaws.com → events:InvokeApiDestination on that destination only
    - Rule: warmpawz-<stage>-settlement-calculate-daily + target (matches Lambda SETTLEMENT_CALCULATE_CRON_RULE_NAME / PutRule from Admin Finance).

  Prerequisites: AWS CLI, credentials for the account, region ap-south-1 (override with -Region).

.PARAMETER Stage
  Use prod (default) to create warmpawz-prod-* resources. Use dev only if recreating dev.

.PARAMETER ApiKeyValue
  Optional. API key value stored on the EventBridge connection (header X-Warmpawz-EventBridge-Cron).
  If omitted, a random value is generated (sufficient if API Gateway does not validate this header).

.PARAMETER ScheduleExpression
  EventBridge schedule (default cron(30 3 * * ? *) ≈ 09:00 IST; dev currently uses cron(35 3 * * ? *) — adjust to match ops).
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Stage = 'prod',

  [string] $Region = 'ap-south-1',

  [string] $ScheduleExpression = 'cron(30 3 * * ? *)',

  [string] $ApiKeyValue = ''
)

# AWS CLI writes to stderr even on success; avoid Stop tripping on describe-* misses.
$ErrorActionPreference = 'Continue'

$RuleName = "warmpawz-$Stage-settlement-calculate-daily"
$ConnectionName = "warmpawz-$Stage-settlement-cron"
$ApiDestinationName = "warmpawz-$Stage-settlement-calc-daily"
$RoleName = "warmpawz-$Stage-eventbridge-settlement-invoke"

$ApiId = if ($Stage -eq 'prod') { 'mss9sa4y01' } else { 'z0b3obweb6' }
$InvocationEndpoint = "https://$ApiId.execute-api.$Region.amazonaws.com/settlements/calculate-daily"

if (-not $ApiKeyValue) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $ApiKeyValue = [Convert]::ToBase64String($bytes)
}

Write-Host "Stage:               $Stage"
Write-Host "Rule:                $RuleName"
Write-Host "Connection:          $ConnectionName"
Write-Host "API destination:     $ApiDestinationName"
Write-Host "Endpoint:            $InvocationEndpoint"
Write-Host "IAM role:            $RoleName"
Write-Host "Schedule:            $ScheduleExpression"
Write-Host ""

function Get-JsonString([hashtable] $obj) {
  ($obj | ConvertTo-Json -Compress -Depth 6)
}

# --- 1) Connection (reuse if exists) ---
$connArn = $null
$existingConnJson = & aws events describe-connection --name $ConnectionName --region $Region --output json 2>$null
$existingConn = $null
if ($LASTEXITCODE -eq 0 -and $existingConnJson) { $existingConn = $existingConnJson | ConvertFrom-Json }
if ($existingConn -and $existingConn.ConnectionArn) {
  Write-Host "Using existing connection $ConnectionName"
  $connArn = $existingConn.ConnectionArn
} else {
  Write-Host "Creating connection $ConnectionName..."
  # Use --cli-input-json + a path without 8.3 segments (AWS CLI on Windows rejects file:/// under BINDUS~1).
  $connInputPath = Join-Path $env:USERPROFILE "warmpawz-eb-create-connection-$Stage.json"
  $connInputObj = [ordered]@{
    Name                 = $ConnectionName
    Description          = "$Stage EventBridge connection for daily settlement (API key unused by API GW if not validated)"
    AuthorizationType    = 'API_KEY'
    AuthParameters       = @{
      ApiKeyAuthParameters = @{
        ApiKeyName  = 'X-Warmpawz-EventBridge-Cron'
        ApiKeyValue = $ApiKeyValue
      }
    }
  }
  $connJson = $connInputObj | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($connInputPath, $connJson, (New-Object System.Text.UTF8Encoding $false))
  # Windows AWS CLI expects file://C:/... (two slashes), not file:///C:/...
  $connInputUri = 'file://' + ($connInputPath -replace '\\', '/')
  $out = aws events create-connection --cli-input-json $connInputUri --region $Region --output json | ConvertFrom-Json
  Remove-Item -Force $connInputPath -ErrorAction SilentlyContinue
  $connArn = $out.ConnectionArn
  if (-not $connArn) { throw 'create-connection failed' }
  Write-Host "  ConnectionArn: $connArn"
}

# --- 2) API destination (reuse if exists) ---
$destArn = $null
$existingDestJson = & aws events describe-api-destination --name $ApiDestinationName --region $Region --output json 2>$null
$existingDest = $null
if ($LASTEXITCODE -eq 0 -and $existingDestJson) { $existingDest = $existingDestJson | ConvertFrom-Json }
if ($existingDest -and $existingDest.ApiDestinationArn) {
  Write-Host "Using existing API destination $ApiDestinationName"
  $destArn = $existingDest.ApiDestinationArn
} else {
  Write-Host "Creating API destination $ApiDestinationName..."
  $out = aws events create-api-destination `
    --name $ApiDestinationName `
    --description "POST $Stage API settlements/calculate-daily" `
    --connection-arn $connArn `
    --invocation-endpoint $InvocationEndpoint `
    --http-method POST `
    --invocation-rate-limit-per-second 1 `
    --region $Region `
    --output json | ConvertFrom-Json
  $destArn = $out.ApiDestinationArn
  if (-not $destArn) { throw 'create-api-destination failed' }
  Write-Host "  ApiDestinationArn: $destArn"
}

# --- 3) IAM role + inline policy ---
$accountId = (aws sts get-caller-identity --query Account --output text --region $Region).Trim()
$assume = @{
  Version   = '2012-10-17'
  Statement = @(
    @{
      Effect    = 'Allow'
      Principal = @{ Service = 'events.amazonaws.com' }
      Action    = 'sts:AssumeRole'
    }
  )
}
$assumeFile = Join-Path $env:USERPROFILE "warmpawz-eb-settlement-assume-$Stage.json"
[System.IO.File]::WriteAllText($assumeFile, (Get-JsonString $assume), (New-Object System.Text.UTF8Encoding $false))

aws iam get-role --role-name $RoleName --output json 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating IAM role $RoleName..."
  aws iam create-role `
    --role-name $RoleName `
    --assume-role-policy-document "file://$($assumeFile.Replace('\', '/'))" `
    --description "EventBridge invokes settlement API destination ($Stage)" | Out-Null
} else {
  Write-Host "Using existing IAM role $RoleName"
}

$policyDoc = @{
  Version   = '2012-10-17'
  Statement = @(
    @{
      Effect   = 'Allow'
      Action   = 'events:InvokeApiDestination'
      Resource = $destArn
    }
  )
}
$policyFile = Join-Path $env:USERPROFILE "warmpawz-eb-settlement-policy-$Stage.json"
[System.IO.File]::WriteAllText($policyFile, (Get-JsonString $policyDoc), (New-Object System.Text.UTF8Encoding $false))

Write-Host "Putting inline policy InvokeSettlementApiDestination on $RoleName..."
aws iam put-role-policy `
  --role-name $RoleName `
  --policy-name InvokeSettlementApiDestination `
  --policy-document "file://$($policyFile.Replace('\', '/'))" | Out-Null

$roleArn = (aws iam get-role --role-name $RoleName --query 'Role.Arn' --output text).Trim()

# New connections may take a moment before API destination can be created
$deadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $deadline) {
  $st = (aws events describe-connection --name $ConnectionName --region $Region --query 'ConnectionState' --output text).Trim()
  if ($st -eq 'AUTHORIZED') { break }
  Start-Sleep -Seconds 3
}

# --- 4) Rule + target ---
Write-Host "Putting EventBridge rule..."
aws events put-rule `
  --name $RuleName `
  --schedule-expression $ScheduleExpression `
  --state ENABLED `
  --description "$Stage`: daily POST /settlements/calculate-daily via API destination" `
  --region $Region | Out-Null

Write-Host "Replacing targets..."
$existingJson = aws events list-targets-by-rule --rule $RuleName --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingJson) {
  $existing = $existingJson | ConvertFrom-Json
  if ($existing.Targets -and $existing.Targets.Count -gt 0) {
    $ids = @($existing.Targets | ForEach-Object { $_.Id })
    $removeArgs = @('events', 'remove-targets', '--rule', $RuleName, '--region', $Region, '--ids') + $ids
    & aws @removeArgs | Out-Null
  }
}

# put-targets requires a JSON *array*; ConvertTo-Json on a single-element @() unwraps to one object on Windows PS 5.x.
$targetsPath = Join-Path $env:USERPROFILE "warmpawz-settlement-daily-targets-$Stage.json"
$targetsJson = @"
[{"Id":"SettlementCalculateDaily","Arn":"$destArn","RoleArn":"$roleArn","Input":"{}","HttpParameters":{"HeaderParameters":{"Content-Type":"application/json"}}}]
"@
[System.IO.File]::WriteAllText($targetsPath, $targetsJson.Trim(), (New-Object System.Text.UTF8Encoding $false))
$targetsUri = 'file://' + ($targetsPath -replace '\\', '/')
& aws events put-targets --rule $RuleName --targets $targetsUri --region $Region | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'put-targets failed' }

Remove-Item -Force $assumeFile, $policyFile, $targetsPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done."
Write-Host "  Rule:           $RuleName"
Write-Host "  API destination $ApiDestinationName -> $InvocationEndpoint"
Write-Host "  Admin Finance schedule saves will call PutRule on $RuleName only (cron may change)."
