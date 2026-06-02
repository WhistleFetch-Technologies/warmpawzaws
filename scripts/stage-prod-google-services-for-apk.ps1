# Copy prod Firebase google-services.json into android/app for APK builds.
# Usage:
#   .\scripts\stage-prod-google-services-for-apk.ps1 -App customer
#   .\scripts\stage-prod-google-services-for-apk.ps1 -App vendor
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('customer', 'vendor')]
  [string]$App
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Source = Join-Path $Root 'prodscripts\firebase\google-services-prod-unified.json'

if (-not (Test-Path $Source)) {
  Write-Error "Missing $Source — add prod Firebase config under prodscripts/firebase/"
}

$TargetDir = if ($App -eq 'customer') {
  Join-Path $Root 'apps\customer-web\android\app'
} else {
  Join-Path $Root 'apps\vendor-web\android\app'
}

$Dest = Join-Path $TargetDir 'google-services.json'
Copy-Item $Source $Dest -Force

Write-Host "Staged prod google-services.json -> $Dest"
Write-Host "Prod package names in file: com.warmpawz.customer, com.warmpawz.vendor"
Write-Host "Ensure android applicationId matches your prod APK ($App) before ./gradlew assembleRelease"
