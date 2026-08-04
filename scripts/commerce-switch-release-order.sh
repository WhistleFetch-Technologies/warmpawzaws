#!/usr/bin/env bash
# Commerce Switch release order (dev/prod). Run from repo root with AWS credentials configured.
#
# Scope: release sequencing only — does NOT deploy or migrate automatically.
# See scripts/commerce-switch-release-verify.js for post-deploy checks.
set -euo pipefail

ENV="${ENVIRONMENT:-dev}"
LAMBDA_ENV=""
PROD_FLAG=""

if [[ "${ENV}" == "prod" ]]; then
  LAMBDA_ENV="LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler "
  PROD_FLAG=" --prod"
  echo "WARNING: Production release — explicit team approval required."
fi

cat <<EOF
=== Commerce Switch Release Order (ENVIRONMENT=${ENV}) ===

Prerequisites (verify before starting)
  - Feature branch merged to develop; commerce-switch-ci workflow green on PR
  - AWS CLI configured (aws sts get-caller-identity)
  - Network path to RDS (or use RDS Data API for migrations if direct connect times out)
  - SNS_PLATFORM_NOTIFICATIONS_ARN set on target Lambda (governance propagate; mock-logs if missing)
  - Do NOT set COMMERCE_SWITCH_FORCE_MODEL in prod unless explicitly approved

1. Database migrations (strict order — all additive/idempotent)
   ENVIRONMENT=${ENV} node scripts/run-migration-rds-node.js 1080_seed_commerce_switch_configuration.sql
   ENVIRONMENT=${ENV} node scripts/run-migration-rds-node.js 1081_add_bookings_commerce_mode.sql
   ENVIRONMENT=${ENV} node scripts/run-migration-rds-node.js 1082_add_cache_invalidations_table.sql

   Notes:
   - 1080 seeds platform_settings key platform:commerce-switch:configuration (Marketplace default)
   - 1081 adds bookings.commerce_mode / commerce_version (nullable; no backfill required)
   - 1082 creates cache_invalidations (required for POST /admin/governance/propagate)

2. Shared package (no separate publish — file: dependency bundled at app build)
   packages/commerce-switch-contracts — consumed by admin, customer, vendor, WarmpawzCustomer

3. Backend Lambda (must precede all clients that call /config/commerce-switch)
   ${LAMBDA_ENV}./scripts/deploy-lambda-direct.sh

4. Admin Web (Commerce Switch panel + governance propagate UI)
   ./scripts/deploy-admin-web.sh${PROD_FLAG}

5. Customer Web (read-only prefetch client — no routing hook yet)
   ./scripts/deploy-customer-web.sh${PROD_FLAG}

6. Vendor Web (read-only prefetch client)
   ./scripts/deploy-vendor-web.sh${PROD_FLAG}

7. React Native — WarmpawzCustomer (store release; not covered by web deploy scripts)
   cd apps/WarmpawzCustomer && npm ci && npm test -- commerce-switch-client
   ./scripts/build-mobile-apps.sh customer
   (WarmpawzVendor has no commerce-switch client in current scope)

8. Post-deploy verification
   cd backend/lambda && npm run release-verify:commerce-switch
   cd backend/lambda && npm run validate:commerce-switch
   cd backend/lambda && npm test -- --testPathPattern=commerce-switch

   Optional strict smoke (expects activeModelId=marketplace — skip if admin toggled model):
   cd backend/lambda && npm run smoke:commerce-switch

   Manual admin checks (authenticated):
   - GET  /admin/commerce-switch/status
   - POST /admin/governance/propagate  body: {"type":"platform_settings_change"}
   - Admin Platform Settings → Commerce tab loads models list

Rollback guidance
  - App rollback: redeploy previous Lambda + web artifacts (no schema rollback needed)
  - Migrations are additive; do NOT drop columns/tables on rollback
  - Remove COMMERCE_SWITCH_FORCE_MODEL if set during incident response

EOF
