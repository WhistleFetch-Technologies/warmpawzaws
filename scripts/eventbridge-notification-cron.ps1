<#
.SYNOPSIS
  Disable legacy notification EventBridge cron rules (event-only notification surface).

.DESCRIPTION
  Notifications are triggered-only (booking/order/meal/campaign Send). This script DISABLES
  any existing notification poll rules — it does not create new schedules.

  Rules disabled per stage:
    - warmpawz-<Stage>-reminders-minute
    - warmpawz-<Stage>-campaigns-minute
    - warmpawz-<Stage>-scheduled-notifications-minute
    - warmpawz-<Stage>-delivery-log-retention-daily
    - warmpawz-<Stage>-vaccination-reminders-daily

.PARAMETER Stage
  dev (default) or prod
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Stage = 'dev',

  [string] $Region = 'ap-south-1'
)

$ErrorActionPreference = 'Continue'

$ApiId = if ($Stage -eq 'prod') { 'mss9sa4y01' } else { 'z0b3obweb6' }
$BaseUrl = "https://$ApiId.execute-api.$Region.amazonaws.com"
$ConnectionName = "warmpawz-$Stage-notification-cron"
$RoleName = "warmpawz-$Stage-eventbridge-notification-invoke"

function Get-JsonString([hashtable] $obj) {
  ($obj | ConvertTo-Json -Compress -Depth 6)
}

function Ensure-Connection {
  param([string] $ApiKeyValue)
  $existingConnJson = aws events describe-connection --name $ConnectionName --region $Region --output json 2>$null
  if ($LASTEXITCODE -eq 0 -and $existingConnJson) {
    $existingConn = $existingConnJson | ConvertFrom-Json
    if ($existingConn.ConnectionArn) {
      Write-Host "Using existing connection $ConnectionName"
      return $existingConn.ConnectionArn
    }
  }

  if (-not $ApiKeyValue) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $ApiKeyValue = [Convert]::ToBase64String($bytes)
  }

  Write-Host "Creating connection $ConnectionName..."
  $connInputPath = Join-Path $env:USERPROFILE "warmpawz-eb-notification-connection-$Stage.json"
  $connInputObj = [ordered]@{
    Name              = $ConnectionName
    Description       = "$Stage EventBridge connection for notification cron"
    AuthorizationType = 'API_KEY'
    AuthParameters    = @{
      ApiKeyAuthParameters = @{
        ApiKeyName  = 'X-Warmpawz-EventBridge-Cron'
        ApiKeyValue = $ApiKeyValue
      }
    }
  }
  [System.IO.File]::WriteAllText($connInputPath, ($connInputObj | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
  $connInputUri = 'file://' + ($connInputPath -replace '\\', '/')
  $out = aws events create-connection --cli-input-json $connInputUri --region $Region --output json | ConvertFrom-Json
  Remove-Item -Force $connInputPath -ErrorAction SilentlyContinue
  return $out.ConnectionArn
}

function Ensure-ApiDestination {
  param(
    [string] $Name,
    [string] $Endpoint,
    [string] $ConnArn
  )
  $existingDestJson = aws events describe-api-destination --name $Name --region $Region --output json 2>$null
  if ($LASTEXITCODE -eq 0 -and $existingDestJson) {
    $existingDest = $existingDestJson | ConvertFrom-Json
    if ($existingDest.ApiDestinationArn) {
      Write-Host "Using existing API destination $Name"
      return $existingDest.ApiDestinationArn
    }
  }

  Write-Host "Creating API destination $Name -> $Endpoint"
  $out = aws events create-api-destination `
    --name $Name `
    --description "POST $Stage $Endpoint" `
    --connection-arn $ConnArn `
    --invocation-endpoint $Endpoint `
    --http-method POST `
    --invocation-rate-limit-per-second 1 `
    --region $Region `
    --output json | ConvertFrom-Json
  return $out.ApiDestinationArn
}

function Ensure-InvokeRole {
  param([string[]] $DestinationArns)
  $assume = @{
    Version   = '2012-10-17'
    Statement = @(@{
        Effect    = 'Allow'
        Principal = @{ Service = 'events.amazonaws.com' }
        Action    = 'sts:AssumeRole'
      })
  }
  $assumeFile = Join-Path $env:USERPROFILE "warmpawz-eb-notification-assume-$Stage.json"
  [System.IO.File]::WriteAllText($assumeFile, (Get-JsonString $assume), (New-Object System.Text.UTF8Encoding $false))

  aws iam get-role --role-name $RoleName --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating IAM role $RoleName..."
    aws iam create-role `
      --role-name $RoleName `
      --assume-role-policy-document "file://$($assumeFile.Replace('\', '/'))" `
      --description "EventBridge invokes notification API destinations ($Stage)" | Out-Null
  }

  $policyDoc = @{
    Version   = '2012-10-17'
    Statement = @(@{
        Effect   = 'Allow'
        Action   = 'events:InvokeApiDestination'
        Resource = $DestinationArns
      })
  }
  $policyFile = Join-Path $env:USERPROFILE "warmpawz-eb-notification-policy-$Stage.json"
  [System.IO.File]::WriteAllText($policyFile, (Get-JsonString $policyDoc), (New-Object System.Text.UTF8Encoding $false))
  aws iam put-role-policy `
    --role-name $RoleName `
    --policy-name InvokeNotificationApiDestinations `
    --policy-document "file://$($policyFile.Replace('\', '/'))" | Out-Null

  Remove-Item -Force $assumeFile, $policyFile -ErrorAction SilentlyContinue
  return (aws iam get-role --role-name $RoleName --query 'Role.Arn' --output text).Trim()
}

function Put-CronRule {
  param(
    [string] $RuleName,
    [string] $ScheduleExpression,
    [string] $Description,
    [string] $DestArn,
    [string] $RoleArn,
    [string] $TargetId
  )
  aws events put-rule `
    --name $RuleName `
    --schedule-expression $ScheduleExpression `
    --state ENABLED `
    --description $Description `
    --region $Region | Out-Null

  $existingJson = aws events list-targets-by-rule --rule $RuleName --region $Region --output json 2>$null
  if ($LASTEXITCODE -eq 0 -and $existingJson) {
    $existing = $existingJson | ConvertFrom-Json
    if ($existing.Targets -and $existing.Targets.Count -gt 0) {
      $ids = @($existing.Targets | ForEach-Object { $_.Id })
      $removeArgs = @('events', 'remove-targets', '--rule', $RuleName, '--region', $Region, '--ids') + $ids
      & aws @removeArgs | Out-Null
    }
  }

  $targetsPath = Join-Path $env:USERPROFILE "warmpawz-notification-target-$TargetId-$Stage.json"
  $targetsJson = @"
[{"Id":"$TargetId","Arn":"$DestArn","RoleArn":"$RoleArn","Input":"{}","HttpParameters":{"HeaderParameters":{"Content-Type":"application/json"}}}]
"@
  [System.IO.File]::WriteAllText($targetsPath, $targetsJson.Trim(), (New-Object System.Text.UTF8Encoding $false))
  $targetsUri = 'file://' + ($targetsPath -replace '\\', '/')
  aws events put-targets --rule $RuleName --targets $targetsUri --region $Region | Out-Null
  Remove-Item -Force $targetsPath -ErrorAction SilentlyContinue
  Write-Host "Rule $RuleName -> $ScheduleExpression"
}

Write-Host "Stage: $Stage - disabling legacy notification EventBridge rules"
Write-Host ""

$ruleNames = @(
  "warmpawz-$Stage-reminders-minute",
  "warmpawz-$Stage-campaigns-minute",
  "warmpawz-$Stage-scheduled-notifications-minute",
  "warmpawz-$Stage-delivery-log-retention-daily",
  "warmpawz-$Stage-vaccination-reminders-daily"
)

foreach ($ruleName in $ruleNames) {
  aws events describe-rule --name $ruleName --region $Region --output json 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Skip (not found): $ruleName"
    continue
  }
  aws events disable-rule --name $ruleName --region $Region | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Disabled: $ruleName"
  } else {
    Write-Host "Failed to disable: $ruleName"
  }
}

Write-Host ""
Write-Host "Done. Notification crons disabled for $Stage. User notifications are triggered-only via API."
