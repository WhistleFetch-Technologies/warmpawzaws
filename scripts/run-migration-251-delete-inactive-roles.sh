#!/bin/bash
# ============================================================================
# Run Migration 251: Permanently delete inactive roles from the database
# ============================================================================
# Uses the same tested Node RDS migration script (run-migration-rds-node.js).
# Clears references to inactive roles and DELETE FROM roles WHERE is_active = false.
# Only the 25 canonical active roles remain.
#
# Usage (AWS RDS):
#   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 251_permanent_delete_inactive_roles.sql
# Or:
#   ENVIRONMENT=dev ./scripts/run-migration-251-delete-inactive-roles.sh
# ============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Migration 251: Permanently delete inactive roles"
echo "================================================="

ENV="${ENVIRONMENT:-dev}"
echo "Using AWS RDS (ENVIRONMENT=$ENV). Running migration..."
cd "$PROJECT_ROOT"
node scripts/run-migration-rds-node.js 251_permanent_delete_inactive_roles.sql

echo ""
echo "Done. Only the 25 canonical active roles remain in the database."
