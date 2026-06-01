# Installs Cursor agent rules from cursor-agent-kit into .cursor/rules/
$ErrorActionPreference = "Stop"

$KitRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $KitRoot
$RulesSource = Join-Path $KitRoot "rules"
$RulesTarget = Join-Path $RepoRoot ".cursor\rules"

if (-not (Test-Path $RulesSource)) {
    Write-Error "Rules folder not found: $RulesSource"
}

New-Item -ItemType Directory -Force -Path $RulesTarget | Out-Null

Get-ChildItem -Path $RulesSource -Filter "*.mdc" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $RulesTarget $_.Name) -Force
    Write-Host "Installed: $($_.Name)"
}

Write-Host ""
Write-Host "Done. Rules installed to: $RulesTarget"
Write-Host "Restart Cursor or start a new Agent chat to load rules."
