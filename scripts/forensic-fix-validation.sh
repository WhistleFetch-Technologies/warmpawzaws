#!/bin/bash
# Forensic validation: ingest removal + CloudFront API URLs
# Run before deploy to ensure no gaps.
# Usage: ./scripts/forensic-fix-validation.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo "=============================================="
echo "FORENSIC FIX VALIDATION (ingest + CloudFront)"
echo "=============================================="

# 1. No debug ingest (127.0.0.1:7242 or /ingest/) in source
echo ""
echo "[1] Checking for leftover debug ingest (127.0.0.1:7242, /ingest/)..."
INGEST_HITS=$(grep -r -l --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' -e '127\.0\.0\.1:7242' -e 'ingest/892f647a' "$PROJECT_ROOT/apps" "$PROJECT_ROOT/backend" 2>/dev/null | grep -v node_modules | grep -v '.next' | grep -v dist || true)
if [ -z "$INGEST_HITS" ]; then
  echo -e "  ${GREEN}PASS${NC}: No ingest references in source"
  ((PASS++)) || true
else
  echo -e "  ${RED}FAIL${NC}: Ingest still present in: $INGEST_HITS"
  ((FAIL++)) || true
fi

# 2. Admin runtime-config uses CloudFront
echo ""
echo "[2] Checking admin-web runtime-config uses CloudFront..."
if grep -q 'dfof7mguaa0a5.cloudfront.net' "apps/admin-web/public/runtime-config.js" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC}: Admin runtime-config has CloudFront URL"
  ((PASS++)) || true
else
  echo -e "  ${RED}FAIL${NC}: Admin runtime-config missing CloudFront URL"
  ((FAIL++)) || true
fi

# 3. Vendor runtime-config uses CloudFront
echo ""
echo "[3] Checking vendor-web runtime-config uses CloudFront..."
if grep -q 'd1s6ykkj381k58.cloudfront.net' "apps/vendor-web/public/runtime-config.js" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC}: Vendor runtime-config has CloudFront URL"
  ((PASS++)) || true
else
  echo -e "  ${RED}FAIL${NC}: Vendor runtime-config missing CloudFront URL"
  ((FAIL++)) || true
fi

# 4. Customer runtime-config uses CloudFront
echo ""
echo "[4] Checking customer-web runtime-config uses CloudFront..."
if grep -q 'd2aoyjj8ine0wk.cloudfront.net' "apps/customer-web/public/runtime-config.js" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC}: Customer runtime-config has CloudFront URL"
  ((PASS++)) || true
else
  echo -e "  ${RED}FAIL${NC}: Customer runtime-config missing CloudFront URL"
  ((FAIL++)) || true
fi

# 5. No execute-api in app runtime defaults (optional - we may keep fallback in scripts)
echo ""
echo "[5] Checking app api-client fallbacks use CloudFront..."
if grep -q 'd2aoyjj8ine0wk.cloudfront.net' "apps/customer-web/lib/api-client.ts" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC}: Customer api-client fallback is CloudFront"
  ((PASS++)) || true
else
  echo -e "  ${RED}FAIL${NC}: Customer api-client fallback not CloudFront"
  ((FAIL++)) || true
fi

# 6. Live API reachable via Customer CloudFront (optional)
CUSTOMER_CF="https://d2aoyjj8ine0wk.cloudfront.net"
echo ""
echo "[6] Probing Customer CloudFront API (health or discovery)..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$CUSTOMER_CF/health" 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ] || [ "$HTTP" = "404" ]; then
  echo -e "  ${GREEN}PASS${NC}: Customer CloudFront reachable (HTTP $HTTP)"
  ((PASS++)) || true
else
  echo -e "  ${YELLOW}SKIP${NC}: Customer CloudFront returned HTTP $HTTP (may need API path or deploy)"
fi

echo ""
echo "=============================================="
echo "Result: $PASS passed, $FAIL failed"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
