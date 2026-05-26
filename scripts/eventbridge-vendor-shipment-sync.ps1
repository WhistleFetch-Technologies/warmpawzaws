<#
.SYNOPSIS
  Create EventBridge schedule: API Destination -> POST /logistics/vendor-shipments/sync-status (every 2 hours).

.PARAMETER Stage
  dev or prod (default dev).

.PARAMETER ScheduleExpression
  Default rate(2 hours) for AfterShip fallback sync of vendor-managed shipments.
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Stage = 'dev',

  [string] $Region = 'ap-south-1',

  [string] $ScheduleExpression = 'rate(2 hours)',

  [string] $ApiKeyValue = ''
)

$ErrorActionPreference = 'Continue'

$RuleName = "warmpawz-$Stage-vendor-shipment-sync"
$ConnectionName = "warmpawz-$Stage-vendor-shipment-cron"
$ApiDestinationName = "warmpawz-$Stage-vendor-shipment-sync"
$RoleName = "warmpawz-$Stage-eventbridge-vendor-shipment-invoke"

$ApiId = if ($Stage -eq 'prod') { 'mss9sa4y01' } else { 'z0b3obweb6' }
$InvocationEndpoint = "https://$ApiId.execute-api.$Region.amazonaws.com/logistics/vendor-shipments/sync-status"

if (-not $ApiKeyValue) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $ApiKeyValue = [Convert]::ToBase64String($bytes)
}

Write-Host "Stage:               $Stage"
Write-Host "Rule:                $RuleName"
Write-Host "Endpoint:            $InvocationEndpoint"
Write-Host "Schedule:            $ScheduleExpression"
Write-Host ""

function Get-JsonString([hashtable] $obj) {
  ($obj | ConvertTo-Json -Compress -Depth 6)
}

# Connection
$connArn = $null
$existingConnJson = & aws events describe-connection --name $ConnectionName --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingConnJson) {
  $existingConn = $existingConnJson | ConvertFrom-Json
  if ($existingConn.ConnectionArn) {
    Write-Host "Using existing connection $ConnectionName"
    $connArn = $existingConn.ConnectionArn
  }
}

if (-not $connArn) {
  Write-Host "Creating connection $ConnectionName..."
  $connInputPath = Join-Path $env:USERPROFILE "warmpawz-eb-vendor-shipment-connection-$Stage.json"
  $connInputObj = [ordered]@{
    Name              = $ConnectionName
    Description       = "$Stage EventBridge connection for vendor shipment sync"
    AuthorizationType = 'API_KEY'
    AuthParameters    = @{
      ApiKeyAuthParameters = @{
        ApiKeyName  = 'X-Warmpawz-EventBridge-Cron'
        ApiKeyValue = $ApiKeyValue
      }
    }
  }
  [System.IO.File]::WriteAllText($connInputPath, (Get-JsonString $connInputObj), (New-Object System.Text.UTF8Encoding $false))
  $connUri = 'file://' + ($connInputPath -replace '\\', '/')
  $out = aws events create-connection --cli-input-json $connUri --region $Region --output json | ConvertFrom-Json
  $connArn = $out.ConnectionArn
  Remove-Item -Force $connInputPath -ErrorAction SilentlyContinue
}

# API destination
$destArn = $null
$existingDestJson = & aws events describe-api-destination --name $ApiDestinationName --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingDestJson) {
  $existingDest = $existingDestJson | ConvertFrom-Json
  if ($existingDest.ApiDestinationArn) {
    Write-Host "Using existing API destination $ApiDestinationName"
    $destArn = $existingDest.ApiDestinationArn
  }
}

if (-not $destArn) {
  Write-Host "Creating API destination $ApiDestinationName..."
  $out = aws events create-api-destination `
    --name $ApiDestinationName `
    --description "POST $Stage vendor shipment AfterShip sync" `
    --connection-arn $connArn `
    --invocation-endpoint $InvocationEndpoint `
    --http-method POST `
    --invocation-rate-limit-per-second 1 `
    --region $Region `
    --output json | ConvertFrom-Json
  $destArn = $out.ApiDestinationArn
}

# IAM role
$assume = @{
  Version   = '2012-10-17'
  Statement = @(@{ Effect = 'Allow'; Principal = @{ Service = 'events.amazonaws.com' }; Action = 'sts:AssumeRole' })
}
$assumeFile = Join-Path $env:USERPROFILE "warmpawz-eb-vendor-shipment-assume-$Stage.json"
[System.IO.File]::WriteAllText($assumeFile, (Get-JsonString $assume), (New-Object System.Text.UTF8Encoding $false))

aws iam get-role --role-name $RoleName --output json 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$($assumeFile.Replace('\', '/'))" --description "EventBridge vendor shipment sync ($Stage)" | Out-Null
}

$policyDoc = @{
  Version   = '2012-10-17'
  Statement = @(@{ Effect = 'Allow'; Action = 'events:InvokeApiDestination'; Resource = $destArn })
}
$policyFile = Join-Path $env:USERPROFILE "warmpawz-eb-vendor-shipment-policy-$Stage.json"
[System.IO.File]::WriteAllText($policyFile, (Get-JsonString $policyDoc), (New-Object System.Text.UTF8Encoding $false))
aws iam put-role-policy --role-name $RoleName --policy-name InvokeVendorShipmentSync --policy-document "file://$($policyFile.Replace('\', '/'))" | Out-Null
$roleArn = (aws iam get-role --role-name $RoleName --query 'Role.Arn' --output text).Trim()

aws events put-rule `
  --name $RuleName `
  --schedule-expression $ScheduleExpression `
  --state ENABLED `
  --description "$Stage`: vendor-managed shipment AfterShip sync every 2h" `
  --region $Region | Out-Null

$targetsPath = Join-Path $env:USERPROFILE "warmpawz-vendor-shipment-targets-$Stage.json"
$targetsJson = @"
[{"Id":"VendorShipmentSync","Arn":"$destArn","RoleArn":"$roleArn","Input":"{}","HttpParameters":{"HeaderParameters":{"Content-Type":"application/json"}}}]
"@
[System.IO.File]::WriteAllText($targetsPath, $targetsJson.Trim(), (New-Object System.Text.UTF8Encoding $false))
$targetsUri = 'file://' + ($targetsPath -replace '\\', '/')
& aws events put-targets --rule $RuleName --targets $targetsUri --region $Region | Out-Null

Remove-Item -Force $assumeFile, $policyFile, $targetsPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Rule $RuleName -> $InvocationEndpoint"
