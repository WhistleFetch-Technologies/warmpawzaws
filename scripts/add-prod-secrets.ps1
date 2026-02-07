# Quick script to add production secrets after GitHub CLI authentication
# Run: gh auth login (first time only)
# Then run: .\scripts\add-prod-secrets.ps1

$REPO = "ketan0103/warmpawzaws"

Write-Host "Adding Production GitHub Secrets..." -ForegroundColor Green
Write-Host ""

gh secret set PROD_API_URL --repo $REPO --body "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/"
gh secret set PROD_COGNITO_USER_POOL_ID --repo $REPO --body "ap-south-1_TpAEgzUIJ"
gh secret set PROD_COGNITO_CLIENT_ID --repo $REPO --body "6fpmgr888pp6ld0tt82t33d3h4"
gh secret set GOOGLE_MAPS_API_KEY --repo $REPO --body "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"

Write-Host ""
Write-Host "All production secrets added successfully!" -ForegroundColor Green
