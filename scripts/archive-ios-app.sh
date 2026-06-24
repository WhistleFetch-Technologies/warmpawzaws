#!/usr/bin/env bash
# Archive Warmpawz Capacitor iOS app from terminal (bypasses stale Xcode GUI SPM cache).
set -euo pipefail

APP="${1:-vendor}" # customer | vendor
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$APP" in
  customer)
    WEB_DIR="$ROOT/apps/customer-web"
    ARCHIVE_NAME="WarmpawzCustomer"
    ;;
  vendor|provider)
    WEB_DIR="$ROOT/apps/vendor-web"
    ARCHIVE_NAME="WarmpawzProvider"
    ;;
  *)
    echo "Usage: $0 [customer|vendor]" >&2
    exit 1
    ;;
esac

IOS_DIR="$WEB_DIR/ios/App"
ARCHIVE_PATH="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/${ARCHIVE_NAME}-$(date +%H%M%S).xcarchive"

echo "==> Syncing Capacitor iOS ($APP)..."
cd "$WEB_DIR"
npx cap sync ios

cd "$IOS_DIR"
mkdir -p "$(dirname "$ARCHIVE_PATH")"

if [[ "$APP" == "customer" ]]; then
  echo "==> pod install (customer CocoaPods)..."
  pod install
  echo "==> Archiving to $ARCHIVE_PATH ..."
  xcodebuild \
    -workspace App.xcworkspace \
    -scheme App \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    archive
else
  echo "==> Resolving Swift packages (vendor SPM)..."
  xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App
  echo "==> Archiving to $ARCHIVE_PATH ..."
  xcodebuild \
    -project App.xcodeproj \
    -scheme App \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    archive
fi

echo "==> Archive succeeded."
echo "    Path: $ARCHIVE_PATH"
echo "Open Xcode Organizer: Window -> Organizer -> Archives"
open -a Xcode
