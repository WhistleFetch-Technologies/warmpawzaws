# Shared helpers for scripts that invoke AWS CLI v2 on Windows (reliable stderr/stdout).

function Resolve-AwsCliExe {
  $fromPath = Get-Command aws -ErrorAction SilentlyContinue
  if ($fromPath) { return $fromPath.Source }
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Amazon\AWSCLIV2\aws.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Amazon\AWSCLIV2\aws.exe')
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  return $null
}

function Invoke-AwsCli {
  param(
    [Parameter(Mandatory)][string]$AwsExe,
    [Parameter(Mandatory)][string[]]$Arguments
  )
  $outF = Join-Path $env:TEMP ('aws-out-' + [Guid]::NewGuid().ToString('n') + '.txt')
  $errF = Join-Path $env:TEMP ('aws-err-' + [Guid]::NewGuid().ToString('n') + '.txt')
  try {
    $p = Start-Process -FilePath $AwsExe -ArgumentList $Arguments -Wait -PassThru -NoNewWindow `
      -RedirectStandardOutput $outF -RedirectStandardError $errF
    $stdout = if (Test-Path -LiteralPath $outF) { (Get-Content -LiteralPath $outF -Raw) } else { '' }
    $stderr = if (Test-Path -LiteralPath $errF) { (Get-Content -LiteralPath $errF -Raw) } else { '' }
    if ($null -eq $stdout) { $stdout = '' }
    if ($null -eq $stderr) { $stderr = '' }
    return [pscustomobject]@{
      ExitCode = $p.ExitCode
      StdOut   = $stdout.Trim()
      StdErr   = $stderr.Trim()
    }
  } finally {
    Remove-Item -LiteralPath $outF, $errF -ErrorAction SilentlyContinue
  }
}
