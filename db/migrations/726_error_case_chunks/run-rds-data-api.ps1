# Runs migration 726 error-case chunks via AWS RDS Data API (one SQL statement per execute-statement).
# Applies the same *.sql files as run-local-postgres-726.ps1 to dev or prod Aurora.
#
# Prerequisites: aws CLI, IAM rds-data:ExecuteStatement + secretsmanager:GetSecretValue; cluster has Data API enabled.
#
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

function Split-SqlStatements([string]$raw) {
  $text = $raw.Trim()
  if ([string]::IsNullOrWhiteSpace($text)) { return @() }

  $stmts = New-Object System.Collections.Generic.List[string]
  $len = $text.Length
  $i = 0
  $start = 0
  $insideDollarQuote = $false
  $insideSingleQuote = $false

  while ($i -lt $len) {
    if (-not $insideSingleQuote -and $i -lt $len - 1 -and $text.Substring($i).StartsWith('$$')) {
      $insideDollarQuote = -not $insideDollarQuote
      $i += 2
      continue
    }

    if (-not $insideDollarQuote) {
      $ch = $text[$i]
      if ($insideSingleQuote) {
        if ($ch -eq [char]0x27) {
          # escaped '' inside SQL string literal
          if ($i + 1 -lt $len -and $text[$i + 1] -eq [char]0x27) {
            $i += 2
            continue
          }
          $insideSingleQuote = $false
        }
      }
      elseif ($ch -eq [char]0x27) {
        $insideSingleQuote = $true
      }
    }

    if (-not $insideDollarQuote -and -not $insideSingleQuote -and $text[$i] -eq ';') {
      $chunk = $text.Substring($start, $i - $start).Trim()
      if (-not [string]::IsNullOrWhiteSpace($chunk)) {
        $stmts.Add($chunk)
      }
      $start = $i + 1
    }

    $i++
  }

  $tail = $text.Substring($start).Trim()
  if (-not [string]::IsNullOrWhiteSpace($tail)) {
    $stmts.Add($tail)
  }

  return , $stmts.ToArray()
}

function Invoke-RdsDataStatement {
  param(
    [string]$ResourceArn,
    [string]$SecretArn,
    [string]$Sql
  )

  $tmpJson = [System.IO.Path]::GetTempFileName()
  try {
    $payload = @{
      resourceArn = $ResourceArn
      secretArn   = $SecretArn
      database    = 'warmpawz'
      sql         = $Sql
    } | ConvertTo-Json -Depth 10 -Compress

    [System.IO.File]::WriteAllText($tmpJson, $payload, [System.Text.UTF8Encoding]::new($false))

    aws rds-data execute-statement `
      --region $Region `
      --cli-input-json "file://$tmpJson" `
      --output json | Out-Null

    if ($LASTEXITCODE -ne 0) {
      throw "execute-statement failed (exit $LASTEXITCODE)"
    }
  }
  finally {
    Remove-Item -Force $tmpJson -ErrorAction SilentlyContinue
  }
}

$c = $configs[$Environment]
$chunkDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== RDS Data API migration 726 ($Environment) ===" -ForegroundColor Cyan
Write-Host "Cluster ARN: $($c.ResourceArn)"
Write-Host "Secret ARN:  $($c.SecretArn)"
Write-Host "Database:    warmpawz"
Write-Host ""

$files = Get-ChildItem -Path $chunkDir -Filter '*.sql' | Sort-Object Name
$fileIdx = 0
foreach ($file in $files) {
  $fileIdx++
  $sqlRaw = [System.IO.File]::ReadAllText($file.FullName)
  $statements = Split-SqlStatements $sqlRaw

  Write-Host "[$fileIdx/$($files.Count)] $($file.Name) ($($statements.Count) statement(s))..." -NoNewline

  try {
    $si = 0
    foreach ($stmt in $statements) {
      $si++
      Invoke-RdsDataStatement -ResourceArn $c.ResourceArn -SecretArn $c.SecretArn -Sql $stmt
    }
    Write-Host " OK" -ForegroundColor Green
  }
  catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host $_
    exit 1
  }
}

Write-Host ""
Write-Host "Migration 726 applied successfully on $Environment." -ForegroundColor Green
