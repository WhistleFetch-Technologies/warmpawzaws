#!/bin/bash
# ============================================================================
# Run Migration and Test Endpoints
# ============================================================================
# Complete workflow: Migrate DB schema and test all endpoints
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================================="
echo "🚀 Complete Endpoint Migration & Testing"
echo "================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Step 1: Run Migration
echo "================================================================="
echo "Step 1: Running Database Migration"
echo "================================================================="
echo ""

# Try Node.js version first (no psql needed), fallback to psql version
if command -v node &> /dev/null; then
  "$SCRIPT_DIR/migrate-behavior-journal-node.sh" "$ENVIRONMENT" "$REGION"
else
  "$SCRIPT_DIR/migrate-behavior-journal.sh" "$ENVIRONMENT" "$REGION"
fi

MIGRATION_EXIT=$?
if [ $MIGRATION_EXIT -ne 0 ]; then
  echo -e "${RED}❌ Migration failed. Aborting tests.${NC}"
  exit $MIGRATION_EXIT
fi

echo ""
echo "================================================================="
echo "Step 2: Testing Endpoints"
echo "================================================================="
echo ""

# Step 2: Test Endpoints
"$SCRIPT_DIR/test-endpoints.sh" "$ENVIRONMENT" "$REGION"

echo ""
echo "================================================================="
echo -e "${GREEN}✅ Migration and Testing Complete!${NC}"
echo "================================================================="
echo ""
