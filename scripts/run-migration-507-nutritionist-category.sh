#!/bin/bash
# ============================================================================
# Run Migration 507: Add Nutritionist to service_categories (customer-web tile)
# ============================================================================
# Ensures category_id 'nutritionist' with name 'Nutritionist' exists so the
# customer web shows the Nutritionist tile when enabled in dashboard launch.
#
# Usage (AWS RDS):
#   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 507_add_nutritionist_service_category.sql
# Or:
#   ENVIRONMENT=dev ./scripts/run-migration-507-nutritionist-category.sh
# ============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Migration 507: Add Nutritionist to service_categories"
echo "====================================================="

ENV="${ENVIRONMENT:-dev}"
echo "Using AWS RDS (ENVIRONMENT=$ENV). Running migration..."
cd "$PROJECT_ROOT"
node scripts/run-migration-rds-node.js 507_add_nutritionist_service_category.sql

echo ""
echo "Done. Verify: GET /service-catalog/categories should return a category with category_id 'nutritionist' and name 'Nutritionist'."
