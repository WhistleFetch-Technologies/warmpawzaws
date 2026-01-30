#!/bin/bash

# ============================================================================
# MIGRATION 255: Service Catalog Role Assignment - Wrapper Script
# ============================================================================
#
# Applies service_catalog applicable_roles backfill and multi-role assignment
# so vendor service management discovers the right catalog per role.
#
# Usage:
#   ./scripts/apply-migration-255-service-catalog-role-assignment.sh
#
# Optional env: ENVIRONMENT, AWS_REGION, DB_HOST, DB_NAME, DB_SSL=true
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Migration 255: Service Catalog Role Assignment"
echo ""

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required."
  exit 1
fi

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/apply-migration-255-service-catalog-role-assignment.js"
