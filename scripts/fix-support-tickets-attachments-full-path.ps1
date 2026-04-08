#Requires -Version 5.1
<#
.SYNOPSIS
  Migration 617 + optional Lambda build/upload for support_tickets.attachments.

.DESCRIPTION
  - Uses your existing AWS credential chain (never writes secrets into the repo).
  - Optional: aws sso login (--profile) before checks.
  - Runs migration 617 on dev/prod RDS (Data API) unless -SkipMigration.
  - Optional -DeployLambda: npm run build in backend/lambda, then aws lambda update-function-code.

.PARAMETER AwsProfile
  Sets $env:AWS_PROFILE for this session (SSO or named profile).

.PARAMETER SsoLogin
  Runs `aws sso login --profile <AwsProfile>` first (browser). Requires -AwsProfile.

.PARAMETER DeployLambda
  After migration, builds api-handler.zip and uploads to the Lambda(s) for the chosen environment(s).

.PARAMETER SkipMigration
  Only build/upload Lambda (no RDS migration).

.EXAMPLE
  cd scripts
  .\fix-support-tickets-attachments-full-path.ps1 -Environment dev -DeployLambda

.EXAMPLE
  .\fix-support-tickets-attachments-full-path.ps1 -Environment both -AwsProfile my-sso -SsoLogin -DeployLambda
#>
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string] $Environment = 'dev',
  [string] $AwsProfile = '',
  [switch] $SsoLogin,
  [switch] $DeployLambda,
  [switch] $SkipMigration
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }

. "$ScriptDir\_aws-cli-helpers.ps1"

$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) {
  Write-Host 'Install AWS CLI v2, then re-run:' -ForegroundColor Yellow
  Write-Host '  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' -ForegroundColor Gray
  exit 1
}

if ($AwsProfile) {
  $env:AWS_PROFILE = $AwsProfile
  Write-Host "Using AWS profile: $AwsProfile" -ForegroundColor DarkGray
}

if ($SsoLogin) {
  if (-not $AwsProfile) {
    throw 'SsoLogin requires -AwsProfile <name> (the SSO profile from ~/.aws/config).'
  }
  Write-Host ''
  Write-Host '=== 0) AWS SSO login (complete in browser if prompted) ===' -ForegroundColor Cyan
  $ssoProc = Start-Process -FilePath $AwsExe -ArgumentList @('sso', 'login', '--profile', $AwsProfile) -Wait -PassThru -NoNewWindow
  if ($ssoProc.ExitCode -ne 0) {
    throw "aws sso login exited with code $($ssoProc.ExitCode)"
  }
  Write-Host 'SSO login finished.' -ForegroundColor Green
}

Write-Host ''
Write-Host '=== 1) AWS credentials ===' -ForegroundColor Cyan
$id = Invoke-AwsCli -AwsExe $AwsExe -Arguments @('sts', 'get-caller-identity', '--region', $Region, '--output', 'json')
if ($id.ExitCode -ne 0) {
  $msg = if ($id.StdErr) { $id.StdErr } else { $id.StdOut }
  Write-Host "FAILED: $msg" -ForegroundColor Red
  Write-Host 'Fix (access keys):  aws configure' -ForegroundColor Yellow
  Write-Host 'Fix (SSO):  .\fix-support-tickets-attachments-full-path.ps1 -AwsProfile <profile> -SsoLogin ...' -ForegroundColor Yellow
  exit 1
}
$who = $id.StdOut | ConvertFrom-Json
Write-Host "OK: $($who.Arn)" -ForegroundColor Green
Write-Host "    Account $($who.Account)  Region $Region" -ForegroundColor DarkGray

Write-Host ''
Write-Host '=== 2) Align app URL with RDS migration (common mistake) ===' -ForegroundColor Cyan
Write-Host '  dev  — API host: z0b3obweb6.execute-api.ap-south-1.amazonaws.com' -ForegroundColor White
Write-Host '         RDS cluster: warmpawz-dev-cluster' -ForegroundColor DarkGray
Write-Host '         Lambda:      warmpawz-dev-api-handler' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  prod — API host: mss9sa4y01.execute-api.ap-south-1.amazonaws.com' -ForegroundColor White
Write-Host '         RDS cluster: warmpawz-prod-cluster' -ForegroundColor DarkGray
Write-Host '         Lambda:      warmpawz-prod-api-handler' -ForegroundColor DarkGray
Write-Host ''

$targets = @()
if ($Environment -eq 'both') { $targets = @('dev', 'prod') } else { $targets = @($Environment) }

if (-not $SkipMigration) {
  Write-Host "=== 3) Migration 617 (support_tickets.attachments) for: $($targets -join ', ') ===" -ForegroundColor Cyan
  foreach ($t in $targets) {
    Write-Host "`n--- Running migration for $t ---" -ForegroundColor Yellow
    & "$ScriptDir\run-migration-617-aws-cli.ps1" -Environment $t
  }
} else {
  Write-Host '=== 3) Skipping migration (-SkipMigration) ===' -ForegroundColor DarkYellow
}

$repoRoot = Split-Path $ScriptDir -Parent
$lambdaDir = Join-Path $repoRoot 'backend\lambda'
$lambdaZip = Join-Path $lambdaDir 'api-handler.zip'
$lambdaZipUri = 'fileb:///' + ($lambdaZip.Replace('\', '/'))

if ($DeployLambda) {
  Write-Host ''
  Write-Host '=== 4) Build Lambda (npm run build) ===' -ForegroundColor Cyan
  Push-Location $lambdaDir
  try {
    if (-not (Test-Path (Join-Path $lambdaDir 'package.json'))) {
      throw "Not found: $lambdaDir\package.json"
    }
    & npm run build
    if (-not $?) { throw 'npm run build failed' }
  } finally {
    Pop-Location
  }
  if (-not (Test-Path -LiteralPath $lambdaZip)) {
    throw "Build did not produce: $lambdaZip"
  }
  Write-Host "OK: $lambdaZip" -ForegroundColor Green

  Write-Host ''
  Write-Host '=== 5) Upload Lambda (update-function-code) ===' -ForegroundColor Cyan
  foreach ($t in $targets) {
    $fn = if ($t -eq 'prod') { 'warmpawz-prod-api-handler' } else { 'warmpawz-dev-api-handler' }
    Write-Host "Uploading to $fn ..." -ForegroundColor Yellow
    $up = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
      'lambda', 'update-function-code',
      '--function-name', $fn,
      '--region', $Region,
      '--zip-file', $lambdaZipUri
    )
    if ($up.ExitCode -ne 0) {
      $err = if ($up.StdErr) { $up.StdErr } else { $up.StdOut }
      throw "update-function-code failed for ${fn}: $err"
    }
    Write-Host "OK: $fn updated" -ForegroundColor Green
    $wait = Invoke-AwsCli -AwsExe $AwsExe -Arguments @('lambda', 'wait', 'function-updated', '--function-name', $fn, '--region', $Region)
    if ($wait.ExitCode -ne 0) {
      Write-Host "WARN: lambda wait function-updated returned $($wait.ExitCode): $($wait.StdErr)" -ForegroundColor Yellow
    }
  }
} else {
  Write-Host ''
  Write-Host '=== 4–5) Deploy Lambda (manual) — re-run with -DeployLambda to build + upload ===' -ForegroundColor Cyan
  Write-Host "  cd `"$lambdaDir`"" -ForegroundColor White
  Write-Host '  npm run build' -ForegroundColor White
  foreach ($t in $targets) {
    $fn = if ($t -eq 'prod') { 'warmpawz-prod-api-handler' } else { 'warmpawz-dev-api-handler' }
    Write-Host "  & `"$AwsExe`" lambda update-function-code --function-name $fn --region $Region --zip-file `"$lambdaZipUri`"" -ForegroundColor White
  }
  Write-Host ''
  Write-Host 'Or one-liner:' -ForegroundColor DarkGray
  $one = "  .\fix-support-tickets-attachments-full-path.ps1 -Environment $Environment -DeployLambda"
  if ($AwsProfile) { $one += " -AwsProfile $AwsProfile" }
  Write-Host $one -ForegroundColor White
}

Write-Host ''
Write-Host '=== Done ===' -ForegroundColor Cyan
Write-Host 'Hard refresh customer web (Ctrl+Shift+R) if needed. Test POST /support/tickets.' -ForegroundColor DarkGray
