# Conflict Review Helper Script
# Run this to see both versions of conflicted files side-by-side

Write-Host "=== CONFLICT REVIEW HELPER ===" -ForegroundColor Cyan
Write-Host ""

# List all conflicted files
Write-Host "Conflicted Files:" -ForegroundColor Yellow
git diff --name-only --diff-filter=U
Write-Host ""

# Function to show both versions
function Show-Conflict {
    param($filePath)
    
    Write-Host "`n=== $filePath ===" -ForegroundColor Green
    Write-Host "DEVELOP version saved to: $filePath.develop" -ForegroundColor Cyan
    Write-Host "MAIN version saved to: $filePath.main" -ForegroundColor Cyan
    
    git show :1:$filePath > "$filePath.develop"
    git show :3:$filePath > "$filePath.main"
    
    Write-Host "Opening in VS Code for comparison..." -ForegroundColor Yellow
    code -d "$filePath.develop" "$filePath.main"
}

Write-Host "Choose a file to review:" -ForegroundColor Yellow
Write-Host "1. .github/workflows/prod.yml"
Write-Host "2. backend/lambda/src/database/rds-connection.ts"
Write-Host "3. infra/envs/prod/main.tf (CRITICAL)"
Write-Host "4. infra/envs/prod/outputs.tf"
Write-Host "5. infra/envs/prod/terraform.tfvars"
Write-Host "6. infra/envs/prod/variables.tf"
Write-Host "7. infra/modules/lambda/main.tf"
Write-Host "8. infra/modules/opensearch/main.tf"
Write-Host "9. Review ALL files"
Write-Host ""

$choice = Read-Host "Enter number (1-9)"

switch ($choice) {
    "1" { Show-Conflict ".github/workflows/prod.yml" }
    "2" { Show-Conflict "backend/lambda/src/database/rds-connection.ts" }
    "3" { Show-Conflict "infra/envs/prod/main.tf" }
    "4" { Show-Conflict "infra/envs/prod/outputs.tf" }
    "5" { Show-Conflict "infra/envs/prod/terraform.tfvars" }
    "6" { Show-Conflict "infra/envs/prod/variables.tf" }
    "7" { Show-Conflict "infra/modules/lambda/main.tf" }
    "8" { Show-Conflict "infra/modules/opensearch/main.tf" }
    "9" {
        Write-Host "Reviewing all files..." -ForegroundColor Yellow
        Show-Conflict ".github/workflows/prod.yml"
        Start-Sleep -Seconds 2
        Show-Conflict "backend/lambda/src/database/rds-connection.ts"
        Start-Sleep -Seconds 2
        Show-Conflict "infra/envs/prod/main.tf"
        Start-Sleep -Seconds 2
        Show-Conflict "infra/envs/prod/outputs.tf"
        Start-Sleep -Seconds 2
        Show-Conflict "infra/envs/prod/terraform.tfvars"
        Start-Sleep -Seconds 2
        Show-Conflict "infra/envs/prod/variables.tf"
        Start-Sleep -Seconds 2
        Show-Conflict "infra/modules/lambda/main.tf"
        Start-Sleep -Seconds 2
        Show-Conflict "infra/modules/opensearch/main.tf"
    }
    default { Write-Host "Invalid choice" -ForegroundColor Red }
}

Write-Host "`n=== TIP ===" -ForegroundColor Cyan
Write-Host "After reviewing, you can:" -ForegroundColor Yellow
Write-Host "1. Open the conflicted file in VS Code to see conflict markers"
Write-Host "2. Use VS Code's 'Accept Current/Incoming/Both' options"
Write-Host "3. Or manually edit the file to combine both versions"
Write-Host ""
Write-Host "When done with a file, run: git add path/to/file" -ForegroundColor Green
