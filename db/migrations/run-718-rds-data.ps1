# Run 718_ai_chatbot_conversations.sql via RDS Data API (dev + prod).
# Requires: aws cli, IAM rds-data:ExecuteStatement + secretsmanager:GetSecretValue on the RDS secret.
$Region = "ap-south-1"
$Database = "warmpawz"

$Envs = @(
  @{
    Name       = "dev"
    ClusterArn = "arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster"
    SecretArn  = "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI"
  },
  @{
    Name       = "prod"
    ClusterArn = "arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster"
    SecretArn  = "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE"
  }
)

# One statement per invoke (no trailing semicolon on --sql per AWS RDS Data API docs)
$Statements = @(
  @"
CREATE TABLE IF NOT EXISTS public.ai_chatbot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT,
    user_message TEXT,
    bot_response TEXT,
    intent TEXT,
    confidence DOUBLE PRECISION,
    requires_agent BOOLEAN DEFAULT false,
    escalated_to_agent BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    escalation_ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
)
"@.Trim(),

  "CREATE INDEX IF NOT EXISTS idx_ai_chatbot_conversations_conv ON public.ai_chatbot_conversations (conversation_id)",

  "CREATE INDEX IF NOT EXISTS idx_ai_chatbot_conversations_escalation ON public.ai_chatbot_conversations (escalation_ticket_id)",

  "COMMENT ON TABLE public.ai_chatbot_conversations IS 'Per-turn AI assistant log; escalation_ticket_id links open tickets for agent transcript'"
)

foreach ($env in $Envs) {
  Write-Host "`n=== $($env.Name) ($($env.ClusterArn)) ===" -ForegroundColor Cyan
  $i = 0
  foreach ($sql in $Statements) {
    $i++
    Write-Host "Statement $i ..."
    aws rds-data execute-statement `
      --region $Region `
      --resource-arn $env.ClusterArn `
      --secret-arn $env.SecretArn `
      --database $Database `
      --sql $sql `
      --output json | ConvertFrom-Json | ConvertTo-Json -Compress
    if ($LASTEXITCODE -ne 0) { throw "execute-statement failed on $($env.Name) step $i" }
  }
  Write-Host "OK: $($env.Name) migration 718 applied." -ForegroundColor Green
}

Write-Host "`nAll environments completed." -ForegroundColor Green
