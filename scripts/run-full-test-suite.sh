#!/bin/bash
# ============================================================================
# RUN FULL TEST SUITE WITH SEED DATA
# ============================================================================
# Seeds test data and runs comprehensive test suite for 100% coverage
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🚀 Starting Full Test Suite Execution"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Try to get database connection from AWS if not set
if [ -z "$DATABASE_URL" ] && [ -z "$DB_HOST" ] && [ -z "$RDS_HOSTNAME" ]; then
  echo "📊 Attempting to get database connection from AWS..."
  
  RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
  RDS_ENDPOINT=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$RDS_CLUSTER_ID" \
    --region "$REGION" \
    --query 'DBClusters[0].Endpoint' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$RDS_ENDPOINT" ] && [ "$RDS_ENDPOINT" != "None" ] && [ "$RDS_ENDPOINT" != "null" ]; then
    export DB_HOST="$RDS_ENDPOINT"
    export DB_PORT=$(aws rds describe-db-clusters \
      --db-cluster-identifier "$RDS_CLUSTER_ID" \
      --region "$REGION" \
      --query 'DBClusters[0].Port' \
      --output text 2>/dev/null || echo "5432")
    export DB_NAME=$(aws rds describe-db-clusters \
      --db-cluster-identifier "$RDS_CLUSTER_ID" \
      --region "$REGION" \
      --query 'DBClusters[0].DatabaseName' \
      --output text 2>/dev/null || echo "warmpawz")
    
    RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
      --region "$REGION" \
      --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" \
      --output text | head -1 2>/dev/null || echo "")
    
    if [ -n "$RDS_SECRET_ARN" ] && [ "$RDS_SECRET_ARN" != "None" ]; then
      DB_SECRET=$(aws secretsmanager get-secret-value \
        --secret-id "$RDS_SECRET_ARN" \
        --region "$REGION" \
        --query SecretString \
        --output text 2>/dev/null || echo "")
      
      if [ -n "$DB_SECRET" ]; then
        # Extract credentials using jq if available, otherwise python
        if command -v jq &> /dev/null; then
          export DB_USER=$(echo "$DB_SECRET" | jq -r '.username // .Username // ""' 2>/dev/null || echo "")
          export DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""' 2>/dev/null || echo "")
        else
          export DB_USER=$(echo "$DB_SECRET" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('username') or d.get('Username') or '')" 2>/dev/null || echo "")
          export DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('password') or d.get('Password') or '')" 2>/dev/null || echo "")
        fi
        
        if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ]; then
          echo "✅ Database connection configured from AWS"
          echo "   Host: $DB_HOST"
          echo "   Database: $DB_NAME"
          echo "   User: $DB_USER"
          echo ""
        else
          echo "⚠️  Could not extract credentials from secret"
        fi
      fi
    fi
  fi
  
  # If still no connection, show error
  if [ -z "$DATABASE_URL" ] && [ -z "$DB_HOST" ] && [ -z "$RDS_HOSTNAME" ]; then
    echo "❌ Could not determine database connection"
    echo "   Please set one of:"
    echo "     - DATABASE_URL (full connection string)"
    echo "     - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    echo "   Or ensure AWS CLI is configured and RDS cluster exists"
    exit 1
  fi
fi

# Step 1: Seed test data
echo "📦 Step 1: Seeding comprehensive test data..."
node scripts/seed-comprehensive-test-data.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to seed test data"
  exit 1
fi

echo ""
echo "✅ Test data seeded successfully"
echo ""

# Step 2: Run comprehensive test suite
echo "🧪 Step 2: Running comprehensive test suite..."
node scripts/execute-comprehensive-system-test.js "$ENVIRONMENT"

TEST_EXIT_CODE=$?

echo ""
echo "============================================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "⚠️  Some tests failed. Check issue tracker for details."
fi
echo "============================================================"

exit $TEST_EXIT_CODE
