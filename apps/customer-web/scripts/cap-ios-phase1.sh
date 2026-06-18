#!/usr/bin/env bash
# iOS Phase 1 — run on macOS only (Xcode + CocoaPods required).
# From repo: apps/customer-web
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ON_MAC=false
[[ "$(uname -s)" == "Darwin" ]] && ON_MAC=true

if ! $ON_MAC; then
  echo "NOTE: Not on macOS — cap add/sync OK; pod install and Xcode run require a Mac."
fi

echo "==> Installing deps (includes @capacitor/ios)"
npm ci

echo "==> Building customer-web (dist/ for cap sync)"
npm run build

if [[ ! -d ios ]]; then
  echo "==> Adding iOS platform"
  npx cap add ios
else
  echo "==> ios/ already exists — skipping cap add"
fi

echo "==> Syncing native iOS project"
npx cap sync ios

if [[ "$(uname -s)" == "Darwin" ]]; then
  if command -v pod >/dev/null 2>&1; then
    (cd ios/App && pod install)
  else
    echo "WARN: CocoaPods not installed — run: sudo gem install cocoapods && cd ios/App && pod install"
  fi
fi

PLIST_SRC="ios-config/GoogleService-Info.plist"
PLIST_DEST="ios/App/App/GoogleService-Info.plist"
if [[ -f "$PLIST_SRC" ]] && [[ -d ios/App/App ]]; then
  cp "$PLIST_SRC" "$PLIST_DEST"
  echo "==> Copied GoogleService-Info.plist → ios/App/App/"
else
  echo "WARN: Copy $PLIST_SRC manually after ios/App exists"
fi

echo ""
if $ON_MAC; then
  echo "Next (Xcode):"
  echo "  1. npm run cap:open:ios"
  echo "  2. App target → Signing & Capabilities → select Team, bundle: com.warmpawz.app"
  echo "  3. + Capability → Push Notifications (Phase 4)"
  echo "  4. + Capability → Associated Domains → applinks:customer.warmpawz.com (Phase 2)"
  echo "  5. Run on simulator — should load https://customer.warmpawz.com"
  echo "  6. Test payment → UPI should open PhonePe/GPay (RazorpayBridgeViewController)"
else
  echo "On a Mac: ./scripts/cap-ios-phase1.sh && npm run cap:open:ios"
fi
echo ""
echo "See ios-config/README.md and IOS_RAZORPAY_UPI_FIX.md for Phase 3+."
