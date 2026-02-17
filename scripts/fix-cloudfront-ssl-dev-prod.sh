#!/bin/bash
# ============================================================================
# Fix SSL for CloudFront custom domains (dev and prod)
# - Dev: dev.admin, dev.vendor, dev.customer (fix dev vendor to use ACM cert)
# - Prod: admin, vendor, customer (add aliases so custom domains work with ACM)
# Uses AWS CLI. ACM cert must be in us-east-1 (already have *.warmpawz.com).
#
# NOTE: Deploy scripts (deploy-admin-web.sh, deploy-vendor-web.sh, deploy-customer-web.sh)
# only do S3 upload + CloudFront invalidation; they never call update-distribution, so
# they do not change aliases or ViewerCertificate. If SSL breaks after a deploy, the
# cause is elsewhere (e.g. CDK/infra update, or another script that updates distribution
# without preserving Aliases/ViewerCertificate). Run this script to restore them.
# ============================================================================
# Usage: ./scripts/fix-cloudfront-ssl-dev-prod.sh [--dev-only] [--prod-only]
# ============================================================================

set -e

ACM_CERT_ARN="arn:aws:acm:us-east-1:057442119249:certificate/02b216e5-4696-409a-b595-a4d0f5b6b04b"
VIEWER_CERT='{"CloudFrontDefaultCertificate":false,"ACMCertificateArn":"arn:aws:acm:us-east-1:057442119249:certificate/02b216e5-4696-409a-b595-a4d0f5b6b04b","SSLSupportMethod":"sni-only","MinimumProtocolVersion":"TLSv1.2_2021","CertificateSource":"acm"}'

# Dev distributions (already have aliases; dev vendor needs ACM cert)
DEV_ADMIN_ID="E1WPXL8WBOWOE8"
DEV_VENDOR_ID="E95171GX1I6HN"
DEV_CUSTOMER_ID="E2RDORGXSWJJ87"

# Prod distributions (need aliases; already have ACM cert)
PROD_ADMIN_ID="E2NHO6UUI5UIHW"
PROD_VENDOR_ID="E3JDHOY1XIFOWE"
PROD_CUSTOMER_ID="E2F29N49KVOOBP"

DEV_ONLY=false
PROD_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --dev-only)  DEV_ONLY=true ;;
    --prod-only) PROD_ONLY=true ;;
  esac
done

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔧 Fix CloudFront SSL – custom domains (dev + prod)${NC}"
echo ""

# Ensure cert is issued
CERT_STATUS=$(aws acm describe-certificate --certificate-arn "$ACM_CERT_ARN" --region us-east-1 --query 'Certificate.Status' --output text 2>/dev/null || echo "NotFound")
if [ "$CERT_STATUS" != "ISSUED" ]; then
  echo -e "${RED}❌ ACM certificate not ISSUED (status: $CERT_STATUS). Fix DNS validation first.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ ACM cert: $ACM_CERT_ARN (ISSUED)${NC}"
echo ""

update_distribution() {
  local dist_id="$1"
  local name="$2"
  local aliases_json="$3"   # e.g. ["admin.warmpawz.com"] or empty to keep current
  local set_viewer_cert="$4"  # "true" to force ViewerCertificate to ACM

  echo -e "${BLUE}📋 $name (${dist_id})${NC}"

  local tmp_config="/tmp/cf-ssl-config-${dist_id}.json"
  aws cloudfront get-distribution-config --id "$dist_id" --output json > "$tmp_config"
  local etag
  etag=$(jq -r '.ETag' "$tmp_config")
  if [ -z "$etag" ] || [ "$etag" = "null" ]; then
    echo -e "   ${RED}❌ Failed to get ETag${NC}"
    return 1
  fi

  local config_file="/tmp/cf-ssl-distconfig-${dist_id}.json"
  jq -r '.DistributionConfig' "$tmp_config" > "$config_file"

  if [ -n "$aliases_json" ] && [ "$aliases_json" != "keep" ]; then
    local count
    count=$(echo "$aliases_json" | jq 'length')
    jq --argjson aliases "$aliases_json" --argjson qty "$count" \
      '.Aliases = {Quantity: $qty, Items: $aliases}' \
      "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"
    echo -e "   Set Aliases: $aliases_json"
  fi

  if [ "$set_viewer_cert" = "true" ]; then
    jq --argjson vc "$VIEWER_CERT" '.ViewerCertificate = $vc' \
      "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"
    echo -e "   Set ViewerCertificate to ACM cert"
  fi

  if aws cloudfront update-distribution --id "$dist_id" --if-match "$etag" --distribution-config "file://${config_file}" --output text > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Update initiated${NC}"
  else
    echo -e "   ${RED}❌ Update failed${NC}"
    rm -f "$tmp_config" "$config_file"
    return 1
  fi
  rm -f "$tmp_config" "$config_file"
  return 0
}

if [ "$PROD_ONLY" != true ]; then
  echo -e "${BLUE}═══ DEV ═══${NC}"
  # Dev admin/customer already have alias + ACM; no change unless we want to ensure cert
  # Dev vendor: has alias but CloudFront default cert → set ACM
  update_distribution "$DEV_VENDOR_ID" "Dev Vendor" "[\"dev.vendor.warmpawz.com\"]" "true" || true
  echo ""
fi

if [ "$DEV_ONLY" != true ]; then
  echo -e "${BLUE}═══ PROD ═══${NC}"
  update_distribution "$PROD_ADMIN_ID"  "Prod Admin"  "[\"admin.warmpawz.com\"]"  "false" || true
  update_distribution "$PROD_VENDOR_ID"  "Prod Vendor" "[\"vendor.warmpawz.com\"]" "false" || true
  update_distribution "$PROD_CUSTOMER_ID" "Prod Customer" "[\"customer.warmpawz.com\"]" "false" || true
  echo ""
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   CloudFront SSL updates submitted                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}⏳ Propagation takes 5–15 minutes. Then:${NC}"
echo "   Dev:  https://dev.admin.warmpawz.com, https://dev.vendor.warmpawz.com, https://dev.customer.warmpawz.com"
echo "   Prod: https://admin.warmpawz.com, https://vendor.warmpawz.com, https://customer.warmpawz.com"
echo ""
echo "   Check status: aws cloudfront get-distribution --id <ID> --query 'Distribution.Status'"
echo ""
