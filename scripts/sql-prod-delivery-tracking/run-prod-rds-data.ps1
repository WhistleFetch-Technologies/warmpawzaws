# Run against warmpawz prod Aurora (Data API). Requires: aws cli, secretsmanager read, rds-data:ExecuteStatement
$ErrorActionPreference = "Stop"
$Region = "ap-south-1"
$ResourceArn = "arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster"
$SecretArn = "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE"
$Database = "warmpawz"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-ProdSql {
    param([string]$Sql)
    aws rds-data execute-statement `
        --region $Region `
        --resource-arn $ResourceArn `
        --secret-arn $SecretArn `
        --database $Database `
        --sql $Sql `
        --format-records-as JSON
}

Write-Host "=== 1. CREATE delivery_tracking ==="
Invoke-ProdSql (Get-Content -Raw (Join-Path $ScriptDir "01_create_delivery_tracking.sql"))

$indexSql = @(
    "CREATE INDEX IF NOT EXISTS idx_delivery_tracking_pharmacy ON delivery_tracking(pharmacy_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_delivery_tracking_meal ON delivery_tracking(meal_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_delivery_tracking_partner ON delivery_tracking(logistics_partner_id)",
    "CREATE INDEX IF NOT EXISTS idx_delivery_tracking_active ON delivery_tracking(status) WHERE status NOT IN ('delivered', 'failed')",
    "CREATE INDEX IF NOT EXISTS idx_delivery_tracking_external_task_id ON delivery_tracking(external_task_id) WHERE external_task_id IS NOT NULL"
)
$i = 2
foreach ($s in $indexSql) {
    Write-Host "=== $i. INDEX ===" 
    Invoke-ProdSql $s
    $i++
}

Write-Host "=== 7. CREATE delivery_location_history ==="
Invoke-ProdSql (Get-Content -Raw (Join-Path $ScriptDir "03a_delivery_location_history_table.sql"))

Write-Host "=== 8. INDEX location history ==="
Invoke-ProdSql (Get-Content -Raw (Join-Path $ScriptDir "03b_delivery_location_history_index.sql"))

Write-Host "=== VERIFY ==="
Invoke-ProdSql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('delivery_tracking','delivery_location_history') ORDER BY 1"

Write-Host "Done."
