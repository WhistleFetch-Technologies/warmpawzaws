# Mobile Apps Testing Guide
## How to Test the Initialized Apps

**Date:** January 2025  
**Status:** ✅ Projects Initialized - Ready to Test

---

## ✅ Initialization Complete

### What Was Done
- ✅ React Native projects initialized
- ✅ Android directories created (both apps)
- ✅ iOS directories created (both apps)
- ✅ Dependencies installed (both apps)
- ✅ All source files in place

---

## 🚀 Testing Instructions

### Prerequisites

#### For Android Testing
1. **Android Studio** installed
2. **Android SDK** configured
3. **Android Emulator** running OR physical device connected
4. **USB Debugging** enabled (for physical device)

#### For iOS Testing (macOS only)
1. **Xcode** installed
2. **CocoaPods** installed: `sudo gem install cocoapods`
3. **iOS Simulator** available OR physical device

---

## 📱 Test Customer App

### Step 1: Start Metro Bundler

```bash
cd apps/WarmpawzCustomer
npm start
```

**Keep this terminal open!**

### Step 2: Run on Android

**In a new terminal:**
```bash
cd apps/WarmpawzCustomer
npm run android
```

**Expected:**
- App compiles
- App launches on emulator/device
- Auth screen appears
- No red screen errors

### Step 3: Test Authentication Flow

1. **Phone Input Screen**
   - Enter 10-digit phone number
   - Tap "Send Code"
   - Should show OTP input screen

2. **OTP Verification**
   - Enter OTP (123456 in UAT mode)
   - Tap "Verify"
   - Should navigate to onboarding or home

3. **Onboarding (New Users)**
   - Should see journey stage selection
   - Select a stage
   - Should navigate to next screen

4. **Home Screen (Returning Users)**
   - Should see home screen with services
   - All quick service options visible
   - Pet selector (if user has pets)

---

## 📱 Test Vendor App

### Step 1: Start Metro Bundler

```bash
cd apps/WarmpawzVendor
npm start
```

**Keep this terminal open!**

### Step 2: Run on Android

**In a new terminal:**
```bash
cd apps/WarmpawzVendor
npm run android
```

**Expected:**
- App compiles
- App launches on emulator/device
- Auth screen appears
- No red screen errors

### Step 3: Test Authentication Flow

1. **Phone Input Screen**
   - Enter 10-digit phone number
   - Tap "Send Code"
   - Should show OTP input screen

2. **OTP Verification**
   - Enter OTP (123456 in UAT mode)
   - Tap "Verify"
   - Should navigate to role selection or landing

3. **Role Selection (New Vendors)**
   - Should see list of vendor roles
   - Select a role
   - Should navigate to onboarding

4. **Landing Page (Existing Vendors)**
   - Should see appropriate state screen
   - Based on vendor status:
     - New, Pending, Approved, Active, etc.

---

## 🐛 Troubleshooting

### Issue: "Unable to resolve module"

**Solution:**
```bash
npm start -- --reset-cache
```

### Issue: Android build fails

**Solution:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Issue: "SDK location not found"

**Solution:**
1. Open Android Studio
2. Tools → SDK Manager
3. Install Android SDK
4. Set ANDROID_HOME:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

### Issue: iOS build fails

**Solution:**
```bash
cd ios
pod install
cd ..
npm run ios
```

### Issue: Port 8081 already in use

**Solution:**
```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9

# Or use different port
npm start -- --port 8082
```

### Issue: Red screen with errors

**Check:**
1. Metro bundler is running
2. All dependencies installed
3. No syntax errors in code
4. Check Metro bundler terminal for errors

---

## ✅ Success Checklist

### Build Success
- [ ] App compiles without errors
- [ ] App launches on emulator/device
- [ ] No red screen errors
- [ ] Metro bundler running

### Authentication Success
- [ ] Phone input works
- [ ] OTP sent successfully
- [ ] OTP verification works
- [ ] Navigation to next screen works

### Screen Success
- [ ] Customer onboarding appears (new users)
- [ ] Customer home appears (returning users)
- [ ] Vendor role selection appears (new vendors)
- [ ] Vendor landing appears (existing vendors)

### API Success
- [ ] API calls succeed
- [ ] No network errors
- [ ] Data loads correctly
- [ ] Session persists

---

## 📊 Test Results Template

### Customer App
- **Build:** ✅ / ❌
- **Auth Flow:** ✅ / ❌
- **Onboarding:** ✅ / ❌
- **Home Screen:** ✅ / ❌
- **API Calls:** ✅ / ❌

### Vendor App
- **Build:** ✅ / ❌
- **Auth Flow:** ✅ / ❌
- **Role Selection:** ✅ / ❌
- **Landing Page:** ✅ / ❌
- **API Calls:** ✅ / ❌

---

## 🎯 Next Steps After Testing

1. **Fix any build errors**
2. **Fix any runtime errors**
3. **Test all navigation flows**
4. **Continue screen migration**
5. **Add remaining features**

---

## 📝 Notes

- **UAT Mode:** OTP is always 123456 in testing
- **API Endpoints:** Same as web app
- **Design:** Identical to web app (#FF8C42)
- **Lifecycle:** All screens have proper cleanup

---

**Status:** ✅ Ready to test  
**Next:** Run `npm run android` or `npm run ios` to start testing

