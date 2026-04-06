/**
 * Prod RDS Data API: create customer_referrals, processed_events, action_sources
 * (one statement per execute-statement; JSON file avoids PowerShell quoting issues)
 */
const fs = require('fs');
const { execSync } = require('child_process');

const base = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE',
  database: 'warmpawz',
};

const stmts = [
  `CREATE TABLE IF NOT EXISTS customer_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    referrer_vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_phone TEXT NOT NULL,
    referral_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'approved', 'expired')),
    applied_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT customer_referrals_referrer_chk CHECK (
      (referrer_customer_id IS NOT NULL AND referrer_vendor_id IS NULL)
      OR (referrer_customer_id IS NULL AND referrer_vendor_id IS NOT NULL)
    ),
    UNIQUE (referrer_customer_id, referred_phone)
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_referrals_vendor_referred_phone
   ON customer_referrals (referrer_vendor_id, referred_phone)
   WHERE referrer_vendor_id IS NOT NULL`,

  `CREATE INDEX IF NOT EXISTS idx_customer_referrals_referred_customer_id
   ON customer_referrals (referred_customer_id)`,

  `CREATE TABLE IF NOT EXISTS processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT processed_events_event_id_key UNIQUE (event_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_processed_events_entity
   ON processed_events (entity_type, entity_id)`,

  `CREATE TABLE IF NOT EXISTS action_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL DEFAULT 'http' CHECK (source_type IN ('http', 'job', 'db_outbox')),
    route_pattern TEXT NOT NULL,
    method TEXT NOT NULL,
    status_min INTEGER NOT NULL DEFAULT 200,
    status_max INTEGER NOT NULL DEFAULT 299,
    success_predicate TEXT,
    action_name TEXT NOT NULL,
    entity_resolver TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'auto' CHECK (entity_type IN ('customer', 'vendor', 'auto')),
    amount_resolver TEXT,
    reference_type TEXT,
    reference_id_resolver TEXT,
    metadata_resolvers JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 100,
    dry_run BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS uq_action_sources_method_route_action
   ON action_sources (method, route_pattern, action_name)`,

  `CREATE INDEX IF NOT EXISTS idx_action_sources_enabled_priority
   ON action_sources (enabled, priority DESC, updated_at DESC)`,
];

const out = 'd:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json';

stmts.forEach((sql, i) => {
  console.log('DDL step', i + 1, '/', stmts.length);
  fs.writeFileSync(out, JSON.stringify({ ...base, sql }));
  execSync(
    'aws rds-data execute-statement --cli-input-json file://d:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json --region ap-south-1',
    { stdio: 'inherit' }
  );
});

console.log('Done.');
