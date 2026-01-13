#!/bin/bash

# ============================================================================
# Run Loyalty Segments Migrations (064 & 065)
# ============================================================================
# This script runs the loyalty segmentation system migrations
# ============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "================================================================="
echo "🎯 Loyalty Segments Migration Runner"
echo "================================================================="
echo ""

# Try to load from .env.local if DATABASE_URL not set
if [ -z "$DATABASE_URL" ]; then
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        echo -e "${YELLOW}📄 Loading DATABASE_URL from .env.local${NC}"
        export $(grep -E "^DATABASE_URL=" "$PROJECT_ROOT/.env.local" | xargs)
    fi
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo ""
    echo "Please set DATABASE_URL:"
    echo "  export DATABASE_URL=\"postgresql://user:password@host:port/database\""
    echo ""
    echo "Or add it to .env.local:"
    echo "  DATABASE_URL=postgresql://user:password@host:port/database"
    echo ""
    echo "Or for AWS RDS:"
    echo "  export DATABASE_URL=\"postgresql://admin:password@your-rds-endpoint.region.rds.amazonaws.com:5432/warmpawz\""
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
echo ""

# Extract database info for display (hide password)
DB_INFO=$(echo $DATABASE_URL | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
echo "Database: $DB_INFO"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql command not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo -e "${GREEN}✅ psql is available${NC}"
echo ""

# Test database connection
echo "Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Please check your DATABASE_URL and network connectivity"
    exit 1
fi
echo ""

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
MIGRATIONS_DIR="$PROJECT_ROOT/db/migrations"

echo "Project root: $PROJECT_ROOT"
echo "Migrations directory: $MIGRATIONS_DIR"
echo ""

# Check if migration files exist
MIGRATION_064="$MIGRATIONS_DIR/064_loyalty_segments_system.sql"
MIGRATION_065="$MIGRATIONS_DIR/065_update_loyalty_rules_with_segments.sql"

if [ ! -f "$MIGRATION_064" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_064${NC}"
    exit 1
fi

if [ ! -f "$MIGRATION_065" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_065${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration files found${NC}"
echo ""

# Run Migration 064
echo "================================================================="
echo "📦 Running Migration 064: Loyalty Segments System"
echo "================================================================="
echo ""

if psql "$DATABASE_URL" -f "$MIGRATION_064"; then
    echo ""
    echo -e "${GREEN}✅ Migration 064 completed successfully${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration 064 failed${NC}"
    exit 1
fi

echo ""

# Run Migration 065
echo "================================================================="
echo "📦 Running Migration 065: Update Loyalty Rules with Segments"
echo "================================================================="
echo ""

if psql "$DATABASE_URL" -f "$MIGRATION_065"; then
    echo ""
    echo -e "${GREEN}✅ Migration 065 completed successfully${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration 065 failed${NC}"
    exit 1
fi

echo ""

# Verify migrations
echo "================================================================="
echo "🔍 Verifying Migrations"
echo "================================================================="
echo ""

SEGMENT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM loyalty_segments;" | xargs)
echo "Segments created: $SEGMENT_COUNT"

if [ "$SEGMENT_COUNT" -ge "14" ]; then
    echo -e "${GREEN}✅ Expected 14 segments, found $SEGMENT_COUNT${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 14 segments, found $SEGMENT_COUNT${NC}"
fi

echo ""

# Show sample segments
echo "Sample segments:"
psql "$DATABASE_URL" -c "SELECT segment_name, segment_type, is_active FROM loyalty_segments ORDER BY priority DESC LIMIT 5;"

echo ""

# Check if rules were updated
RULE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM loyalty_action_rules WHERE conditions->>'segment_ids' IS NOT NULL;" | xargs)
echo "Rules using segments: $RULE_COUNT"

echo ""

echo "================================================================="
echo -e "${GREEN}✅ All migrations completed successfully!${NC}"
echo "================================================================="
echo ""
echo "Next steps:"
echo "  1. Deploy backend (if not already deployed)"
echo "  2. Deploy frontend (if not already deployed)"
echo "  3. Test API: GET /admin/loyalty-segments"
echo "  4. Test UI: Navigate to /loyalty → Segments tab"
echo ""
