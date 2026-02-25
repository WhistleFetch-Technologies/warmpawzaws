# Deploy CloudFront Function Update for Customer Web (Production)
# Updates the URL rewrite function to handle dynamic routes

$FUNCTION_NAME = "warmpawz-prod-customer-url-rewrite"
$FUNCTION_CODE = Get-Content -Path "infra/modules/cloudfront/url-rewrite-function.js" -Raw

Write-Host "🔄 Updating CloudFront Function: $FUNCTION_NAME" -ForegroundColor Blue

# Get current function code to get ETag
$currentFunction = aws cloudfront get-function --name $FUNCTION_NAME --query 'ETag' --output text 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Could not get current function. Function may not exist." -ForegroundColor Red
    Write-Host $currentFunction
    exit 1
}

$etag = $currentFunction.Trim()

Write-Host "📝 Current ETag: $etag" -ForegroundColor Yellow

# Update function
Write-Host "📤 Updating function code..." -ForegroundColor Blue
$updateResult = aws cloudfront update-function `
    --name $FUNCTION_NAME `
    --function-code $FUNCTION_CODE `
    --if-match $etag `
    --query 'ETag' `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error updating function:" -ForegroundColor Red
    Write-Host $updateResult
    exit 1
}

$newEtag = $updateResult.Trim()
Write-Host "✅ Function updated. New ETag: $newEtag" -ForegroundColor Green

# Publish function
Write-Host "🚀 Publishing function..." -ForegroundColor Blue
$publishResult = aws cloudfront publish-function `
    --name $FUNCTION_NAME `
    --if-match $newEtag `
    --query 'FunctionSummary.[Name,Status]' `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error publishing function:" -ForegroundColor Red
    Write-Host $publishResult
    exit 1
}

Write-Host "✅ Function published successfully!" -ForegroundColor Green
Write-Host "📋 Status: $publishResult" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ Changes will take effect within a few minutes." -ForegroundColor Yellow
