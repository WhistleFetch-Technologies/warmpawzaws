# Copilot: Vendor gallery upload fix (strict — do not ship until all gates pass)

Use this **instead of** a vague “follow v7 doc” prompt when the APK was rebuilt but **gallery upload still fails**.

---

## Why “we load from URL” is only half true

The vendor app opens `https://vendor.warmpawz.com` in a WebView. That means:

| Layer | What runs it | Needs new APK? | Needs prod deploy? |
|-------|----------------|----------------|-------------------|
| **A. JavaScript** | CloudFront / S3 (`vendor-web` build) | No | **Yes** — unless prod already has the fix |
| **B. Native shell** | APK (`capacitor.config`, manifest `<queries>`, Capacitor plugins) | **Yes** | No |

**Both A and B are required.** Rebuilding an APK from the keystore repo **without** (1) merging web files and (2) deploying `vendor-web` to prod produces an APK that **looks** new but still runs **old upload code** from the URL.

Copilot often only edits `android/` in the keystore repo. That is **not sufficient**.

---

## Most common reasons the “fixed” APK still fails

1. **`vendor-web` source never updated** — `postJsonWithXhr`, `photo-upload-enhanced.ts`, `TouchFilePicker.tsx`, `camera-upload-bridge.ts` unchanged; prod URL still uses multipart/XHR only.
2. **`vendor-web` updated locally but never deployed** to `vendor.warmpawz.com` (no S3/CloudFront deploy).
3. **Skipped `npx cap sync android`** after changing `capacitor.config.json` → `CapacitorHttp` not active in native bridge.
4. **Missing `<queries>` in manifest** → picker opens but returns 0-byte files or intent fails on Android 11+.
5. **Built APK from wrong directory** — only `android/` from keystore, no parent `apps/vendor-web/capacitor.config.json` synced.
6. **Wrong `server.url`** in `capacitor.config.json` (staging/dev URL without the fix).
7. **Testing old install** — same `versionCode` / didn’t uninstall first.
8. **Copilot edited unrelated files** — manifest ok but JS still calls `FormData` or old `uploadFacilityCenterPhotosViaMultipartXhr` path only.

---

## Copilot task (copy everything below as the prompt)

```
TASK: Fix Warmpawz VENDOR Android gallery/center photo upload. Do NOT mark complete until every verification gate passes.

CONTEXT:
- App is Capacitor; WebView loads https://vendor.warmpawz.com (remote URL).
- Fix requires BOTH production web deploy AND native APK changes.
- Do NOT add/remove any <uses-permission> entries. Only add <queries> before <application>.
- Reference implementation: warmpawzaws repo paths listed below.

PHASE 1 — WEB (must exist in source AND on production URL)

1. In apps/vendor-web/lib/api-client.ts ensure function postJsonWithXhr exists:
   - If Capacitor.isNativePlatform(), use CapacitorHttp.post with Content-Type application/json and auth headers.
   - Do NOT silently fall back to XHR on native for large uploads.

2. In apps/vendor-web/lib/photo-upload-enhanced.ts ensure uploadFacilityCenterPhotos:
   - Builds body { photos: [{ base64, fileName, mimeType }] }
   - Calls postJsonWithXhr (NOT FormData multipart)
   - console.log contains exactly: [GALLERY] Uploading via JSON base64

3. Ensure Android camera path (if missing, copy from warmpawzaws):
   - apps/vendor-web/lib/capacitor-camera-pick.ts
   - apps/vendor-web/lib/camera-upload-bridge.ts
   - apps/vendor-web/components/shared/TouchFilePicker.tsx (setPendingCameraUploadPayloads on native image pick)

4. VendorGalleryManagement.tsx and FacilityManagement.tsx must import uploadFacilityCenterPhotos from photo-upload-enhanced (not deprecated multipart-only helper).

5. Deploy vendor-web to PRODUCTION (vendor.warmpawz.com). If you cannot deploy, STOP and report — APK alone will not fix JS.

GATE 1 (production JS — run on a machine with network):
   Open https://vendor.warmpawz.com in desktop Chrome → login → open DevTools → Sources or Network.
   Search loaded JS for the string: "Uploading via JSON base64"
   If NOT FOUND: production deploy is missing. Do not proceed to Phase 2.

PHASE 2 — NATIVE (APK)

6. apps/vendor-web/capacitor.config.json must include:
   "server": { "url": "https://vendor.warmpawz.com", "androidScheme": "https" }
   "plugins": { "CapacitorHttp": { "enabled": true } }

7. From apps/vendor-web (NOT android/ alone):
   npm run build:prod
   npx cap sync android
   Confirm sync completed without error.

8. apps/vendor-web/android/app/src/main/AndroidManifest.xml — add ONLY this <queries> block before <application> (keep all existing uses-permission lines unchanged):

<queries>
    <intent><action android:name="android.media.action.IMAGE_CAPTURE" /></intent>
    <intent><action android:name="android.media.action.VIDEO_CAPTURE" /></intent>
    <intent><action android:name="android.intent.action.GET_CONTENT" /></intent>
    <intent><action android:name="android.intent.action.PICK" /></intent>
</queries>

9. apps/vendor-web/android/app/build.gradle:
   buildFeatures { buildConfig = true }
   versionCode MUST be greater than last Play upload (e.g. 7 if last was 6)

10. Build debug APK:
    cd apps/vendor-web/android
    gradlew.bat assembleDebug

GATE 2 (installed debug APK):
    Uninstall com.warmpawz.vendor from test device first.
    Install app-debug.apk.
    chrome://inspect → inspect WebView → Gallery → upload one photo.
    Console MUST show: [GALLERY] Uploading via JSON base64
    Console MUST NOT show only multipart FormData upload for center photos.
    Photo MUST persist after page refresh.

If GATE 1 fails: fix deploy, not APK.
If GATE 1 passes but GATE 2 fails: fix cap sync, CapacitorHttp, or manifest queries.
If picker shows 0-byte files: fix TouchFilePicker / camera path (Phase 1 step 3).

PHASE 3 — RELEASE
Only after GATE 1 and GATE 2 pass:
- Copy keystore.properties + warmpawz-vendor-release.keystore into android/
- gradlew.bat bundleRelease
- Output: android/app/build/outputs/bundle/release/app-release.aab

DELIVERABLES when done:
- List of files changed (with paths)
- versionCode / versionName used
- Confirmation GATE 1 string found on vendor.warmpawz.com
- Screenshot or log line of [GALLERY] Uploading via JSON base64 from device inspect
```

---

## Quick diagnosis table (for humans)

| Symptom | Gate that failed | Action |
|---------|------------------|--------|
| Works in Chrome on vendor.warmpawz.com, fails in APK | B only (CapacitorHttp / queries) | `cap sync` + manifest + reinstall |
| Fails in Chrome too | A (prod JS) | Merge web files + **deploy vendor-web** |
| Picker never opens | B (`<queries>`) | Add manifest queries, rebuild |
| Picker opens, “empty file” / 0 bytes | A (camera bridge) | Merge TouchFilePicker + camera-upload-bridge |
| Console shows JSON base64 but HTTP 4xx/5xx | API/auth/backend | Not an APK issue — check vendor token / endpoint |
| Console shows XHR fallback on native | B (CapacitorHttp off) | cap sync + config plugin enabled |

---

## Files to copy verbatim from warmpawzaws (if unsure)

```
apps/vendor-web/lib/api-client.ts                    (postJsonWithXhr)
apps/vendor-web/lib/photo-upload-enhanced.ts         (uploadFacilityCenterPhotos)
apps/vendor-web/lib/capacitor-camera-pick.ts
apps/vendor-web/lib/camera-upload-bridge.ts
apps/vendor-web/components/shared/TouchFilePicker.tsx
apps/vendor-web/components/vendor/VendorGalleryManagement.tsx
apps/vendor-web/capacitor.config.json
apps/vendor-web/android/app/src/main/AndroidManifest.xml   (<queries> only — merge permissions)
apps/vendor-web/android/app/build.gradle                   (buildConfig + versionCode)
```

---

## What NOT to do

- Do **not** only edit files under `keystore/apps/vendor-web/android/` if there is no `lib/` web source there.
- Do **not** assume `npm run build` inside `android/` replaces `npx cap sync` from `apps/vendor-web`.
- Do **not** enable extra permissions “to fix upload” — use `<queries>` only.
- Do **not** ship AAB until GATE 1 (prod string) and GATE 2 (device console) pass.

---

See also: `docs/COPILOT_V7_ANDROID_BUILD.md` (full v7 vendor + customer).
