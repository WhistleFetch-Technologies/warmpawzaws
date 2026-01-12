#!/bin/bash
# ============================================================================
# Create Wallets Table Script - AWS CLI
# ============================================================================
# Creates the missing wallets table using AWS CLI to get credentials
# Usage: ./scripts/create-wallets-table.sh [environment]
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🔧 Creating Wallets Table"
echo "============================================================"

# Get RDS info
RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text)

RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" \
  --output text | head -1)

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text)

# Parse JSON using Python if jq is not available
if command -v jq &> /dev/null; then
  DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
  DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password')
else
  # Use Python to parse JSON
  DB_USERNAME=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('username') or data.get('Username') or 'warmpawz_admin')" <<< "$DB_SECRET")
  DB_PASSWORD=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('password') or data.get('Password') or '')" <<< "$DB_SECRET")
fi
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")

DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:5432/warmpawz"

# Use the migration file if it exists, otherwise create inline SQL
WALLET_MIGRATION_FILE="$(dirname "$0")/../db/migrations/012_wallet_tables.sql"

if [ -f "$WALLET_MIGRATION_FILE" ]; then
  echo "📝 Using migration file: 012_wallet_tables.sql"
  SQL_FILE="$WALLET_MIGRATION_FILE"
else
  echo "📝 Creating wallets table SQL inline..."
  cat > /tmp/create_wallets.sql <<'EOF'
-- Customer Wallets
CREATE TABLE IF NOT EXISTS customer_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id),
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES customer_wallets(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'payout')),
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_id ON customer_wallets(customer_id);
EOF
  SQL_FILE="/tmp/create_wallets.sql"
fi

echo "📝 Executing SQL..."
psql "$DATABASE_URL" -f "$SQL_FILE"

echo "✅ Wallets table created successfully!"

# Cleanup temp file if we created one
if [ "$SQL_FILE" = "/tmp/create_wallets.sql" ]; then
  rm /tmp/create_wallets.sql
fi
