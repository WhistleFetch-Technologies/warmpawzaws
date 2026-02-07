# PowerShell script to add Production GitHub Secrets
# Usage: .\scripts\setup-prod-github-secrets.ps1

$REPO = "ketan0103/warmpawzaws"

# Production secrets to add
$secrets = @{
    "PROD_API_URL" = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/"
    "PROD_COGNITO_USER_POOL_ID" = "ap-south-1_TpAEgzUIJ"
    "PROD_COGNITO_CLIENT_ID" = "6fpmgr888pp6ld0tt82t33d3h4"
    "GOOGLE_MAPS_API_KEY" = "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"
}

Write-Host ""
Write-Host "Setting up Production GitHub Secrets for $REPO" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Check if GitHub CLI is available
$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue

if ($ghAvailable) {
    Write-Host "GitHub CLI found. Using gh CLI to set secrets..." -ForegroundColor Green
    Write-Host ""
    
    foreach ($secretName in $secrets.Keys) {
        $secretValue = $secrets[$secretName]
        Write-Host "Setting $secretName..." -ForegroundColor Cyan
        
        try {
            $output = & gh secret set $secretName --repo $REPO --body $secretValue 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   SUCCESS: $secretName set" -ForegroundColor Green
            } else {
                Write-Host "   FAILED: $secretName - $output" -ForegroundColor Red
            }
        } catch {
            Write-Host "   ERROR: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "GitHub CLI (gh) not found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual Setup Instructions:" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Go to: https://github.com/$REPO/settings/secrets/actions" -ForegroundColor Yellow
    Write-Host "Click 'New repository secret' and add each secret:" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($secretName in $secrets.Keys) {
        $secretValue = $secrets[$secretName]
        Write-Host "Secret Name: $secretName" -ForegroundColor White
        Write-Host "Secret Value: $secretValue" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "Or install GitHub CLI:" -ForegroundColor Cyan
    Write-Host "  winget install GitHub.cli" -ForegroundColor White
    Write-Host "  gh auth login" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Production secrets setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary of secrets:" -ForegroundColor Cyan
foreach ($secretName in $secrets.Keys) {
    Write-Host "   - $secretName" -ForegroundColor Green
}
Write-Host ""
Write-Host "Production CI/CD is now ready!" -ForegroundColor Green
