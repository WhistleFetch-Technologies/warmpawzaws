#!/usr/bin/env bash
# Phase 5 — TestFlight / release prep (documentation only; no deploy, no git push).
set -euo pipefail

cat <<'EOF'
# TestFlight release checklist — Warmpawz Customer (iOS)

Prerequisites: Phases 1–4 repo work done; Mac with Xcode; App Store Connect app record.

## Pre-archive

- [ ] npm run build && npm run cap:sync:ios
- [ ] App.entitlements → aps-environment = production (App Store builds)
- [ ] Version / Build bumped in Xcode (higher than last upload)
- [ ] Signing: Distribution cert + App Store provisioning profile
- [ ] GoogleService-Info.plist in ios/App/App/

## Archive

1. npm run cap:open:ios
2. Scheme: App → Any iOS Device (arm64)
3. Product → Archive
4. Distribute App → App Store Connect → Upload

## TestFlight internal

- [ ] Add internal testers in App Store Connect
- [ ] Install via TestFlight app
- [ ] Login / onboarding
- [ ] Navigation QA (CUSTOMER_NAV_AUDIT.md §8)
- [ ] Shop checkout + UPI (real device)
- [ ] Push notification receive + tap
- [ ] Universal Link: open customer.warmpawz.com/shop/... from Notes

## Android parallel (when ready)

- [ ] npm run build && npm run cap:sync
- [ ] Signed release AAB
- [ ] assetlinks.json live with correct SHA-256
- [ ] Internal testing track on Play Console

## Not in this script

- No deploy to prod web
- No git push — commit on your feature branch when ready

Full manual list: apps/customer-web/CAPACITOR_MOBILE_TODO.md
EOF
