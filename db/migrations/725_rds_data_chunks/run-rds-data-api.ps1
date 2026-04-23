# Runs 725 Allyticas migration chunks via RDS Data API (single statement per call).
# Usage:
#   .\run-rds-data-api.ps1 -Environment dev
#   .\run-rds-data-api.ps1 -Environment prod

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'prod')]
  [string]$Environment
)

$ErrorActionPreference = 'Stop'
$Region = 'ap-south-1'

$configs = @{
  dev = @{
    ResourceArn = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster'
    SecretArn   = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI'
  }
  prod = @{
    ResourceArn = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster'
    SecretArn   = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE'
  }
}

$c = $configs[$Environment]
$chunkDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== RDS Data API migration 725 ($Environment) ===" -ForegroundColor Cyan
Write-Host "Cluster ARN: $($c.ResourceArn)"
Write-Host "Secret ARN:  $($c.SecretArn)"
Write-Host "Database:    warmpawz"
Write-Host ""

$files = Get-ChildItem -Path $chunkDir -Filter '*.sql' | Sort-Object Name
$i = 0
foreach ($file in $files) {
  $i++
  $sql = [System.IO.File]::ReadAllText($file.FullName).Trim()
  if ([string]::IsNullOrWhiteSpace($sql)) { continue }

  Write-Host "[$i/$($files.Count)] $($file.Name)..." -NoNewline

  $tmpJson = [System.IO.Path]::GetTempFileName()
  try {
    $payload = @{
      resourceArn = $c.ResourceArn
      secretArn   = $c.SecretArn
      database    = 'warmpawz'
      sql         = $sql
    } | ConvertTo-Json -Depth 10 -Compress

    # Write UTF-8 no BOM for AWS CLI
    [System.IO.File]::WriteAllText($tmpJson, $payload, [System.Text.UTF8Encoding]::new($false))

    aws rds-data execute-statement `
      --region $Region `
      --cli-input-json "file://$tmpJson" `
      --output json | Out-Null

    Write-Host " OK" -ForegroundColor Green
  }
  catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host $_
    exit 1
  }
  finally {
    Remove-Item -Force $tmpJson -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "Migration 725 applied successfully on $Environment." -ForegroundColor Green
