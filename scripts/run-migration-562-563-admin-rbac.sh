#!/usr/bin/env bash
# Run migrations 562 (create admins table if not exists) and 563 (admin RBAC + OTP).
# Usage: ENVIRONMENT=dev ./scripts/run-migration-562-563-admin-rbac.sh
#        ENVIRONMENT=prod ./scripts/run-migration-562-563-admin-rbac.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV="${ENVIRONMENT:-dev}"
cd "$PROJECT_ROOT"

echo "=============================================="
echo "Admin RBAC migrations (562 + 563) — ENVIRONMENT=$ENV"
echo "=============================================="

echo ""
echo "[1] Running 562_create_admins_table_if_not_exists.sql..."
node scripts/run-migration-rds-node.js 562_create_admins_table_if_not_exists.sql

echo ""
echo "[2] Running 563_admin_rbac_and_otp.sql..."
node scripts/run-migration-rds-node.js 563_admin_rbac_and_otp.sql

echo ""
echo "=============================================="
echo "Done. Dev: UAT_MODE=true → OTP 123456. Prod: real OTP."
echo "=============================================="
