# Vendor Android app build (Capacitor)

The Play Store app is a **native shell** that loads `https://vendor.warmpawz.com`.  
Deploying vendor-web to S3/CloudFront updates the **website** only. Gallery upload fixes that need native changes (manifest, Camera plugin, `CapacitorHttp`) require a **new APK/AAB**.

Canonical signing and process docs: [keystore repo](https://github.com/AbhayankarBellur/keystore) (`docs/APP_BUILD_MEMORY.md`, `docs/app build help.md`).

### Keystore repo vs this repo (important)

| Item | Keystore repo | `warmpawzaws` |
|------|----------------|---------------|
| Release `.keystore` + `keystore.properties` | Yes | Copy in for local/CI builds only (never commit) |
| `MainActivity.java` source | **No** — only documented | `apps/vendor-web/android/.../MainActivity.java` |
| Last documented Play upload | `versionCode` **6**, `1.0.3` | `versionCode` **7**, `1.0.4` (gallery + `CapacitorHttp`) |
| File chooser / WebView media | Described in docs | Capacitor 8 `BridgeWebChromeClient` + our `<queries>` in manifest |

If gallery works in Chrome at `https://vendor.warmpawz.com` but not in the installed app, you are almost certainly on an **old APK** (v6 or earlier). Redeploying the website does **not** update manifest, `CapacitorHttp`, or synced `capacitor.config.json` inside the APK.

## One-time setup

1. Copy from the keystore repo into `apps/vendor-web/android/`:
   - `keystore.properties` (from `keystore.properties.example` + real passwords)
   - `app/warmpawz-vendor-release.keystore` → `android/app/warmpawz-vendor-release.keystore`

2. Ensure `capacitor.config.json` has `server.url` = `https://vendor.warmpawz.com` and plugins you need (`@capacitor/camera`, Capawesome FilePicker, `CapacitorHttp.enabled`).

## Debug APK (test gallery on device)

```powershell
Set-Location apps\vendor-web
npm run build:prod
npx cap sync android
Set-Location android
.\gradlew.bat assembleDebug
```

Install: `android\app\build\outputs\apk\debug\app-debug.apk`

## Release AAB (Play Store)

Bump `versionCode` in `android/app/build.gradle` before each upload.

```powershell
Set-Location apps\vendor-web
npm run build:prod
npx cap sync android
Set-Location android
.\gradlew.bat bundleRelease
```

Output: `android\app\build\outputs\bundle\release\app-release.aab`

## Verify before shipping

1. `npx cap sync android` ran after any change to `capacitor.config.json` or npm Capacitor plugins.
2. Install debug APK → Gallery → Center photos → pick → photo stays after refresh.
3. Chrome `chrome://inspect` → WebView → confirm `[GALLERY] Uploading via JSON base64 (native CapacitorHttp)` in console (browser shows `FormData multipart` instead).

## Why browser works but the app did not

| | Browser (URL) | Android app |
|--|----------------|-------------|
| UI / API | Latest from CloudFront | Same (remote URL) |
| Photo picker | Chrome / system | Capacitor Camera + WebView intents |
| Large upload | Normal HTTP stack | Needs `CapacitorHttp` in synced native config |
| Intent visibility | N/A | Requires `<queries>` in merged manifest |

If you only redeploy the website, the installed APK **does not** pick up manifest or `capacitor.config` changes until you rebuild and reinstall.
