#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:?Usage: configure-ios-app.sh <app-dir> <icon-source> <google-plist-source> [include-photo-library]}"
ICON_SRC="${2:?}"
PLIST_SRC="${3:?}"
INCLUDE_PHOTO="${4:-false}"

IOS_APP="${APP_DIR}/ios/App/App"
PBXPROJ="${APP_DIR}/ios/App/App.xcodeproj/project.pbxproj"
ENTITLEMENTS="${IOS_APP}/App.entitlements"

cp "${PLIST_SRC}" "${IOS_APP}/GoogleService-Info.plist"
cp "${ICON_SRC}" "${IOS_APP}/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

/usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string 'Camera access is required to capture pet images and enable teleconsultation.'" "${IOS_APP}/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :NSCameraUsageDescription 'Camera access is required to capture pet images and enable teleconsultation.'" "${IOS_APP}/Info.plist"

/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'Microphone access is required for teleconsultation and voice communication.'" "${IOS_APP}/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :NSMicrophoneUsageDescription 'Microphone access is required for teleconsultation and voice communication.'" "${IOS_APP}/Info.plist"

/usr/libexec/PlistBuddy -c "Add :NSLocationWhenInUseUsageDescription string 'Location access is required to show nearby services and improve service discovery.'" "${IOS_APP}/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :NSLocationWhenInUseUsageDescription 'Location access is required to show nearby services and improve service discovery.'" "${IOS_APP}/Info.plist"

if [[ "${INCLUDE_PHOTO}" == "true" ]]; then
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryUsageDescription string 'Photo library access is required to upload profile and service images.'" "${IOS_APP}/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :NSPhotoLibraryUsageDescription 'Photo library access is required to upload profile and service images.'" "${IOS_APP}/Info.plist"
fi

cat > "${ENTITLEMENTS}" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>development</string>
</dict>
</plist>
EOF

PROD_ENT="${APP_DIR}/ios-config/App.entitlements.production.example"
if [[ -f "${PROD_ENT}" ]]; then
  cp "${PROD_ENT}" "${ENTITLEMENTS}"
  echo "  Using production entitlements from ios-config/App.entitlements.production.example"
fi

/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "${IOS_APP}/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string remote-notification" "${IOS_APP}/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :UIBackgroundModes:0 remote-notification" "${IOS_APP}/Info.plist"

python3 - <<PY
from pathlib import Path
p = Path("${PBXPROJ}")
text = p.read_text()
text = text.replace("MARKETING_VERSION = 1.0;", "MARKETING_VERSION = 1.0.4;")
text = text.replace("CURRENT_PROJECT_VERSION = 1;", "CURRENT_PROJECT_VERSION = 10;")
if "CODE_SIGN_ENTITLEMENTS" not in text:
    text = text.replace(
        "INFOPLIST_FILE = App/Info.plist;",
        "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tINFOPLIST_FILE = App/Info.plist;",
    )
p.write_text(text)
PY

echo "Configured ${APP_DIR}"
