#Requires -Version 5.1
<#
.SYNOPSIS
  Creates public.support_tickets on prod (if missing), applies ticket enhancements from 500, then 617 attachments.
  Uses RDS Data API via AWS CLI (same pattern as run-migration-617-aws-cli.ps1).

.PARAMETER Environment
  dev | prod (default prod for this bootstrap)
#>
param(
  [ValidateSet('dev', 'prod')]
  [string] $Environment = 'prod',
  [string] $ClusterId = '',
  [string] $Database = 'warmpawz'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_aws-cli-helpers.ps1"

$AwsExe = Resolve-AwsCliExe
if (-not $AwsExe) { throw 'AWS CLI v2 not found' }

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'ap-south-1' }
if (-not $ClusterId) {
  $ClusterId = if ($Environment -eq 'prod') { 'warmpawz-prod-cluster' } else { 'warmpawz-dev-cluster' }
}

Write-Host "Region: $Region  Cluster: $ClusterId  Database: $Database  Env: $Environment" -ForegroundColor Cyan

$d = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
  'rds', 'describe-db-clusters', '--db-cluster-identifier', $ClusterId, '--region', $Region, '--output', 'json'
)
if ($d.ExitCode -ne 0) { throw "describe-db-clusters: $($d.StdErr)" }
$cluster = ($d.StdOut | ConvertFrom-Json).DBClusters[0]
if (-not $cluster) { throw "Cluster not found: $ClusterId" }
if (-not $cluster.HttpEndpointEnabled) { throw 'Data API disabled on cluster' }

$resourceArn = $cluster.DBClusterArn
$secretArn = $cluster.MasterUserSecret.SecretArn
if (-not $secretArn) {
  $secretName = if ($Environment -eq 'prod') {
    'warmpawz-prod-rds-master-20260207201049162400000001'
  } else {
    'warmpawz-dev-rds-master-20260106164510791100000002'
  }
  $s = Invoke-AwsCli -AwsExe $AwsExe -Arguments @(
    'secretsmanager', 'describe-secret', '--secret-id', $secretName, '--region', $Region, '--output', 'json'
  )
  if ($s.ExitCode -ne 0) { throw "describe-secret: $($s.StdErr)" }
  $secretArn = ($s.StdOut | ConvertFrom-Json).ARN
}

function Invoke-RdsSql {
  param([string]$Sql, [switch]$JsonOut)
  $tmp = Join-Path $env:TEMP ('rds-bootstrap-' + [Guid]::NewGuid().ToString('n') + '.json')
  $payload = @{ resourceArn = $resourceArn; secretArn = $secretArn; database = $Database; sql = $Sql } | ConvertTo-Json -Compress
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, $payload, $utf8)
  $args = @('rds-data', 'execute-statement', '--cli-input-json', ('file://' + $tmp), '--region', $Region)
  if ($JsonOut) { $args += '--output', 'json' }
  try {
    $r = Invoke-AwsCli -AwsExe $AwsExe -Arguments $args
    if ($r.ExitCode -ne 0) { throw "$(if ($r.StdErr) { $r.StdErr } else { $r.StdOut })" }
    return $r
  } finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}

$steps = @(
  @{ Name = 'CREATE support_tickets (053)'; Sql = @'
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'technical', 'billing', 'account', 'service', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    assigned_to UUID,
    assigned_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
)
'@ },
  @{ Name = 'Indexes (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)' },
  @{ Name = 'Indexes (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority)' },
  @{ Name = 'Indexes (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_id ON support_tickets(customer_id)' },
  @{ Name = 'Indexes (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor_id ON support_tickets(vendor_id)' },
  @{ Name = 'Indexes (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to)' },
  @{ Name = 'Indexes (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at)' },
  @{ Name = 'Composite index (053)'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor_status ON support_tickets(vendor_id, status) WHERE vendor_id IS NOT NULL' },
  @{ Name = 'COMMENT table'; Sql = "COMMENT ON TABLE support_tickets IS 'Support tickets for customer and vendor issues - used by /admin/support/* endpoints'" },
  @{ Name = 'COMMENT ticket_number'; Sql = "COMMENT ON COLUMN support_tickets.ticket_number IS 'Auto-generated ticket number (e.g., TKT-20260102-001)'" },
  @{ Name = '500: source column'; Sql = "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'customer'" },
  @{ Name = '500: source CHECK'; Sql = @'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_source_check'
  ) THEN
    ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_source_check
    CHECK (source IN ('customer', 'vendor', 'ai_chatbot', 'chat_handoff', 'admin', 'system'));
  END IF;
END $$;
'@ },
  @{ Name = '500: escalated_at'; Sql = 'ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ' },
  @{ Name = '500: escalation_reason'; Sql = 'ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalation_reason TEXT' },
  @{ Name = '500: last_updated_at'; Sql = 'ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW()' },
  @{ Name = '500: status constraint'; Sql = 'ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check' },
  @{ Name = '500: status constraint add'; Sql = @'
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'escalated', 'cancelled'))
'@ },
  @{ Name = '500: index source'; Sql = 'CREATE INDEX IF NOT EXISTS idx_support_tickets_source ON support_tickets(source)' },
  @{ Name = '500: responder_name if responses table exists'; Sql = @'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_ticket_responses') THEN
    ALTER TABLE support_ticket_responses ADD COLUMN IF NOT EXISTS responder_name TEXT;
  END IF;
END $$;
'@ },
  @{ Name = '500: backfill'; Sql = "UPDATE support_tickets SET source = 'customer' WHERE source IS NULL" },
  @{ Name = '500: backfill last_updated'; Sql = 'UPDATE support_tickets SET last_updated_at = updated_at WHERE last_updated_at IS NULL' },
  @{ Name = '617: attachments'; Sql = "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb" },
  @{ Name = '617: comment attachments'; Sql = "COMMENT ON COLUMN support_tickets.attachments IS 'Optional attachment URLs or metadata (JSON array)'" }
)

$i = 0
foreach ($step in $steps) {
  $i++
  Write-Host "[$i/$($steps.Count)] $($step.Name)..." -ForegroundColor Cyan
  $null = Invoke-RdsSql -Sql $step.Sql.Trim()
}

Write-Host "Verify attachments column..." -ForegroundColor Cyan
$v = Invoke-RdsSql -JsonOut -Sql "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name IN ('attachments','source','last_updated_at') ORDER BY column_name"
$rec = ($v.StdOut | ConvertFrom-Json).records
if (-not $rec -or $rec.Count -lt 3) {
  Write-Host "WARN: expected 3 columns verified, got: $($rec.Count)" -ForegroundColor Yellow
  Write-Host $v.StdOut
} else {
  Write-Host "OK: support_tickets has attachments, source, last_updated_at." -ForegroundColor Green
}
Write-Host 'Done.' -ForegroundColor Green
