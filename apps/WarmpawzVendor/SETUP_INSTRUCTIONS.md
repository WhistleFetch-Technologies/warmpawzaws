# Setup Instructions - Native Dependencies
**Date:** 2025-01-28

---

## 🍎 iOS Setup (macOS Required)

### Install CocoaPods (if not installed):
```bash
sudo gem install cocoapods
```

### Link Dependencies:
```bash
cd apps/WarmpawzVendor/ios
pod install
cd ../..
```

### If Pod Install Fails:
```bash
# Update CocoaPods
sudo gem update cocoapods

# Clear pod cache
pod cache clean --all

# Try again
pod install --repo-update
```

---

## 🤖 Android Setup

### Usually Auto-Linked:
Android dependencies are usually auto-linked. Just rebuild:

```bash
cd apps/WarmpawzVendor
npm run android
```

### If Issues Occur:
1. Clean build:
```bash
cd android
./gradlew clean
cd ..
```

2. Rebuild:
```bash
npm run android
```

---

## 🚀 Start Testing

### Step 1: Start Metro Bundler
```bash
cd apps/WarmpawzVendor
npm start
```

### Step 2: Run App

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

---

## ✅ Verification

After running, check:
- [ ] App builds without errors
- [ ] Orange gradients appear
- [ ] Logo displays
- [ ] Animations work
- [ ] No crashes

---

## 🐛 Troubleshooting

### iOS: "pod: command not found"
**Solution:** Install CocoaPods first (see above)

### Android: Build errors
**Solution:** 
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Metro bundler issues
**Solution:**
```bash
npm start -- --reset-cache
```

---

**Status:** Ready to proceed once dependencies are linked

