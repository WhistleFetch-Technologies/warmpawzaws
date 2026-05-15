# Requires: AWS CLI v2, profile/credentials for prod (ap-south-1).
# Lists EventBridge rules on the default bus and shows targets (expect SQS → loyalty consumer).
# Does not call your API or read secrets.

$Region = "ap-south-1"
$Bus = "default"

Write-Host "`n=== Rules on event bus: $Bus ===" -ForegroundColor Cyan
aws events list-rules --event-bus-name $Bus --region $Region --output table

Write-Host "`n=== Rules whose name or event pattern mentions warmpawz / ActionOccurred (manual scan) ===" -ForegroundColor Cyan
$rules = aws events list-rules --event-bus-name $Bus --region $Region --output json | ConvertFrom-Json
foreach ($r in $rules.Rules) {
  $name = $r.Name
  $targets = aws events list-targets-by-rule --rule $name --event-bus-name $Bus --region $Region --output json 2>$null | ConvertFrom-Json
  if (-not $targets) { continue }
  $pattern = $r.EventPattern
  if ($pattern -match "warmpawz|ActionOccurred|app\.warmpawz") {
    Write-Host "`nRule: $name  (state: $($r.State))" -ForegroundColor Yellow
    Write-Host "  Pattern: $($pattern.Substring(0, [Math]::Min(200, $pattern.Length)))..."
    foreach ($t in $targets.Targets) {
      Write-Host "  Target: $($t.Arn)"
    }
  }
}

Write-Host "`nDone. In API Lambda logs, search for: [ActionOccurred] PutEvents ok | PutEvents rejected | publish failed" -ForegroundColor Green
Write-Host "Deploy loyalty-events-consumer with JSON.parse(detail) if SQS body still does not award points." -ForegroundColor Green
