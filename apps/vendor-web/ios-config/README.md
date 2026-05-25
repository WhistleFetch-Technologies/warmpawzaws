# iOS Push Setup

When running `npx cap add ios` on macOS:

1. Copy GoogleService-Info.plist from this folder into ios/App/App/
2. Open ios/App/App.xcworkspace in Xcode
3. Select the App target → Signing & Capabilities
4. Click + Capability → add "Push Notifications"
5. Click + Capability → add "Background Modes" → check "Remote notifications"
6. In Firebase Console → Project Settings → Cloud Messaging → iOS
   upload your APNs Authentication Key (.p8 from Apple Developer portal)
