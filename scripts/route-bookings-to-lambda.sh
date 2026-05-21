#!/bin/bash
# Route /bookings/* and /booking/* to the monolithic Lambda (warmpawz-dev-api-handler)
# instead of the Java booking-service ECS integration.
#
# Usage:
#   ./scripts/route-bookings-to-lambda.sh              # dev (default)
#   ./scripts/route-bookings-to-lambda.sh z0b3obweb6 jrsc8v3 ap-south-1
#
# To route back to Java booking-service (rollback):
#   ./scripts/route-bookings-to-lambda.sh z0b3obweb6 bsttuan ap-south-1

set -euo pipefail

API_ID="${1:-z0b3obweb6}"
LAMBDA_INTEGRATION_ID="${2:-jrsc8v3}"
AWS_REGION="${3:-ap-south-1}"

echo "API Gateway: $API_ID"
echo "Target integration: $LAMBDA_INTEGRATION_ID"
echo "Region: $AWS_REGION"
echo ""

for ROUTE_KEY in "ANY /bookings/{proxy+}" "ANY /booking/{proxy+}"; do
  ROUTE_ID=$(aws apigatewayv2 get-routes \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --query "Items[?RouteKey=='${ROUTE_KEY}'].RouteId | [0]" \
    --output text)

  if [ -z "$ROUTE_ID" ] || [ "$ROUTE_ID" = "None" ]; then
    echo "WARN: route not found: $ROUTE_KEY"
    continue
  fi

  echo "Updating $ROUTE_KEY ($ROUTE_ID) -> integrations/$LAMBDA_INTEGRATION_ID"
  aws apigatewayv2 update-route \
    --api-id "$API_ID" \
    --route-id "$ROUTE_ID" \
    --target "integrations/${LAMBDA_INTEGRATION_ID}" \
    --region "$AWS_REGION" \
    --output text > /dev/null
done

echo ""
echo "Current booking routes:"
aws apigatewayv2 get-routes \
  --api-id "$API_ID" \
  --region "$AWS_REGION" \
  --query "Items[?contains(RouteKey, 'booking')].[RouteKey,Target]" \
  --output table

echo ""
echo "Smoke test (expect Lambda VALIDATION_ERROR shape, not Java 'must not be blank'):"
curl -s -X POST "https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/bookings/create" \
  -H "Content-Type: application/json" \
  -d '{}' | head -c 200
echo ""
