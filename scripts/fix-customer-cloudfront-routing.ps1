# Fix customer CloudFront routing by creating and attaching URL rewrite function
# This ensures /auth routes to /auth.html instead of index.html

$ErrorActionPreference = "Stop"

$DISTRIBUTION_ID = "E2RDORGXSWJJ87"
$FUNCTION_NAME = "warmpawz-dev-customer-url-rewrite"
$REGION = "ap-south-1"

Write-Host "Fixing customer CloudFront routing..." -ForegroundColor Cyan
Write-Host ""

# CloudFront Function code (read from file or use here-string with proper escaping)
$FUNCTION_CODE_FILE = Join-Path $PSScriptRoot "..\infra\modules\cloudfront\url-rewrite-function.js"
if (Test-Path $FUNCTION_CODE_FILE) {
    $FUNCTION_CODE = Get-Content $FUNCTION_CODE_FILE -Raw
} else {
    # Fallback: use here-string with proper escaping
    $FUNCTION_CODE = @'
// CloudFront Function: URL Rewrite for Next.js Static Export
// Rewrites /auth to /auth.html, /onboarding to /onboarding.html, etc.
// This allows Next.js static export files to be served correctly

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // Skip if URI already has an extension (e.g., .html, .js, .css, .png)
  if (uri.match(/\.[a-zA-Z0-9]+$/)) {
    return request;
  }
  
  // Skip root path
  if (uri === '/') {
    return request;
  }
  
  // Skip if URI ends with a slash (directory)
  if (uri.endsWith('/')) {
    return request;
  }
  
  // Skip API paths and special paths
  if (uri.startsWith('/api/') || 
      uri.startsWith('/_next/') || 
      uri.startsWith('/static/') ||
      uri.startsWith('/runtime-config.js') ||
      uri.startsWith('/favicon.ico') ||
      uri.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/i)) {
    return request;
  }
  
  // Rewrite /auth to /auth.html, /onboarding to /onboarding.html, etc.
  // This handles Next.js static export routing
  request.uri = uri + '.html';
  
  return request;
}
'@
}

# Save function code to temp file
$TEMP_CODE_FILE = [System.IO.Path]::GetTempFileName() + ".js"
$FUNCTION_CODE | Out-File -FilePath $TEMP_CODE_FILE -Encoding utf8

try {
    # Check if function already exists
    Write-Host "Checking for existing CloudFront function..." -ForegroundColor Blue
    $EXISTING_FUNC = aws cloudfront list-functions --query "FunctionList.Items[?Name=='$FUNCTION_NAME'].FunctionARN" --output text 2>$null
    
    if ($EXISTING_FUNC) {
        Write-Host "   Updating existing CloudFront function..." -ForegroundColor Yellow
        
        # Get current ETag
        $DEV_ETAG = aws cloudfront get-function --name $FUNCTION_NAME --stage DEVELOPMENT --query 'ETag' --output text 2>$null
        
        if ($DEV_ETAG) {
            # Update function code
            aws cloudfront update-function `
                --name $FUNCTION_NAME `
                --if-match $DEV_ETAG `
                --function-code "file://$TEMP_CODE_FILE" `
                --function-config "Comment=URL rewrite function for customer - adds .html extension for Next.js static export,Runtime=cloudfront-js-1.0" `
                --output json | Out-Null
            
            Write-Host "   Function updated" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Could not get function ETag, creating new function..." -ForegroundColor Yellow
            $EXISTING_FUNC = $null
        }
    }
    
    if (-not $EXISTING_FUNC) {
        Write-Host "Creating new CloudFront function..." -ForegroundColor Blue
        $CREATE_OUTPUT = aws cloudfront create-function `
            --name $FUNCTION_NAME `
            --function-code "file://$TEMP_CODE_FILE" `
            --function-config "Comment=URL rewrite function for customer - adds .html extension for Next.js static export,Runtime=cloudfront-js-1.0" `
            --output json | ConvertFrom-Json
        
        $EXISTING_FUNC = $CREATE_OUTPUT.FunctionSummary.FunctionARN
        Write-Host "   Function created" -ForegroundColor Green
    }
    
    # Publish function
    Write-Host "Publishing CloudFront function..." -ForegroundColor Blue
    $DEV_ETAG = aws cloudfront get-function --name $FUNCTION_NAME --stage DEVELOPMENT --query 'ETag' --output text 2>$null
    if ($DEV_ETAG) {
        aws cloudfront publish-function --name $FUNCTION_NAME --if-match $DEV_ETAG --output text | Out-Null
        Write-Host "   Function published" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Could not get function ETag for publishing" -ForegroundColor Yellow
    }
    
    # Get function ARN
    $FUNCTION_ARN = aws cloudfront get-function --name $FUNCTION_NAME --stage DEVELOPMENT --query 'FunctionSummary.FunctionARN' --output text 2>$null
    
    if (-not $FUNCTION_ARN) {
        Write-Host "   Could not get function ARN" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Getting CloudFront distribution configuration..." -ForegroundColor Blue
    $CONFIG_JSON = aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --output json | ConvertFrom-Json
    $ETAG = $CONFIG_JSON.ETag
    $CONFIG = $CONFIG_JSON.DistributionConfig
    
    # Update configuration to add function association
    Write-Host "Updating CloudFront distribution with function association..." -ForegroundColor Blue
    
    # Check if FunctionAssociations exists, if not create it
    if (-not $CONFIG.DefaultCacheBehavior.FunctionAssociations) {
        $CONFIG.DefaultCacheBehavior.FunctionAssociations = @{
            Quantity = 0
            Items = @()
        }
    }
    
    # Add function association
    $CONFIG.DefaultCacheBehavior.FunctionAssociations.Quantity = 1
    $CONFIG.DefaultCacheBehavior.FunctionAssociations.Items = @(
        @{
            FunctionARN = $FUNCTION_ARN
            EventType = "viewer-request"
        }
    )
    
    # Save updated config to temp file
    $TEMP_CONFIG_FILE = [System.IO.Path]::GetTempFileName() + ".json"
    $CONFIG | ConvertTo-Json -Depth 100 | Out-File -FilePath $TEMP_CONFIG_FILE -Encoding utf8
    
    # Update distribution
    Write-Host "Updating CloudFront distribution..." -ForegroundColor Blue
    $UPDATE_OUTPUT = aws cloudfront update-distribution `
        --id $DISTRIBUTION_ID `
        --if-match $ETAG `
        --distribution-config "file://$TEMP_CONFIG_FILE" `
        --output json | ConvertFrom-Json
    
    Write-Host "   CloudFront distribution update initiated" -ForegroundColor Green
    Write-Host ""
    
    # Cleanup
    Remove-Item $TEMP_CODE_FILE -ErrorAction SilentlyContinue
    Remove-Item $TEMP_CONFIG_FILE -ErrorAction SilentlyContinue
    
    # Display results
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "   CLOUDFRONT ROUTING FIX INITIATED" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Update Details:" -ForegroundColor Blue
    Write-Host ($UPDATE_OUTPUT.Distribution | ConvertTo-Json -Depth 5)
    Write-Host ""
    Write-Host "Function: $FUNCTION_NAME" -ForegroundColor Blue
    Write-Host "   ARN: $FUNCTION_ARN" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Test URLs (after deployment):" -ForegroundColor Blue
    Write-Host "   • https://d2aoyjj8ine0wk.cloudfront.net/auth (should load auth page)" -ForegroundColor Gray
    Write-Host "   • https://dev.customer.warmpawz.com/auth (should load auth page)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: Distribution changes take 15-20 minutes to deploy" -ForegroundColor Yellow
    Write-Host "   You can check status with:" -ForegroundColor Gray
    Write-Host "   aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Cleanup temp files
    Remove-Item $TEMP_CODE_FILE -ErrorAction SilentlyContinue
    Remove-Item $TEMP_CONFIG_FILE -ErrorAction SilentlyContinue
}
