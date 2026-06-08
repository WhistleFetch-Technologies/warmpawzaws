#!/usr/bin/env bash
# Phase 4 — iOS push native prep verification (macOS + Xcode).
# Does NOT deploy or push git. Run from apps/customer-web.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Phase 4 push — repo files check"

check() {
  if [[ -f "$1" ]]; then echo "  OK $1"; else echo "  MISSING $1"; exit 1; fi
}

check "ios/App/App/GoogleService-Info.plist"
check "ios/App/App/App.entitlements"
check "ios-config/GoogleService-Info.plist"
check "ios/App/App/Info.plist"

if grep -q "remote-notification" ios/App/App/Info.plist; then
  echo "  OK UIBackgroundModes remote-notification"
else
  echo "  MISSING UIBackgroundModes in Info.plist"
  exit 1
fi

if grep -q "aps-environment" ios/App/App/App.entitlements; then
  echo "  OK aps-environment in App.entitlements"
else
  echo "  MISSING aps-environment"
  exit 1
fi

if grep -q "capacitorDidRegisterForRemoteNotifications" ios/App/App/AppDelegate.swift; then
  echo "  OK AppDelegate APNs token forwarding"
else
  echo "  MISSING AppDelegate push hooks"
  exit 1
fi

echo ""
echo "Manual steps (Mac / Firebase — not automated):"
echo "  1. Xcode → App target → Signing & Capabilities"
echo "     + Push Notifications"
echo "     + Background Modes → Remote notifications"
echo "  2. Firebase Console → Project Settings → Cloud Messaging → iOS"
echo "     Upload APNs Auth Key (.p8) for bundle com.warmpawz.app"
echo "  3. App Store Archive: use aps-environment production"
echo "     (see ios-config/App.entitlements.production.example)"
echo "  4. Physical device: login → allow notifications → tray tap → correct screen"
echo ""
echo "JS bootstrap: lib/push-bootstrap.ts (no native rebuild for payload routing changes)"
echo "See ios-config/IOS_PUSH_SETUP.md"
