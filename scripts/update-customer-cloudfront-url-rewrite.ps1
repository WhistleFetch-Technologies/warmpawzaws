# Publish customer CloudFront URL rewrite (vendor share + dynamic routes) to dev and/or prod.
param(
  [ValidateSet('dev', 'prod', 'both')]
  [string]$Environment = 'both'
)

$ErrorActionPreference = 'Stop'
$FUNCTION_CODE_FILE = Join-Path $PSScriptRoot '..\infra\modules\cloudfront\url-rewrite-function.js'

if (-not (Test-Path $FUNCTION_CODE_FILE)) {
  throw "Missing $FUNCTION_CODE_FILE"
}

$targets = @()
if ($Environment -eq 'dev' -or $Environment -eq 'both') {
  $targets += @{ Name = 'warmpawz-dev-customer-url-rewrite'; DistributionId = 'E2RDORGXSWJJ87' }
}
if ($Environment -eq 'prod' -or $Environment -eq 'both') {
  $targets += @{ Name = 'warmpawz-prod-customer-url-rewrite'; DistributionId = 'E2F29N49KVOOBP' }
}

foreach ($target in $targets) {
  $name = $target.Name
  Write-Host "Updating CloudFront function $name..." -ForegroundColor Cyan

  $devEtag = aws cloudfront describe-function --name $name --stage DEVELOPMENT --query 'ETag' --output text
  aws cloudfront update-function `
    --name $name `
    --if-match $devEtag `
    --function-code "fileb://$($FUNCTION_CODE_FILE -replace '\\','/')" `
    --function-config "Comment=Warmpawz customer URL rewrite (Next static export + vendor share),Runtime=cloudfront-js-1.0" `
    --output json | Out-Null

  $devEtag = aws cloudfront describe-function --name $name --stage DEVELOPMENT --query 'ETag' --output text
  aws cloudfront publish-function --name $name --if-match $devEtag --output text | Out-Null
  Write-Host "  Published $name" -ForegroundColor Green
}

Write-Host 'Done. CloudFront function updates propagate in a few minutes.' -ForegroundColor Green
