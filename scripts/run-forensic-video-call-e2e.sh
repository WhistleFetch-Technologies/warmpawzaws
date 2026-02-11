#!/bin/bash
# Run forensic video call E2E (code trace + optional live API tests).
# Code trace: always runs. Live API: only when API_BASE and TEST_BOOKING_ID are set.
#
# Usage:
#   ./scripts/run-forensic-video-call-e2e.sh
#   API_BASE=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com \
#   TEST_BOOKING_ID=<uuid> TEST_VENDOR_ID=<uuid> TEST_CUSTOMER_ID=<uuid> \
#   ./scripts/run-forensic-video-call-e2e.sh

set -e
cd "$(dirname "$0")/.."
echo "Running forensic video call E2E..."
echo ""

if [ -n "$API_BASE" ] && [ -n "$TEST_BOOKING_ID" ]; then
  echo "Live API tests enabled (API_BASE + TEST_BOOKING_ID set)."
else
  echo "Live API tests skipped. Set API_BASE and TEST_BOOKING_ID (and optionally TEST_VENDOR_ID, TEST_CUSTOMER_ID) to run live tests."
fi
echo ""

npx ts-node scripts/forensic-video-call-e2e.ts
exit $?
