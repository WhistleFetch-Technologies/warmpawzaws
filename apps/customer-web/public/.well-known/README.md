# App Link verification files (customer.warmpawz.com)

Served at:

- `https://customer.warmpawz.com/.well-known/apple-app-site-association` (iOS Universal Links)
- `https://customer.warmpawz.com/.well-known/assetlinks.json` (Android App Links)

## Before production verify

1. **iOS** — Replace `TEAMID` in `apple-app-site-association` with your Apple Team ID (10 chars).
2. **Android** — Replace `REPLACE_WITH_RELEASE_KEY_SHA256_FINGERPRINT` with release keystore SHA-256:
   ```bash
   keytool -list -v -keystore your-release.keystore -alias your-alias
   ```
3. Deploy customer-web (static export includes `public/.well-known/`).
4. Confirm headers: AASA should be served as `application/json` (CloudFront/S3 — no `.json` extension on AASA file).

## Capacitor

- Android: `android/app/src/main/AndroidManifest.xml` intent-filter for `customer.warmpawz.com`
- iOS: `ios/App/App/App.entitlements` → `applinks:customer.warmpawz.com`
