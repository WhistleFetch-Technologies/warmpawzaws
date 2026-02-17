#!/usr/bin/env bash
# Systematic validation: Admin User Access & Audit
# Run after deploy. Validates API contracts, then prints UI/route/handler checklist.
# Usage: ./scripts/validate-admin-access-and-audit.sh [dev|prod]

set -e
ENV="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ "$ENV" = "prod" ]; then
  API_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
else
  API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
fi

echo "=============================================="
echo "Admin User Access & Audit – Validation ($ENV)"
echo "API_URL=$API_URL"
echo "=============================================="

# 1) API contract tests (Playwright)
echo ""
echo "[1] Running API contract tests..."
export API_URL="$API_URL"
export TEST_API_URL="$API_URL"
if (cd "$PROJECT_ROOT/tests/playwright" && npx playwright test specs/contract-tests/admin-users-and-audit-api.spec.ts --reporter=list 2>/dev/null); then
  echo "✅ API contract tests passed"
else
  echo "⚠️  Run: API_URL=$API_URL npx playwright test specs/contract-tests/admin-users-and-audit-api.spec.ts --config=tests/playwright/playwright.config.ts"
fi

# 2) Quick curl smoke (no auth → 401, with UAT → 200 for /admin/me)
echo ""
echo "[2] Smoke: GET /admin/me (no auth → 401)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/admin/me" 2>/dev/null || echo "000")
if [ "$STATUS" = "401" ]; then
  echo "✅ /admin/me returns 401 without auth"
else
  echo "⚠️  /admin/me without auth returned $STATUS (expected 401)"
fi

echo ""
echo "[3] Smoke: GET /admin/me (UAT → 200)"
UAT_TOKEN="uat-token-admin-$(date +%s)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $UAT_TOKEN" -H "X-UAT-Mode: true" -H "X-UAT-Token: $UAT_TOKEN" "$API_URL/admin/me" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then
  echo "✅ /admin/me returns 200 with UAT token"
else
  echo "⚠️  /admin/me with UAT returned $STATUS (expected 200)"
fi

echo ""
echo "=============================================="
echo "Component checklist (manual / E2E)"
echo "=============================================="
echo "Backend handlers:"
echo "  - GET  /admin/me                      → admin-users.ts, requireAdminAuth, returns admin + permissions"
echo "  - POST /admin/users                   → admin-users.ts, admin:users:create, OTP to phone"
echo "  - POST /admin/users/verify-otp-set-password → public, admin-users.ts"
echo "  - POST /admin/users/reset-password-request  → admin-users.ts, admin:users:reset_password or self"
echo "  - POST /admin/users/:id/send-set-password-otp → admin-users.ts"
echo "  - GET  /admin/users                   → admin-users.ts, admin:users:view"
echo "  - GET  /admin/audit-log               → admin-users.ts, admin:audit:view, query params"
echo "  - GET  /admin/roles                   → roles.ts, returns role_type for admin filter"
echo ""
echo "Frontend routes:"
echo "  - /                    → Login; after login → /analytics"
echo "  - /analytics           → Analytics + AuditLogPanel"
echo "  - /roles               → RBAC (Vendor roles + Admin users tabs) + AuditLogPanel"
echo "  - /set-password        → Public set-password form (email, phone, OTP, new password)"
echo "  - /no-access           → Access denied message, button to Analytics"
echo ""
echo "UI components:"
echo "  - UnifiedAdminSidebar  → Filter by getPermissionForSection; Reports/Platform Settings by permission"
echo "  - AdminLayout         → Route guard: redirect to /no-access if no section permission"
echo "  - RBACManagement       → Tabs: Vendor roles | Admin users (if admin:users:view)"
echo "  - AdminUsersTab       → List users, Create user, Reset password, Resend set-password OTP"
echo "  - AuditLogPanel       → Collapsible, filters, GET /admin/audit-log (if admin:audit:view)"
echo ""
echo "Flows:"
echo "  - Login → refetchAdmin() → redirect /analytics; sidebar filtered by permissions"
echo "  - Create user → POST /admin/users → success message with /set-password link"
echo "  - Set password → POST verify-otp-set-password → redirect to /"
echo "  - 403 from admin API → friendly message, token NOT cleared"
echo "=============================================="
